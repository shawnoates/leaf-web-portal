import Header from "./components/Header";
import Hero from "./components/Hero";
import Opportunity from "./components/Opportunity";
import Insight from "./components/Insight";
import Offer from "./components/Offer";
import HowItWorks from "./components/HowItWorks";
import Proof from "./components/Proof";
import Objections from "./components/Objections";
import TwoWays from "./components/TwoWays";
import { FinalCta, Footer } from "./components/FinalCta";

export default function PartnersPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Opportunity />
        <Insight />
        <Offer />
        <HowItWorks />
        <Proof />
        <Objections />
        <TwoWays />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
