import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { EditionsOverview } from "@/components/editions-overview";

export const metadata: Metadata = {
  title: "Edities — White Party",
};

// Same overview as the home page, reachable via the header "Edities" link.
export default async function EditionsPage() {
  await requireUser();
  return <EditionsOverview />;
}
