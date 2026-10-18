import { COUNTRIES } from "@/lib/location/countries";

type Location = { longitude: number; latitude: number; label: string };
const cache = new Map<string, { expires: number; location: Location }>();
let lastLookup = 0;
const normalize = (value: string) => value.normalize("NFKC").toUpperCase().replace(/[\s-]/g, "");

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("zip") ?? "").normalize("NFKC").trim();
  const country = (params.get("country") ?? "US").toUpperCase();
  const kind = params.get("kind") ?? "postcode";
  if (!COUNTRIES.some(({ code }) => code === country) || !["postcode", "city"].includes(kind)) {
    return Response.json({ error: "Choose a country and search type." }, { status: 400 });
  }
  if (!query || query.length > (kind === "postcode" ? 32 : 100) ||
      (kind === "postcode" && !/^[\p{L}\p{N}\s-]+$/u.test(query))) {
    return Response.json({ error: kind === "postcode" ? "Enter a valid postal code." : "Enter a city or town." }, { status: 400 });
  }
  const key = `${country}:${kind}:${normalize(query)}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return Response.json(cached.location);
  // Bound traffic from this local server; searches happen only on submission.
  if (Date.now() - lastLookup < 1000) {
    return Response.json({ error: "Please wait a moment and search again." }, {
      status: 429, headers: { "Retry-After": "1", "Cache-Control": "no-store" },
    });
  }
  lastLookup = Date.now();
  try {
    const url = new URL(process.env.PHOTON_SEARCH_URL || "https://photon.komoot.io/structured");
    url.search = new URLSearchParams({ [kind]: query, countrycode: country, limit: "5", lang: "en" }).toString();
    const response = await fetch(url, {
      // The public geocoder can take more than ten seconds for valid searches.
      signal: AbortSignal.timeout(30000),
      headers: { "User-Agent": "SITED-Map/0.1 (postal-code lookup)" },
    });
    if (!response.ok) throw new Error("Location lookup unavailable");
    const data = await response.json();
    if (!Array.isArray(data.features)) throw new Error("Invalid location response");
    const place = data.features.find((feature: GeoJSON.Feature) => {
      const props = feature.properties;
      if (props?.countrycode?.toUpperCase() !== country) return false;
      if (kind === "city") return true;
      const postcode = props.postcode ?? (props.osm_value === "postcode" ? props.name : "");
      return typeof postcode === "string" && normalize(postcode) === normalize(query);
    });
    if (!place) {
      return Response.json({ error: kind === "postcode"
        ? "No match in this country. Check the code, or try searching by city."
        : "City not found in this country. Try another spelling or nearby town."
      }, { status: 404 });
    }
    const [longitude, latitude] = place.geometry?.coordinates ?? [];
    if (place.geometry?.type !== "Point" || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error("Invalid coordinates");
    const props = place.properties;
    const label = [...new Set([
      kind === "postcode" ? query.toUpperCase() : props.name,
      props.city || props.district, props.state, props.country,
    ].filter((part): part is string => typeof part === "string" && !!part))].join(", ");
    const location = { longitude, latitude, label };
    if (cache.size >= 500) cache.delete(cache.keys().next().value!);
    cache.set(key, { location, expires: Date.now() + 86_400_000 });
    return Response.json(location);
  } catch {
    return Response.json({ error: "Location search is temporarily unavailable. Please try again." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
