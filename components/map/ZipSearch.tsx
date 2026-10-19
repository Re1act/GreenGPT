"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { COUNTRIES } from "@/lib/location/countries";

export default function ZipSearch({ onLocate }: {
  onLocate: (center: [number, number]) => void;
}) {
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("US");
  const [kind, setKind] = useState<"postcode" | "city">("postcode");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = zip.trim();
    if (!value || (kind === "postcode" && !/^[\p{L}\p{N}\s-]+$/u.test(value))) {
      setMessage(kind === "postcode" ? "Enter a valid postal code." : "Enter a city or town.");
      setError(true);
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(false);
    setMessage("");
    try {
      const params = new URLSearchParams({ zip: value, country, kind });
      const response = await fetch(`/api/map/zip?${params}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (controller.signal.aborted) return;
      onLocate([data.longitude, data.latitude]);
      setMessage(data.label);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(true);
      setMessage(err instanceof Error ? err.message : "Location search failed. Please try again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return (
    <details className="group w-fit max-w-full rounded-lg border border-black/10 bg-white/95 shadow-lg backdrop-blur dark:border-white/10 dark:bg-zinc-900/95 open:w-64">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-800 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-zinc-100 [&::-webkit-details-marker]:hidden">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
          <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" />
        </svg>
        <span className="sr-only group-open:not-sr-only">Find a location</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="ml-auto h-3 w-3 group-open:rotate-180">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </summary>
    <form onSubmit={search} noValidate aria-label="Find a location"
      className="w-full px-3 pb-3">
      <label htmlFor="map-country" className="sr-only">
        Country or territory
      </label>
      <select id="map-country" autoComplete="country" value={country} disabled={loading}
        onChange={(event) => { setCountry(event.target.value); setMessage(""); setError(false); }}
        className="mb-2 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-base text-zinc-900 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white sm:text-sm">
        {COUNTRIES.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
      </select>
      <label htmlFor="map-zip" className="sr-only">
        {kind === "postcode" ? "ZIP / postal code" : "City or town"}
      </label>
      <div className="flex gap-2">
        <input id="map-zip" type="text" autoComplete={kind === "postcode" ? "postal-code" : "address-level2"}
          placeholder={kind === "postcode" ? "Enter postal code" : "Enter city or town"}
          maxLength={kind === "postcode" ? 32 : 100} value={zip} disabled={loading}
          aria-invalid={error} aria-describedby="zip-search-message"
          onChange={(event) => { setZip(event.target.value); setMessage(""); setError(false); }}
          className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1.5 text-base text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white sm:text-sm" />
        <button type="submit" disabled={loading}
          aria-label={loading ? "Finding location" : "Zoom to location"}
          title="Zoom to location"
          className="flex w-9 shrink-0 items-center justify-center rounded bg-zinc-900 py-1.5 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 dark:bg-white dark:text-zinc-900">
          {loading ? (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 motion-safe:animate-spin">
              <circle cx="12" cy="12" r="9" opacity="0.25" />
              <path d="M12 3a9 9 0 0 1 9 9" strokeLinecap="round" />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 5 5M10.5 7.5v6M7.5 10.5h6" />
            </svg>
          )}
        </button>
      </div>
      <p id="zip-search-message" role="status" aria-live="polite"
        className={`text-xs ${message || loading ? "mt-2" : ""} ${error ? "text-red-700 dark:text-red-300" : "text-zinc-600 dark:text-zinc-300"}`}>
        {loading ? "Looking up location…" : message}
      </p>
      <button type="button" disabled={loading}
        onClick={() => { setKind(kind === "postcode" ? "city" : "postcode"); setZip(""); setMessage(""); setError(false); }}
        className="mt-2 text-left text-xs text-zinc-600 underline underline-offset-2 dark:text-zinc-300">
        {kind === "postcode" ? "Search by city instead" : "Search by postal code instead"}
      </button>
      <p className="mt-2 text-[0.625rem] text-zinc-500 dark:text-zinc-400">
        Search: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap</a>
      </p>
    </form>
    </details>
  );
}
