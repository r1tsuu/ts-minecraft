import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: env.GH_PAGES === "true" ? "/ts-minecraft" : "/",
    optimizeDeps: {
      exclude: ["@electric-sql/pglite"],
    },
  };
});
