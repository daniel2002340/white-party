import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

// Guard for every page outside /login and /wachtwoord-instellen: requires a
// valid session (redirects to /login otherwise). Users who still have to set a
// password are funnelled to /wachtwoord-instellen before they can go anywhere.
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (user.mustChangePassword) {
    redirect("/wachtwoord-instellen");
  }
  return <>{children}</>;
}
