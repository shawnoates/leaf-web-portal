import { redirect } from "next/navigation";

// Terms of Use.
//
// Live copy currently lives at joinleaf.com/terms-conditions. We plan to
// migrate that into this repo alongside /privacy so joinleaf.com can
// point at os.joinleaf.com. Until then, every internal link uses `/terms`
// and hits this redirect — so when the migration lands you only need to
// replace the redirect body with real content and every SignInModal,
// footer, and setup-page link picks it up automatically.
export default function TermsPage() {
  redirect("https://www.joinleaf.com/terms-conditions");
}
