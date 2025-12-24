import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { normalizePath } from "vite";
import path from "path";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: env.GH_PAGES === "true" ? "/ts-minecraft" : "/",
    worker: { format: "es" },
    plugins: [
      {
        name: "buildIndexHtml",
        enforce: "pre",
        async transformIndexHtml(html) {
          const { renderTemplate } = await import("./src/ui/template/main.js");
          return html.replace("<!--main-->", renderTemplate());
        },
      },
      tailwindcss(),
    ],
    optimizeDeps: {
      exclude: ["@electric-sql/pglite"],
    },
  };
});
