import Header from "./components/Header";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import Looking from "./components/Looking";
import Pay from "./components/Pay";
import Register from "./components/Register";
import Faq from "./components/Faq";
import { FinalCta, Footer } from "./components/FinalCta";

export default function CreatorsPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Looking />
        <Pay />
        <Register />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
