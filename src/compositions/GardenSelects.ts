import { defineClipCollectionDocument } from "@framediff/studio-model";
import { defineComposition } from "framediff";
import source from "./GardenSelects.html?raw";
import collection from "./GardenSelects.clips.json";

const clips = defineClipCollectionDocument(collection);

export const gardenSelectsComp = defineComposition(source, {
  document: clips,
  meta: {
    document: {
      file: "src/compositions/GardenSelects.clips.json",
      schema: "src/compositions/GardenSelects.schema.json",
      hotUpdate: "patch",
    },
    authoring: {
      timeline: "hidden",
      transport: "hidden",
      directManipulation: false,
      documents: [{
        id: "clips",
        role: "clips",
        file: "src/compositions/GardenSelects.clips.json",
        schema: "src/compositions/GardenSelects.schema.json",
        writable: true,
        hotUpdate: "patch",
      }],
    },
  },
});
