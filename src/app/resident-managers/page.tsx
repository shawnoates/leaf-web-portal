import Header from "./components/Header";
import Hero from "./components/Hero";
import Stakes from "./components/Stakes";
import Insight from "./components/Insight";
import Human from "./components/Human";
import HowItWorks from "./components/HowItWorks";
import Proof from "./components/Proof";
import Objections from "./components/Objections";
import TwoWays from "./components/TwoWays";
import { FinalCta, Footer } from "./components/FinalCta";

export default function ResidentManagersPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Stakes />
        <Insight />
        <Human />
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
