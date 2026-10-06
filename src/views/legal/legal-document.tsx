/**
 * The shared shape of a legal page.
 *
 * A Server Component with no motion: these pages are read, not experienced,
 * and every spring here would be hydration cost spent on a document. Plain
 * semantic markup, one `<h1>`, a clean heading outline. It is taller than the
 * viewport — the body's `justify-content: safe center` keeps its top in reach.
 */
import Link from "next/link";

export interface LegalSection {
  heading: string;
  /** Each entry is a paragraph. */
  body: readonly string[];
}

export interface LegalDocumentProps {
  title: string;
  /** Shown under the title, e.g. "Last updated 6 October 2026". */
  updated: string;
  intro: string;
  sections: readonly LegalSection[];
  /** The back link's label — the brand. */
  home: string;
}

export const LegalDocument = ({
  title,
  updated,
  intro,
  sections,
  home,
}: LegalDocumentProps) => (
  <div className="min-h-lvh w-full bg-background font-sans text-foreground">
    <header className="mx-auto w-full max-w-[48rem] px-4 pb-8 pt-24 md:px-6 md:pt-28 xl:px-8">
      <Link
        href="/"
        className="underline underline-offset-4 transition-opacity duration-[var(--duration-fast)] ease-entrance hover:opacity-70 focus-visible:opacity-70"
      >
        ← {home}
      </Link>
      <h1 className="mt-6 text-4xl font-medium leading-display">{title}</h1>
      <p className="mt-3 opacity-80">{updated}</p>
      <p className="mt-6">{intro}</p>
    </header>

    <main className="mx-auto w-full max-w-[48rem] px-4 pb-24 md:px-6 xl:px-8">
      {sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2 className="text-2xl font-medium leading-display">
            {section.heading}
          </h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="mt-3 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </main>
  </div>
);
