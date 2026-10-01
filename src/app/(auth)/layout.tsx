import { AuthShell } from "@/components/auth/AuthStage";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <AuthShell>{children}</AuthShell>;
}
