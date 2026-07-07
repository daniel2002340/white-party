"use client";

import Link from "next/link";
import { Button, buttonClassName } from "@/components/ui/button";
import { deleteEdition } from "./actions";

export function EditionRowActions({
  editionId,
  title,
}: {
  editionId: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/admin/edities/${editionId}/rsvps`}
        className={buttonClassName({ variant: "secondary", size: "sm" })}
      >
        RSVP&apos;s
      </Link>
      <Link
        href={`/admin/edities/${editionId}/fotos`}
        className={buttonClassName({ variant: "secondary", size: "sm" })}
      >
        Foto&apos;s
      </Link>
      <Link
        href={`/admin/edities/${editionId}/bewerken`}
        className={buttonClassName({ variant: "secondary", size: "sm" })}
      >
        Bewerken
      </Link>
      <form
        action={deleteEdition}
        onSubmit={(event) => {
          if (
            !window.confirm(
              `Weet je zeker dat je "${title}" wilt verwijderen? Dit verwijdert ook alle foto's en RSVP's van deze editie. Dit kan niet ongedaan worden gemaakt.`
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={editionId} />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          className="text-danger hover:text-danger"
        >
          Verwijderen
        </Button>
      </form>
    </div>
  );
}
