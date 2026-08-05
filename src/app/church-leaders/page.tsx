import Header from "./components/Header";
import Hero from "./components/Hero";
import Difference from "./components/Difference";
import Posts from "./components/Posts";
import Control from "./components/Control";
import WhyItMatters from "./components/WhyItMatters";
import Start from "./components/Start";
import Faq from "./components/Faq";
import { FinalCta, Footer } from "./components/FinalCta";

export default function ChurchLeadersPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Difference />
        <Posts />
        <Control />
        <WhyItMatters />
        <Start />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
