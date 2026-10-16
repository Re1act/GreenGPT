import { LITERS_PER_GALLON, type Range } from "@/lib/simulator/model";

// Display helpers. Two significant figures by default: the inputs are ranges
// read off figures and literature medians, so printing "742,613" would claim
// precision the model doesn't have.

export function sig(n: number, digits = 2): string {
  if (n === 0) return "0";
  return new Intl.NumberFormat("en-US", { maximumSignificantDigits: digits }).format(n);
}

export function formatRange(r: Range, digits = 2): string {
  const low = sig(r.low, digits);
  const high = sig(r.high, digits);
  return low === high ? low : `${low}–${high}`;
}

export function litersToMillionGallons(r: Range): Range {
  return { low: r.low / LITERS_PER_GALLON / 1e6, high: r.high / LITERS_PER_GALLON / 1e6 };
}

export function scaleRange(r: Range, k: number): Range {
  return { low: r.low * k, high: r.high * k };
}

export function formatUsd(n: number): string {
  if (Math.abs(n) >= 1e6) return `$${sig(n / 1e6)}M`;
  return `$${sig(n)}`;
}

export function formatUsdRange(r: Range): string {
  const low = formatUsd(r.low);
  const high = formatUsd(r.high);
  return low === high ? low : `${low}–${high}`;
}
