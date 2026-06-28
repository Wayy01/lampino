import type { Metadata } from "next";
import { AboutContent } from "@/components/site/about-content";

export const metadata: Metadata = {
  title: "How it works — Atelier",
  description:
    "We broker the drive. The middle-man between you and Italy's best rental companies, for the best price.",
};

export default function AboutPage() {
  return <AboutContent />;
}
