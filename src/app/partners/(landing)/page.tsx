import Header from "./components/Header";
import Hero from "./components/Hero";
import Opportunity from "./components/Opportunity";
import Insight from "./components/Insight";
import Offer from "./components/Offer";
import HowItWorks from "./components/HowItWorks";
import Proof from "./components/Proof";
import Objections from "./components/Objections";
import { FinalCta, Footer } from "./components/FinalCta";
import type { Metadata } from "next";
import { COPY, kindOf } from "./components/copy";

const TITLES = {
  bar: "Leaf Partners: neighbors in your slowest hours",
  shop: "Leaf Partners: an evening for neighbors in your shop",
  studio: "Leaf Partners: a taster class for your neighbors",
} as const;

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ for?: string | string[] }> }): Promise<Metadata> {
  const kind = kindOf((await searchParams).for);
  return { title: TITLES[kind], description: COPY[kind].heroLead };
}

/** ?for=shop or ?for=studio shows that version (a rep's claim email links to it); bars by default. */
export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ for?: string | string[] }> }) {
  const kind = kindOf((await searchParams).for);
  return (
    <div className="pl">
      <Header kind={kind} />
      <main>
        <Hero kind={kind} />
        <Opportunity />
        <Insight kind={kind} />
        <HowItWorks kind={kind} />
        <Offer kind={kind} />
        <Proof />
        <Objections kind={kind} />
        <FinalCta kind={kind} />
      </main>
      <Footer />
    </div>
  );
}
