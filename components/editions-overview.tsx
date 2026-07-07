import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { presignedGetUrl } from "@/lib/r2";
import { formatLongDateTime } from "@/lib/dates";
import { EditionStatus, PhotoStatus } from "@/lib/enums";

// Guest-facing editions overview: the next upcoming edition as a hero, past
// editions in a grid below. Shared by "/" and "/edities".
export async function EditionsOverview() {
  const editions = await prisma.edition.findMany({
    where: { status: EditionStatus.PUBLISHED },
    orderBy: { eventDate: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      eventDate: true,
      location: true,
      coverPhotoId: true,
    },
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Next upcoming = soonest edition with eventDate today or later.
  const upcoming = editions
    .filter((e) => e.eventDate.getTime() >= startOfToday.getTime())
    .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
  const hero = upcoming[0] ?? null;

  const past = editions.filter(
    (e) => e.eventDate.getTime() < startOfToday.getTime()
  );

  // Presign cover thumbnails (server-side) for past editions that have one.
  const coverIds = past
    .map((e) => e.coverPhotoId)
    .filter((id): id is string => Boolean(id));
  const coverPhotos = coverIds.length
    ? await prisma.photo.findMany({
        where: { id: { in: coverIds }, status: PhotoStatus.READY },
        select: { id: true, r2KeyThumb: true },
      })
    : [];
  const coverUrlById = new Map<string, string>();
  await Promise.all(
    coverPhotos.map(async (p) => {
      coverUrlById.set(p.id, await presignedGetUrl(p.r2KeyThumb, 3600));
    })
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
      {/* ---- Next edition ---- */}
      <section>
        <p className="eyebrow">Volgende editie</p>
        {hero ? (
          <div className="mt-5">
            <h1 className="poster-title">{hero.title}</h1>
            <p className="mt-5 text-lg text-secondary">
              {formatLongDateTime(hero.eventDate)}
              {hero.location ? (
                <>
                  <span className="mx-2 text-border">·</span>
                  {hero.location}
                </>
              ) : null}
            </p>
            <div className="mt-8">
              <Link href={`/edities/${hero.slug}`} className={buttonClassName()}>
                Bekijk uitnodiging
              </Link>
            </div>
          </div>
        ) : (
          <p className="mt-5 max-w-xl text-lg text-secondary">
            Er is nog geen volgende editie gepland. Zodra er iets te vieren valt,
            vind je het hier.
          </p>
        )}
      </section>

      {/* ---- Past editions ---- */}
      {past.length > 0 ? (
        <section className="mt-24 border-t border-border pt-12">
          <p className="eyebrow">Eerdere edities</p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((edition) => {
              const coverUrl = edition.coverPhotoId
                ? (coverUrlById.get(edition.coverPhotoId) ?? null)
                : null;
              const year = edition.eventDate.getFullYear();
              return (
                <Link
                  key={edition.id}
                  href={`/edities/${edition.slug}`}
                  className="group block"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
                    {coverUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={coverUrl}
                          alt={`Omslagfoto van ${edition.title}`}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                        {/* Subtle bottom scrim for numeral legibility (per design system). */}
                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
                        <span className="absolute bottom-0 left-0 p-4 font-display text-5xl font-semibold text-white">
                          {year}
                        </span>
                      </>
                    ) : (
                      <span className="absolute bottom-0 left-0 p-4 font-display text-5xl font-semibold text-muted transition-colors group-hover:text-secondary">
                        {year}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 font-display text-lg font-semibold text-foreground">
                    {edition.title}
                  </h2>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

    </div>
  );
}
