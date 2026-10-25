import type { Metadata } from "next";
import MapView from "@/components/map/MapView";

export const metadata: Metadata = {
  title: "Data center buildout map",
  description:
    "Operating, under-construction, and proposed US data center facilities, with water stress, drought, grid carbon, and electricity price context.",
};

export default function MapPage() {
  return (
    // The page title lives in the nav (components/SiteNav.tsx) so the map gets
    // the full height; the "can't trace a request" disclaimer is in the map key.
    <main className="h-full">
      <MapView />
    </main>
  );
}
