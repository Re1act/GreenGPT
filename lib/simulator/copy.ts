import type { CoolingType, PowerSource } from "@/lib/simulator/model";

// Plain-English copy for the walkthrough. Every claim here has to match what
// the model's coefficients actually say (coefficients.json) -- if a number
// changes there, check the wording here.

export const COOLING_COPY: Record<
  CoolingType,
  { title: string; analogy: string; body: string; water: string; power: string }
> = {
  evaporative: {
    title: "Cooling towers, all year",
    analogy: "Works like sweating",
    body: "Warm water from the building is pumped through cooling towers. Some of it evaporates, and that carries the heat away, the same way sweat cools your skin. It needs little extra electricity, but the evaporated water is gone for good.",
    water: "Lots of water",
    power: "Little extra electricity",
  },
  hybrid_air: {
    title: "Outside air, plus water on hot days",
    analogy: "Like opening the windows, with a mister for heat waves",
    body: "Most of the year, fans just pull cool outside air through the building. When it gets hot, water is sprayed into the air or run through cooling towers to help. It uses much less water than running towers all year, but how much depends a lot on the local climate: the hotter the place, the more hot days.",
    water: "Some water, mostly on hot days",
    power: "Little extra electricity",
  },
  closed_loop: {
    title: "Closed loop with radiators",
    analogy: "Works like a car radiator",
    body: "Liquid flows right past the hot chips, then through large radiators outside where fans blow the heat away. The same liquid goes around and around, so almost no water is used up. On the hottest days, backup air conditioning helps out.",
    water: "Almost no water",
    power: "Little extra electricity",
  },
  air: {
    title: "Fans and air conditioning",
    analogy: "Works like air-conditioning a house",
    body: "When it's cool outside, fans pull outside air through the building. When it's hot, air conditioners take over. No water is used up, but air conditioning uses a lot of electricity, especially in hot places.",
    water: "Almost no water",
    power: "The most extra electricity",
  },
  immersion: {
    title: "Submerge the servers",
    analogy: "Servers sit in a liquid bath",
    body: "The servers sit in tanks of a special liquid that doesn't conduct electricity. The liquid soaks up the heat and carries it to radiators outside. It uses almost no water and little extra electricity, but it costs much more to build. Our sources don't study it separately yet, so we use the same numbers as the closed loop.",
    water: "Almost no water",
    power: "Little extra electricity",
  },
};

export const POWER_COPY: Record<PowerSource, { title: string; analogy: string; body: string }> = {
  grid: {
    title: "The local power grid",
    analogy: "Like plugging into a shared outlet",
    body: "Plug into the same grid as everyone else nearby, and use whatever mix of power plants feeds it.",
  },
  onsite_gas: {
    title: "Its own gas power plant",
    analogy: "Like running your own generator",
    body: "Build a natural gas power plant next door just for the data center. That avoids waiting for the grid to add capacity, but the data center's pollution becomes that plant's pollution.",
  },
  dedicated_renewables: {
    title: "A wind and solar contract",
    analogy: "Like balancing a yearly energy budget",
    body: "Pay wind and solar farms to produce as much electricity over a year as the data center uses. The wind and sun aren't always there, though, and at those times the data center still runs on the local grid.",
  },
};

export const WHY_RANGES =
  "Companies rarely say how they cool their buildings or how hard their computers work, and weather changes how much any design uses. So every answer here is a range, from a best case to a worst case. The real number for an actual building would fall somewhere in between.";
