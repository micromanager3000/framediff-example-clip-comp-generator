import { defineComposition } from "framediff";
import source from "./Valerie.html?raw";
import document from "./Valerie.comp.json";

export const valerieComp = defineComposition(source, { document, meta: { document: { file: "src/Valerie.comp.json", schema: "src/Valerie.schema.json", bindings: {} } }, });
