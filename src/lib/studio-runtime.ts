import type { CompRegistry } from "framediff";
import { createStudioRuntime } from "framediff/studio-runtime";
import { COMPOSITIONS } from "../config";
import { MOCK_TRANSCRIPT } from "../mockTranscript";
import "../main";

export const studioRuntime = createStudioRuntime(COMPOSITIONS);
studioRuntime.setClipTranscriptionProvider(async () => {
  await new Promise((resolve) => setTimeout(resolve, 450));
  return MOCK_TRANSCRIPT;
});
if (import.meta.hot) {
  import.meta.hot.accept("../config", (module) => {
    if (module) studioRuntime.replaceRegistry(module.COMPOSITIONS as CompRegistry);
  });
}
