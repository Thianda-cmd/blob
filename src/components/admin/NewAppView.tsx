"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { TopBar } from "@/components/shell/TopBar";
import { useMessages } from "@/i18n/client";
import { adminText } from "@/i18n/messages/admin";
import { AppForm } from "./AppForm";
import { AdminPage } from "./parts";
import { SecretDialog, type Credentials } from "./SecretDialog";

/** /admin/apps/new: the form, then the new app's client id (and secret, once). */
export function NewAppView() {
  const t = useMessages(adminText);
  const router = useRouter();
  const [created, setCreated] = useState<(Credentials & { id: string }) | null>(null);

  return (
    <>
      <TopBar
        crumbs={[
          { label: t.nav, icon: <ShieldCheck className="size-3.5 text-ink-3" />, href: "/admin" },
          { label: t.title, href: "/admin" },
          { label: t.form.newTitle },
        ]}
      />
      <AdminPage>
        <PageHeader title={t.form.newTitle} meta={t.form.newIntro} />
        <AppForm
          onSaved={(r) => setCreated({ kind: "created", appName: r.name, clientId: r.clientId, secret: r.secret, id: r.id })}
        />
      </AdminPage>
      <SecretDialog credentials={created} onClose={() => created && router.push(`/admin/apps/${created.id}?tab=integration`)} />
    </>
  );
}
