import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";

// Friendly Dutch 404.
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-6 py-20 text-center">
      <p className="eyebrow">Foutje</p>
      <h1 className="mt-4 font-display text-5xl font-semibold text-foreground">
        Pagina niet gevonden
      </h1>
      <p className="mt-4 text-secondary">
        Deze pagina bestaat niet of is verplaatst. Controleer de link of ga
        terug naar het overzicht.
      </p>
      <div className="mt-8 flex justify-center">
        <Link href="/" className={buttonClassName()}>
          Naar het overzicht
        </Link>
      </div>
    </div>
  );
}
