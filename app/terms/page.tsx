import type { Metadata } from "next";
import { LegalContent } from "@/components/site/legal-content";

export const metadata: Metadata = {
  title: "Terms — Atelier",
  description:
    "The terms of service for booking a premium rental through Atelier, Italy's car rental brokerage.",
};

export default function TermsPage() {
  return <LegalContent section="terms" />;
}
