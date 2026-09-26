import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { THEME_SCRIPT } from "@/components/theme-toggle";
import { getSupabaseConfig } from "@/lib/supabase/config";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["600", "800"] });

export const metadata: Metadata = {
  title: { default: "Pickle Rating: Philippine pickleball rankings", template: "%s · Pickle Rating" },
  description: "Pickleball ratings for the Philippines, calculated from confirmed matches. No DUPR needed.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1b2a4a" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1422" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script adds the `dark` class before React hydrates.
    <html lang="en" className={`${figtree.variable} ${bricolage.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-ground font-sans text-ink">
        {getSupabaseConfig() ? (
          <>
            <SiteHeader />
            <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-12 md:px-8 md:pt-10 md:pb-16">{children}</main>
            <SiteFooter />
          </>
        ) : (
          <main className="mx-auto max-w-xl px-4 py-16">
            <h1 className="page-title">Almost ready</h1>
            <p className="mt-3 text-ink-2">
              Pickle Rating needs its Supabase project. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> (locally in <code>.env.local</code>, on Vercel in the project&apos;s
              Environment Variables), then reload. The README has the full steps.
            </p>
          </main>
        )}
      </body>
    </html>
  );
}
