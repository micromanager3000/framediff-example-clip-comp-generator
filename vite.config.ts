import { fileURLToPath, URL } from "node:url";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { framediffDev } from "../../packages/framediff/vite-plugin.ts";

export default defineConfig({
  plugins: [sveltekit(), framediffDev()],
  server: { host: "0.0.0.0", watch: { ignored: ["**/.svelte-kit/**", "**/build/**"] } },
  resolve: {
    dedupe: ["svelte"],
    alias: [
      { find: /^framediff$/, replacement: fileURLToPath(new URL("../../packages/framediff/src/index.ts", import.meta.url)) },
      { find: /^framediff\/vite$/, replacement: fileURLToPath(new URL("../../packages/framediff/vite-plugin.ts", import.meta.url)) }
    ]
  }
});
