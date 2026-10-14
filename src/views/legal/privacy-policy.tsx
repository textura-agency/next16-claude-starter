import type { Metadata } from "next";

import { LEGAL_UPDATED, privacyPolicy } from "@/data/mocks/legal";
import { JsonLd } from "@/components/common/json-ld";
import { siteConfig } from "@/lib/site";
import { generateMetadata } from "@/utils/seo/generate-page-metadata";
import {
  getBreadcrumbStructuredData,
  jsonLdGraph,
} from "@/utils/seo/structured-data";

import { LegalDocument } from "./legal-document";

const PATH = "/privacy-policy";
const breadcrumb = getBreadcrumbStructuredData(PATH);

export const privacyPolicyMetadata: Metadata = generateMetadata({
  title: privacyPolicy.title,
  description: privacyPolicy.intro,
  url: PATH,
});

export const PrivacyPolicyView = () => (
  <>
    {breadcrumb && <JsonLd data={jsonLdGraph(breadcrumb)} />}
    <LegalDocument
      {...privacyPolicy}
      updated={LEGAL_UPDATED}
      home={siteConfig.name}
    />
  </>
);
