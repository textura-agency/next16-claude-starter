/**
 * Copy for the privacy policy the cookie banner and its preferences modal link
 * to (`/privacy-policy`).
 *
 * ⚠️ TODO(legal): generic boilerplate, not legal advice. It exists so the link
 * resolves — a linked page that 404s is a broken promise in the consent flow,
 * a console error on every page (`<Link>` prefetches it: Best Practices < 100)
 * and a crawl error. Say what this site really collects, add the contact line,
 * have counsel review it before launch, and keep `LEGAL_UPDATED` honest.
 */
import type { LegalSection } from "@/views/legal/legal-document";

export const LEGAL_UPDATED = "Last updated TODO: date";

export const privacyPolicy: {
  title: string;
  intro: string;
  sections: readonly LegalSection[];
} = {
  title: "Privacy Policy",
  intro:
    "This policy explains what we collect when you use this website, why we collect it, and the choices you have.",
  sections: [
    {
      heading: "What we collect",
      body: [
        "TODO: what the site's forms collect — e.g. when you send an enquiry we receive the name, email address and message you choose to give us.",
        "Like most websites, our hosting provider records standard technical information with each request — IP address, browser and device type, and the pages requested. This is used to keep the site running and secure.",
      ],
    },
    {
      heading: "Cookies and analytics",
      body: [
        "The site sets only the cookies needed to remember your cookie choices. Any analytics or marketing cookies are off until you accept them, and you can change your decision at any time through the cookie preferences on this site.",
      ],
    },
    {
      heading: "How we use it",
      body: [
        "We use what you send us to answer you. We do not sell your information, and we do not use it for unrelated marketing without asking first.",
      ],
    },
    {
      heading: "How long we keep it",
      body: [
        "We keep what you send us for as long as we need it to answer you and to meet our legal obligations, then delete it.",
      ],
    },
    {
      heading: "Your rights",
      body: [
        "You can ask us for a copy of what we hold about you, ask us to correct it, or ask us to delete it. Use the contact details on this site and we will respond.",
      ],
    },
  ],
};
