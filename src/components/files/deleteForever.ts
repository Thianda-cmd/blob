"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";
import { PAGE_META_COLUMNS, type PageMeta } from "@/lib/types";

// "Delete forever" for pages in the trash and for whole projects, together with their files. The
// rows go first and the files after, once the rows are really gone: removing the files first would
// leave a note without them if the delete then failed, and it could still be restored. Storage lets
// nobody remove a page's or project's files once its row is gone, so they go through the service
// role, but only paths the server listed as unused (rpc unused_files, migration 0012) while the
// person could still edit that page or project. Whatever is missed goes in the nightly clean-up
// (api/cron/files).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function chunks<T>(list: T[], size = 100) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * The files of each page or project that nothing else refers to, as if it were deleted now (its own
 * references don't count). A few at a time, so a big trash doesn't flood the server.
 */
async function unusedOf(db: Db, kind: "page" | "project", ids: string[]) {
  const out: string[] = [];
  const queue = [...ids];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      const { data } = await db.rpc("unused_files", { p_kind: kind, p_id: id, p_min_age: "0 seconds", p_whole: true });
      // Only ever that page's or project's own folder.
      for (const path of (data ?? []) as string[]) if (path.startsWith(`${kind}/${id}/`)) out.push(path);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return out;
}

/** Remove files whose page or project is gone. */
async function removeGone(paths: string[]) {
  if (!paths.length) return;
  const storage = createAdminClient().storage.from("files");
  for (const part of chunks(paths)) {
    const { error } = await storage.remove(part);
    if (error) console.error("deleteForever: removing files failed", error.message);
  }
}

export type DeletedPages = { gone: string[]; detached: PageMeta[] };

/**
 * Delete pages of yours in the trash forever, with your pages inside them (the database deletes
 * those along) and their files. Only pages still in the trash go: one restored meanwhile, in another
 * tab or on the phone, stays with its files. Your live pages inside move to the top level first.
 * `gone`: which of `ids` are gone now; `detached`: the pages that moved. Null when nothing was done.
 */
export async function deletePagesForever(ids: string[]): Promise<DeletedPages | null> {
  if (!Array.isArray(ids) || ids.length > 5000 || !ids.every((id) => typeof id === "string" && UUID.test(id))) return null;
  const user = await getUser();
  if (!user) return null;
  const db = await createClient();

  const roots: string[] = [];
  for (const part of chunks(ids)) {
    const { data, error } = await db.from("pages").select("id").in("id", part).eq("user_id", user.id).not("trashed_at", "is", null);
    if (error) return null;
    roots.push(...data.map((p) => p.id as string));
  }

  // Walk down: your trashed pages inside go with them. Your live ones move out first, so the
  // cascade can't take them along (other people's pages move up on their own: migration 0011).
  const all = new Set(roots);
  const detached: PageMeta[] = [];
  for (let level = roots; level.length; ) {
    const next: string[] = [];
    for (const part of chunks(level)) {
      const { data, error } = await db.from("pages").select("id, trashed_at").in("parent_id", part).eq("user_id", user.id);
      if (error) return null;
      const live = data.filter((p) => !p.trashed_at).map((p) => p.id as string);
      if (live.length) {
        const moved = await db.from("pages").update({ parent_id: null }).in("id", live).is("trashed_at", null).select(PAGE_META_COLUMNS);
        if (moved.error) return null;
        detached.push(...(moved.data as PageMeta[]));
      }
      for (const { id, trashed_at } of data) {
        if (!trashed_at || all.has(id)) continue;
        all.add(id);
        next.push(id);
      }
    }
    level = next;
  }

  // Asked while the pages are still there: the server only answers people who may edit them.
  const files = await unusedOf(db, "page", [...all]);
  for (const part of chunks(roots)) {
    if ((await db.from("pages").delete().in("id", part).not("trashed_at", "is", null)).error) break;
  }

  // Only the files of pages that are really gone now.
  const left = new Set<string>();
  for (const part of chunks([...all])) {
    const { data, error } = await db.from("pages").select("id").in("id", part);
    if (error) return { gone: [], detached };
    for (const { id } of data) left.add(id);
  }
  await removeGone(files.filter((path) => all.has(path.split("/")[1]) && !left.has(path.split("/")[1])));
  return { gone: ids.filter((id) => all.has(id) && !left.has(id)), detached };
}

/** Delete a project forever, with its cards and their files. Only its owner may. True once it is gone. */
export async function deleteProjectForever(projectId: string): Promise<boolean> {
  if (typeof projectId !== "string" || !UUID.test(projectId)) return false;
  const user = await getUser();
  if (!user) return false;
  const db = await createClient();
  const { data: role } = await db.rpc("project_role", { p_project: projectId });
  if (role !== "owner") return false;
  const files = await unusedOf(db, "project", [projectId]);
  const { data, error } = await db.from("projects").delete().eq("id", projectId).select("id");
  if (error || !data.length) return false;
  await removeGone(files);
  return true;
}
