/**
 * @fileoverview JSON-LD structured data helpers.
 * 📖 Docs: obsidian/frontend/seo-metadata.md · skill: schema-markup
 *
 * Structured data lets search and answer engines read the site as entities
 * (an Organization, its WebSite, a page's place in the site, an article and
 * its author) rather than only as text. Every builder here returns a node;
 * `jsonLdGraph()` wraps nodes into one document, `<JsonLd>`
 * (`src/components/common/json-ld.tsx`) renders it. Entities link by `@id`, so
 * the Organization is defined once (root layout) and referenced everywhere.
 *
 * Only describe what is on the page — schema claiming content the page does
 * not show is spam. Check Google's supported-features gallery before adding a
 * type for a rich result: FAQ (May 2026), HowTo (2023) and the sitelinks
 * search box (2024) no longer show any.
 */

import { routeTrail } from "@/lib/routes";
import { siteConfig, type OpeningHours } from "@/lib/site";

/** A JSON value a JSON-LD node may hold. */
export type JsonLdValue =
  | string
  | number
  | boolean
  | JsonLdNode
  | readonly JsonLdValue[];

/** One JSON-LD node — `@type` plus its properties. */
export interface JsonLdNode {
  [property: string]: JsonLdValue;
}

/** A path under `public/`, or a page path, becomes an absolute URL on the site's origin. */
export const absoluteUrl = (url: string): string =>
  url.startsWith("/") ? `${siteConfig.url}${url === "/" ? "" : url}` : url;

/** The `@id` of the site's Organization and WebSite nodes — reference them, don't repeat them. */
export const ORGANIZATION_ID = `${siteConfig.url}/#organization`;
export const WEBSITE_ID = `${siteConfig.url}/#website`;

/** Wraps nodes into one JSON-LD document. */
export const jsonLdGraph = (...nodes: JsonLdNode[]): JsonLdNode => ({
  "@context": "https://schema.org",
  "@graph": nodes,
});

/** Overrides — a CMS's SEO global passes these; `siteConfig` fills the rest. */
export interface StructuredDataInput {
  /** The organisation's and the site's name — `og:site_name`'s twin. */
  name?: string;
  /** The legal name — the author/publisher the metadata carries. */
  legalName?: string;
  description?: string;
  /** The logo — a path under `public/` or an absolute URL. */
  logo?: string;
  /** The company's profiles elsewhere — `sameAs`. */
  sameAs?: readonly string[];
  /**
   * The schema.org type: `Organization`, or a `LocalBusiness` subtype
   * (`ProfessionalService`, `Restaurant`, `Dentist`…) for a business with a
   * place customers visit or an area it serves — then set the address.
   */
  type?: string;
}

/** Opening hours as schema.org `OpeningHoursSpecification` rows. */
const openingHoursSpecification = (rows: readonly OpeningHours[]): JsonLdNode[] =>
  rows.map(({ days, opens, closes }) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: [...days],
    opens,
    closes,
  }));

/** The LocalBusiness-only facts that are set — hours, coordinates, price range. */
const localFacts = ({
  openingHours = [],
  geo,
  priceRange,
}: {
  openingHours?: readonly OpeningHours[];
  geo?: { latitude: number; longitude: number };
  priceRange?: string;
}): JsonLdNode => ({
  ...(openingHours.length > 0
    ? { openingHoursSpecification: openingHoursSpecification(openingHours) }
    : {}),
  ...(geo ? { geo: { "@type": "GeoCoordinates", ...geo } } : {}),
  ...(priceRange ? { priceRange } : {}),
});

/**
 * Organization + WebSite schema for the site root. Emit once, in the root
 * layout. The two nodes are linked by `@id` so crawlers treat them as related.
 * The facts come from `siteConfig.organization` — only the ones that are set.
 */
export function getSiteStructuredData({
  name = siteConfig.name,
  legalName = siteConfig.author,
  description = siteConfig.description,
  logo = "/android-icon-192x192.png",
  sameAs = siteConfig.organization.sameAs,
  type = "Organization",
}: StructuredDataInput = {}): JsonLdNode {
  const { foundingDate, email, telephone, address, areaServed, hasMap } =
    siteConfig.organization;
  const local = type !== "Organization";
  return jsonLdGraph(
    {
      "@type": type,
      "@id": ORGANIZATION_ID,
      name,
      ...(legalName && legalName !== name ? { legalName } : {}),
      description,
      url: siteConfig.url,
      logo: absoluteUrl(logo),
      // A LocalBusiness also wants an image; the logo is the honest default.
      ...(type !== "Organization" ? { image: absoluteUrl(logo) } : {}),
      ...(foundingDate ? { foundingDate } : {}),
      ...(email ? { email } : {}),
      ...(telephone ? { telephone } : {}),
      ...(address ? { address: { "@type": "PostalAddress", ...address } } : {}),
      ...(email || telephone
        ? {
            contactPoint: {
              "@type": "ContactPoint",
              contactType: "customer service",
              ...(email ? { email } : {}),
              ...(telephone ? { telephone } : {}),
            },
          }
        : {}),
      ...(sameAs.length > 0 ? { sameAs: [...sameAs] } : {}),
      ...(areaServed.length > 0 ? { areaServed: [...areaServed] } : {}),
      ...(hasMap ? { hasMap } : {}),
      // Hours, coordinates and price range are LocalBusiness properties.
      ...(local ? localFacts(siteConfig.organization) : {}),
    },
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      name,
      description,
      url: siteConfig.url,
      inLanguage: siteConfig.locale.replace("_", "-"),
      publisher: { "@id": ORGANIZATION_ID },
    },
  );
}

/**
 * Home → … → the page, from the route registry's `parent` chain
 * (`src/lib/routes.ts`). `null` for the home page (a one-item trail says
 * nothing) and for a path the registry doesn't know.
 */
export function getBreadcrumbStructuredData(path: string): JsonLdNode | null {
  const trail = routeTrail(path);
  if (trail.length < 2) return null;
  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(path)}#breadcrumb`,
    itemListElement: trail.map((route, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: route.label,
      item: absoluteUrl(route.path),
    })),
  };
}

/** A person — an article's author, a team member. */
export interface PersonInput {
  name: string;
  /** Their page on this site, or a profile that is clearly theirs. */
  url?: string;
  jobTitle?: string;
  image?: string;
  /** Their profiles elsewhere (LinkedIn…). */
  sameAs?: readonly string[];
}

export const getPersonStructuredData = ({
  name,
  url,
  jobTitle,
  image,
  sameAs = [],
}: PersonInput): JsonLdNode => ({
  "@type": "Person",
  name,
  ...(url ? { url: absoluteUrl(url) } : {}),
  ...(jobTitle ? { jobTitle } : {}),
  ...(image ? { image: absoluteUrl(image) } : {}),
  ...(sameAs.length > 0 ? { sameAs: [...sameAs] } : {}),
  worksFor: { "@id": ORGANIZATION_ID },
});

export interface ArticleInput {
  /** The article's path, e.g. `/journal/how-we-work`. */
  path: string;
  /** The visible headline — the page's `<h1>`. */
  headline: string;
  description: string;
  /** At least one image, path or URL — Google requires it. */
  image: string;
  /** `YYYY-MM-DD` (or full ISO) — shown on the page too. */
  datePublished: string;
  /** The last real edit — shown on the page as "Updated …". */
  dateModified?: string;
  author: PersonInput;
  /** `BlogPosting` for a blog, `NewsArticle` for news; `Article` otherwise. */
  type?: "Article" | "BlogPosting" | "NewsArticle";
}

/** An article or blog post — author, dates and publisher are what answer engines weigh. */
export const getArticleStructuredData = ({
  path,
  headline,
  description,
  image,
  datePublished,
  dateModified,
  author,
  type = "BlogPosting",
}: ArticleInput): JsonLdNode => ({
  "@type": type,
  "@id": `${absoluteUrl(path)}#article`,
  headline,
  description,
  image: [absoluteUrl(image)],
  datePublished,
  dateModified: dateModified ?? datePublished,
  author: getPersonStructuredData(author),
  publisher: { "@id": ORGANIZATION_ID },
  mainEntityOfPage: absoluteUrl(path),
  inLanguage: siteConfig.locale.replace("_", "-"),
});

export interface ServiceInput {
  /** The service page's path. */
  path: string;
  name: string;
  description: string;
  /** The category of service, in searchers' words ("Brand identity design"). */
  serviceType?: string;
  /** Where it is offered — a city, region or country name. */
  areaServed?: string | readonly string[];
}

/** A service the organisation offers — one per service page. */
export const getServiceStructuredData = ({
  path,
  name,
  description,
  serviceType,
  areaServed,
}: ServiceInput): JsonLdNode => ({
  "@type": "Service",
  "@id": `${absoluteUrl(path)}#service`,
  name,
  description,
  url: absoluteUrl(path),
  ...(serviceType ? { serviceType } : {}),
  ...(areaServed ? { areaServed: typeof areaServed === "string" ? areaServed : [...areaServed] } : {}),
  provider: { "@id": ORGANIZATION_ID },
});

export interface FaqItem {
  question: string;
  /** Plain text — the answer exactly as the page shows it. */
  answer: string;
}

/**
 * A visible FAQ section. Google no longer shows FAQ rich results (May 2026),
 * so this is for answer engines and for describing the page — never for
 * questions the page doesn't show.
 */
export const getFaqStructuredData = (
  path: string,
  items: readonly FaqItem[],
): JsonLdNode => ({
  "@type": "FAQPage",
  "@id": `${absoluteUrl(path)}#faq`,
  mainEntity: items.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
});

export interface LocalBusinessInput {
  /** The location page's path, e.g. `/locations/leeds`. */
  path: string;
  /** The location's name as its Business Profile writes it ("Acme Leeds"). */
  name: string;
  /** Required — a location without an address is a service area, not a place. */
  address: NonNullable<typeof siteConfig.organization.address>;
  telephone?: string;
  email?: string;
  geo?: { latitude: number; longitude: number };
  openingHours?: readonly OpeningHours[];
  priceRange?: string;
  /** A photo of this location — path or URL. Falls back to the site's logo. */
  image?: string;
  /** This location's Google Business Profile / Maps listing. */
  hasMap?: string;
  /** A LocalBusiness subtype — `Dentist`, `Restaurant`, `ProfessionalService`… */
  type?: string;
}

/**
 * One location of a multi-location business — emit on that location's page.
 * Its own `@id`, tied to the brand by `parentOrganization`. Every value must
 * match the location's Business Profile (skill: local-seo).
 */
export const getLocalBusinessStructuredData = ({
  path,
  name,
  address,
  telephone,
  email,
  geo,
  openingHours,
  priceRange,
  image = "/android-icon-192x192.png",
  hasMap,
  type = "LocalBusiness",
}: LocalBusinessInput): JsonLdNode => ({
  "@type": type,
  "@id": `${absoluteUrl(path)}#location`,
  name,
  url: absoluteUrl(path),
  image: absoluteUrl(image),
  address: { "@type": "PostalAddress", ...address },
  ...(telephone ? { telephone } : {}),
  ...(email ? { email } : {}),
  ...localFacts({ openingHours, geo, priceRange }),
  ...(hasMap ? { hasMap } : {}),
  parentOrganization: { "@id": ORGANIZATION_ID },
});
