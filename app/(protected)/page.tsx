import { requireUser } from "@/lib/auth";
import { EditionsOverview } from "@/components/editions-overview";

// Home / — the editions overview for logged-in guests.
export default async function HomePage() {
  await requireUser();
  return <EditionsOverview />;
}
