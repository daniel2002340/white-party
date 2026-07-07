import { requireAdmin } from "@/lib/auth";

// Every /admin/** route requires the ADMIN role (non-admins are redirected to
// /login by requireAdmin). Nested under the protected layout, so a valid
// session is already guaranteed here.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}
