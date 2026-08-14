import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://cavwic.github.io",
  base: "/cavwic-solutions-lab",
  output: "static",
  integrations: [react()],
});
