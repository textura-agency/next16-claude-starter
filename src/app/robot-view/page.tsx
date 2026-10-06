import { HomeView } from "@/views/home";

/**
 * The home page as robots get it — reached only through the proxy's rewrite of
 * `/` (`src/proxy.ts`). Inherits the root metadata, so its canonical is `/`: a
 * crawler indexing the home page reads this document under the home page's URL.
 * Never `noindex` it. If `app/page.tsx` ever exports its own `metadata`, export
 * the same object here.
 */
export default function RobotHome() {
  return <HomeView robot />;
}
