import Header from "./components/Header";
import Hero from "./components/Hero";
import Opportunity from "./components/Opportunity";
import Insight from "./components/Insight";
import Offer from "./components/Offer";
import HowItWorks from "./components/HowItWorks";
import Proof from "./components/Proof";
import Objections from "./components/Objections";
import { FinalCta, Footer } from "./components/FinalCta";

export default function PartnersPage() {
  return (
    <div className="pl">
      <Header />
      <main>
        <Hero />
        <Opportunity />
        <Insight />
        <HowItWorks />
        <Offer />
        <Proof />
        <Objections />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
