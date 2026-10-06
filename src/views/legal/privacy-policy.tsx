import type { Metadata } from "next";

import { LEGAL_UPDATED, privacyPolicy } from "@/data/mocks/legal";
import { siteConfig } from "@/lib/site";
import { generateMetadata } from "@/utils/seo/generate-page-metadata";

import { LegalDocument } from "./legal-document";

export const privacyPolicyMetadata: Metadata = generateMetadata({
  title: privacyPolicy.title,
  description: privacyPolicy.intro,
  url: "/privacy-policy",
});

export const PrivacyPolicyView = () => (
  <LegalDocument
    {...privacyPolicy}
    updated={LEGAL_UPDATED}
    home={siteConfig.name}
  />
);
