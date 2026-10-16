import type { Metadata } from "next";
import Simulator from "@/components/simulator/Simulator";
import { parseScenarioParams } from "@/lib/simulator/params";

export const metadata: Metadata = {
  title: "Siting simulator",
  description:
    "Site a hypothetical data center and see how cooling, power source, and location trade water against electricity and emissions.",
};

// Reads the scenario from the URL (the map's "model this site" link, or a
// shared link) on the server, so the first render already has the right
// inputs. Everything after that is client-side.
export default async function SimulatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initial = parseScenarioParams(await searchParams);
  return <Simulator initial={initial} />;
}
