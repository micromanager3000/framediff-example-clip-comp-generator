import { defineComposition, defineTimelineDocument } from "framediff";
import source from "./Assembly.html?raw";
import timeline from "./Assembly.timeline.json";

export const assemblyComp = defineComposition(source, {
  timeline: defineTimelineDocument(timeline),
  meta: { timelineFile: "src/compositions/Assembly.timeline.json" },
});
