import { prisma } from "@/lib/prisma";

export type RsvpRow = {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  attending: boolean | null; // null = no answer yet
  guestCount: number;
  note: string | null;
  updatedAt: Date | null;
};

// All users joined with their RSVP (if any) for one edition.
export async function loadRsvpRows(editionId: string): Promise<RsvpRow[]> {
  const [users, rsvps] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
    prisma.rsvp.findMany({
      where: { editionId },
      select: {
        userId: true,
        attending: true,
        guestCount: true,
        note: true,
        updatedAt: true,
      },
    }),
  ]);

  const byUser = new Map(rsvps.map((r) => [r.userId, r]));
  return users.map((u) => {
    const r = byUser.get(u.id);
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      attending: r ? r.attending : null,
      guestCount: r?.guestCount ?? 0,
      note: r?.note ?? null,
      updatedAt: r?.updatedAt ?? null,
    };
  });
}

export type RsvpSummary = {
  yes: number;
  guests: number;
  total: number;
  no: number;
  noAnswer: number;
};

export function summarize(rows: RsvpRow[]): RsvpSummary {
  let yes = 0;
  let guests = 0;
  let no = 0;
  let noAnswer = 0;
  for (const r of rows) {
    if (r.attending === true) {
      yes += 1;
      guests += r.guestCount;
    } else if (r.attending === false) {
      no += 1;
    } else {
      noAnswer += 1;
    }
  }
  return { yes, guests, total: yes + guests, no, noAnswer };
}
