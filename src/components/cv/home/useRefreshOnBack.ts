"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const seen = new Set<string>();

/**
 * Browser Back/Forward shows the server render Next kept from the last visit, so CVs made, edited or
 * trashed since then would look missing or outdated. This fetches the page again in that case only;
 * a normal visit (a link or router.push) is already fresh. `bfcacheId` is new for every push and
 * stays the same for Back/Forward, which is how the two are told apart.
 */
export function useRefreshOnBack() {
  const router = useRouter();
  const { bfcacheId } = router;
  const done = useRef(false);
  useEffect(() => {
    // Once per mount (React runs effects twice in development).
    if (done.current) return;
    done.current = true;
    if (seen.has(bfcacheId)) router.refresh();
    else seen.add(bfcacheId);
  }, [bfcacheId, router]);
}
