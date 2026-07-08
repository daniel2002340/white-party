import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { buttonClassName } from "@/components/ui/button";
import { EditionsOverview } from "@/components/editions-overview";

// Public home at "/". Signed-in guests get the editions overview (unchanged);
// visitors who aren't logged in see a short welcome with a link to /login.
export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    if (user.mustChangePassword) redirect("/wachtwoord-instellen");
    return <EditionsOverview />;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-28 sm:py-36">
      <p className="eyebrow">Privéfeest</p>
      <h1 className="poster-title mt-5">
        White Party<span className="text-accent">.</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-secondary">
        Een besloten feest voor genodigden. Log in om je uitnodiging te bekijken,
        je aan te melden en de foto&apos;s van eerdere edities te zien.
      </p>
      <div className="mt-10">
        <Link href="/login" className={buttonClassName()}>
          Inloggen
        </Link>
      </div>
    </div>
  );
}
