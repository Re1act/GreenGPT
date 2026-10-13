-- The map's largest layers (water_stress_geojson, egrid_geojson) were observed
-- hitting the anon role's default statement_timeout (~4-5s) even after the
-- write-time-simplification and US-only-filtering fixes, whenever several map
-- loads hit Supabase concurrently (cold Next.js Data Cache/CDN cache across
-- multiple simultaneous page loads is exactly the case a real deploy sees at
-- launch, not just a testing artifact). A single successful run of each RPC
-- takes 2-4s; under connection-pool contention that stretched past 8s.
--
-- Raise the ceiling rather than fight it further with more query tuning: 15s
-- comfortably covers the worst observed time with margin, while still bounding
-- any genuinely runaway query so a bad request can't hang a connection forever.
alter role anon set statement_timeout = '15s';
alter role authenticated set statement_timeout = '15s';
