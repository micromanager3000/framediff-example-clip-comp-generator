import { defineCompositionRegistry } from "framediff";
import { assemblyComp, gardenSelectsComp } from "./compositions";

export const composition = gardenSelectsComp;
export const COMPOSITIONS = defineCompositionRegistry({
  "garden-selects": gardenSelectsComp,
  assembly: assemblyComp,
});
