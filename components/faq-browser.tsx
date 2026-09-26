"use client";

import Link from "next/link";
import { useState } from "react";
import type { FaqSection } from "@/lib/faq";

function matches(text: string, words: string[]) {
  const haystack = text.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/** Topic list, search and open/close questions. Content comes from lib/faq.ts. */
export function FaqBrowser({ sections, openId }: { sections: FaqSection[]; openId?: string }) {
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const visible = sections
    .map((section) => ({ ...section, items: words.length ? section.items.filter((item) => matches(`${item.q} ${item.a}`, words)) : section.items }))
    .filter((section) => section.items.length);

  return (
    <>
      <div className="-mx-4 -mt-6 space-y-3 border-b border-line bg-tint px-4 pt-6 pb-5 md:mx-0 md:mt-0 md:rounded-2xl md:border md:p-10">
        <p className="eyebrow">Help</p>
        <h1 className="page-title">How Pickle Rating works</h1>
        <p className="max-w-2xl text-ink-2">Quick answers about ratings, matches, clubs and tournaments. Can&apos;t find yours? <Link href="/feedback" className="link">Send us feedback</Link>.</p>
        <label className="sr-only" htmlFor="faq-search">Search the questions</label>
        <input
          id="faq-search"
          type="search"
          className="input max-w-xl"
          placeholder="Search the questions, e.g. provisional"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <nav aria-label="Topics" className="-mx-4 flex gap-2 overflow-x-auto px-4 pt-5 pb-1 [scrollbar-width:none] md:hidden">
        {sections.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="grid min-h-11 shrink-0 place-items-center rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold">{section.title}</a>
        ))}
      </nav>

      <div className="mt-6 grid grid-cols-1 gap-10 md:mt-9 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
        <aside className="hidden space-y-1 md:sticky md:top-24 md:block">
          <p className="mb-2 text-xs font-bold tracking-wide text-ink-3 uppercase">Topics</p>
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="block rounded-xl px-3.5 py-2.5 font-semibold text-ink-2 hover:bg-surface hover:text-ink">{section.title}</a>
          ))}
          <div className="mt-5 space-y-2.5 rounded-2xl bg-brand p-4 text-brand-ink">
            <p className="font-bold">Still stuck?</p>
            <p className="text-sm text-brand-ink-2">Tell us what happened and the team will look into it.</p>
            <Link href="/feedback" className="btn-accent w-full">Send feedback</Link>
          </div>
        </aside>

        <div className="space-y-9">
          {visible.length === 0 && (
            <p className="muted">No questions match &ldquo;{query}&rdquo;. Try another word, or <Link href="/feedback" className="link">ask us directly</Link>.</p>
          )}
          {visible.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 space-y-2.5">
              <h2 className="font-display text-2xl font-extrabold">{section.title}</h2>
              {section.items.map((item) => (
                <details key={item.id} id={item.id} open={words.length > 0 || item.id === openId} className="group scroll-mt-24 rounded-2xl border border-line bg-surface">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[17px] font-bold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <svg className="size-5 shrink-0 text-ink-3 transition group-open:rotate-180 group-open:text-link" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                  </summary>
                  <div className="space-y-3 px-5 pb-5 leading-relaxed text-ink-2">
                    <p>{item.a}</p>
                    {item.facts && (
                      <div className="grid gap-2.5 sm:grid-cols-3">
                        {item.facts.map((fact) => (
                          <div key={fact.title} className="rounded-xl bg-surface-2 p-3.5">
                            <p className="font-display text-xl font-extrabold text-ink">{fact.title}</p>
                            <p className="text-[13px] leading-snug">{fact.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {item.link && <Link href={item.link.href} className="link inline-block">{item.link.label} →</Link>}
                  </div>
                </details>
              ))}
            </section>
          ))}
          <div className="rounded-2xl bg-brand p-5 text-brand-ink md:hidden">
            <p className="font-bold">Still stuck?</p>
            <p className="mt-1 text-sm text-brand-ink-2">The team reads every message.</p>
            <Link href="/feedback" className="btn-accent mt-3 w-full">Send feedback</Link>
          </div>
        </div>
      </div>
    </>
  );
}
