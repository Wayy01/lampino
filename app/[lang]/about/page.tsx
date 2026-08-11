import type { Metadata } from "next";
import { AboutContent } from "@/components/site/about-content";

export const metadata: Metadata = {
  title: "Despre noi — Lampino",
  description:
    "Aducem lumina bună la tine acasă: becuri și corpuri de iluminat alese cu grijă, preț corect și livrare rapidă.",
};

export default function AboutPage() {
  return <AboutContent />;
}
