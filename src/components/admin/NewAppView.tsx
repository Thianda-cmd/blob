"use client";

import { motion } from "motion/react";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
        <motion.header initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-7">
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.03em]">{t.form.newTitle}</h1>
          <p className="mt-1 text-[13.5px] text-ink-2">{t.form.newIntro}</p>
        </motion.header>
        <AppForm
          onSaved={(r) => setCreated({ kind: "created", appName: r.name, clientId: r.clientId, secret: r.secret, id: r.id })}
        />
      </AdminPage>
      <SecretDialog credentials={created} onClose={() => created && router.push(`/admin/apps/${created.id}?tab=integration`)} />
    </>
  );
}
