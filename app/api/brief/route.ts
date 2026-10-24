import { legislation, lookupZip, nearby, organizations, senators, stateOfficials } from "@/lib/brief/data";
import { unsupportedZipReason } from "@/lib/brief/helpers";
import type { Brief, Section } from "@/lib/brief/types";

const RADII = [10, 25, 50, 100];

// Each section loads independently: one source failing becomes a coverage note
// in that section, never an error page and never an empty list that reads like
// "nothing found".
function settled<T>(result: PromiseSettledResult<Section<T>>, failureNote: string): Section<T> {
  if (result.status === "fulfilled") return result.value;
  console.error("[brief]", failureNote, result.reason);
  return { items: [], available: false, note: failureNote };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const zip = (params.get("zip") ?? "").trim();
  const radius = Number(params.get("radius") ?? "25");
  if (!/^\d{5}$/.test(zip) || !RADII.includes(radius)) {
    return Response.json({ error: "Enter a five-digit U.S. ZIP code and choose a radius." }, { status: 400 });
  }

  const unsupported = unsupportedZipReason(zip);
  if (unsupported) {
    return Response.json({ error: unsupported }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }

  let place;
  try {
    place = await lookupZip(zip);
  } catch (error) {
    const notFound = error instanceof Error && error.message === "NOT_FOUND";
    return Response.json(
      {
        error: notFound
          ? "That ZIP code was not found. Check the five digits and try again."
          : "ZIP lookup is temporarily unavailable. Please try again.",
      },
      { status: notFound ? 404 : 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const [facilities, bills, federal, state, orgs] = await Promise.allSettled([
    nearby(place, radius),
    legislation(place),
    senators(place.state),
    stateOfficials(place),
    organizations(place),
  ]);

  const officialItems = [
    ...(federal.status === "fulfilled" ? federal.value : []),
    ...(state.status === "fulfilled" ? state.value : []),
  ];
  const stateLookupConnected = state.status === "fulfilled" && state.value.length > 0;

  const brief: Brief = {
    place,
    radius,
    generatedAt: new Date().toISOString(),
    facilities: settled(
      facilities,
      "Facility records could not be loaded. This is not a finding that no facilities exist."
    ),
    bills: settled(bills, "Legislative records could not be loaded. Check the state bill search for current information."),
    officials: {
      items: officialItems,
      available: federal.status === "fulfilled" || stateLookupConnected,
      note: [
        place.state === "DC" || place.state === "PR"
          ? `${place.stateName} has no U.S. senators, and its member of the U.S. House can't vote on final passage of bills.`
          : federal.status === "fulfilled"
            ? "U.S. senators come from the Senate's directory."
            : "The Senate directory couldn't be reached right now.",
        stateLookupConnected
          ? "Other legislators are matched from Open States using one point in your ZIP code, which can fall in a different district than your home. Confirm with your street address on the official lookup sites."
          : "State legislators aren't available right now. Use the official lookup sites below with your street address.",
      ].join(" "),
    },
    organizations: settled(orgs, "The organization directory could not be loaded right now."),
  };

  return Response.json(brief, { headers: { "Cache-Control": "no-store" } });
}
