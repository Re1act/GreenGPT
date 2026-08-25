-- Extensions required across the schema.
-- postgis: all geospatial columns (facility points, basin/county polygons, radius queries).
-- pg_trgm: fuzzy/partial text search over bill summaries, org names, facility operator names.
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
