import type { Metadata } from "next";
import { FaqBrowser } from "@/components/faq-browser";
import { FAQ } from "@/lib/faq";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description: "How Pickle Rating's ratings, matches, clubs and tournaments work.",
};

export default async function HelpPage({ searchParams }: PageProps<"/help">) {
  const open = (await searchParams).open;
  return <FaqBrowser sections={FAQ} openId={typeof open === "string" ? open : undefined} />;
}
