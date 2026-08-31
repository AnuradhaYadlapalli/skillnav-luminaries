import { defineConfig, loadEnv } from "@lovable.dev/vite-tanstack-config";
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

  return {
    tanstackStart: {
      // src/server.ts is the SSR entry (error-page wrapper).
      server: { entry: "server" },
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId),
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
      dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
    },
  };
});
