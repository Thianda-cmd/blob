"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const seen = new Set<string>();

/**
 * Browser Back/Forward shows the server render Next kept from the last visit, so CVs made, edited or
 * trashed since then would look missing or outdated. This fetches the page again in that case only;
 * a normal visit (a link or router.push) is already fresh. `bfcacheId` is new for every push and
 * stays the same for Back/Forward, which is how the two are told apart.
 *
 * Returns whether `data` (the server's props) is current: false until the fresh copy has arrived.
 */
export function useRefreshOnBack<T>(data?: T) {
  const router = useRouter();
  const { bfcacheId } = router;
  // An old copy: remember the data it came with, to notice when the fresh one replaces it.
  const [cached] = useState(() => (seen.has(bfcacheId) ? { data } : null));
  const done = useRef(false);
  useEffect(() => {
    // Once per mount (React runs effects twice in development).
    if (done.current) return;
    done.current = true;
    if (cached) router.refresh();
    else seen.add(bfcacheId);
  }, [cached, bfcacheId, router]);
  return !cached || cached.data !== data;
}
