// Parser for the Census Gazetteer ZCTA file: tab-separated, with trailing
// padding on the last header field ("INTPTLONG     "). Kept separate from the
// ingest script so it's unit-testable without network or database access.
export function parseGazetteer(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = lines[0].replace(/^﻿/, "").split("\t").map((h) => h.trim());
  const iZip = header.indexOf("GEOID");
  const iLat = header.indexOf("INTPTLAT");
  const iLon = header.indexOf("INTPTLONG");
  if (iZip === -1 || iLat === -1 || iLon === -1) {
    throw new Error(`Unexpected Gazetteer header: ${header.join(", ")}`);
  }

  const rows = [];
  for (const line of lines.slice(1)) {
    const cols = line.split("\t").map((c) => c.trim());
    const zip = cols[iZip];
    const lat = Number(cols[iLat]);
    const lon = Number(cols[iLon]);
    if (!/^\d{5}$/.test(zip) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    rows.push({ zip, lat, lon });
  }
  return rows;
}

// Parser for Census's ZCTA-to-county relationship file (pipe-separated, one row
// per ZCTA/county overlap). Returns zip -> the county holding most of the ZIP's
// land, which is a better county than any point-in-polygon test on simplified
// boundaries.
export function parseZctaCounty(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = lines[0].replace(/^﻿/, "").split("|");
  const iZip = header.indexOf("GEOID_ZCTA5_20");
  const iCounty = header.indexOf("GEOID_COUNTY_20");
  const iLand = header.indexOf("AREALAND_PART");
  if (iZip === -1 || iCounty === -1 || iLand === -1) {
    throw new Error(`Unexpected relationship file header: ${header.join(", ")}`);
  }

  const best = new Map();
  for (const line of lines.slice(1)) {
    const cols = line.split("|");
    const zip = cols[iZip];
    const county = cols[iCounty];
    const land = Number(cols[iLand]);
    if (!/^\d{5}$/.test(zip) || !/^\d{5}$/.test(county)) continue;
    const current = best.get(zip);
    if (!current || land > current.land) best.set(zip, { county, land });
  }
  return new Map([...best].map(([zip, { county }]) => [zip, county]));
}
