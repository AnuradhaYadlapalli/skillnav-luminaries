// Standalone Vite config — no Lovable-specific packages required.
// Runs anywhere with `npm install && npm run dev`.
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  // Load .env (all keys, not just VITE_*) so server code can read them too.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env } as Record<string, string>;

  // Accept either naming for the public API key.
  const supabaseUrl = env["VITE_SUPABASE_URL"] || env["SUPABASE_URL"] || "";
  const supabaseKey =
    env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    env["VITE_SUPABASE_ANON_KEY"] ||
    env["SUPABASE_PUBLISHABLE_KEY"] ||
    env["SUPABASE_ANON_KEY"] ||
    "";
  const supabaseProjectId =
    env["VITE_SUPABASE_PROJECT_ID"] ||
    env["SUPABASE_PROJECT_ID"] ||
    supabaseUrl.replace(/^https?:\/\//, "").split(".")[0] ||
    "";

  // Mirror everything into process.env for SSR / server functions.
  const resolved: Record<string, string> = {
    ...env,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_PUBLISHABLE_KEY: supabaseKey,
    SUPABASE_PROJECT_ID: supabaseProjectId,
  };
  for (const [key, value] of Object.entries(resolved)) {
    if (value) process.env[key] = value;
  }

  return {
    // Make the public Supabase values available to browser code under the
    // canonical VITE_ names, whichever alias the .env file used.
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId),
    },
    server: {
      host: true,
      port: Number(process.env["PORT"] ?? 8080),
    },
    preview: {
      host: true,
      port: Number(process.env["PORT"] ?? 8080),
    },

    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
      dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
    },
    plugins: [
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tailwindcss(),
      tanstackStart({
        // src/server.ts is the SSR entry (error-page wrapper).
        // `npm run build` emits dist/client + dist/server; `npm start` serves both.
        server: { entry: "server" },
      }),
      viteReact(),
    ],
  };
});
