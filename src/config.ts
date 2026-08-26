import { defineCompositionRegistry } from "framediff";
import { assemblyComp, gardenSelectsComp } from "./compositions";
import { valerieComp } from "./Valerie";

export const composition = gardenSelectsComp;
export const COMPOSITIONS = defineCompositionRegistry({
  "garden-selects": gardenSelectsComp,
  assembly: assemblyComp,
  "valerie": valerieComp,
});
