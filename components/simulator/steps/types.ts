import type { CoolingType, SimulatorResult } from "@/lib/simulator/model";
import type { ScenarioInputs } from "@/lib/simulator/params";
import type { RegionLookup } from "@/lib/simulator/region";

export type SetInput = <K extends keyof ScenarioInputs>(key: K, value: ScenarioInputs[K]) => void;

export type StepProps = {
  inputs: ScenarioInputs;
  set: SetInput;
  result: SimulatorResult;
  byCooling: Record<CoolingType, SimulatorResult>;
  lookup: RegionLookup;
};
