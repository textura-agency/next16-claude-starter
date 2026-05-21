import type { Metadata } from "next";
import { Onest } from "next/font/google";

import { generateMetadata } from "@/utils/seo/generate-page-metadata";

import { LazyCookie } from "@/components/common/Cookie";
import { ScrollLayout } from "@/layouts/scroll-layout";

import "@/app/globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
});

export const metadata: Metadata = generateMetadata({
  title: "New Project",
  description: "New Project",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${onest.variable}`}>
        <ScrollLayout>
          <LazyCookie />
          {children}
        </ScrollLayout>
      </body>
    </html>
  );
}
