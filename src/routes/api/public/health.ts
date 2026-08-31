import { createFileRoute } from "@tanstack/react-router";

/**
 * Deployment health check: GET /api/public/health
 * Reports whether the database and AI credentials are configured on the server.
 */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const supabaseUrl = process.env["SUPABASE_URL"] ?? "";
        const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
        const aiConfigured = Boolean(
          process.env["GEMINI_API_KEY"] ??
            process.env["GOOGLE_API_KEY"] ??
            process.env["LOVABLE_API_KEY"],
        );

        let database: "ok" | "unreachable" | "unconfigured" = "unconfigured";
        if (supabaseUrl && supabaseKey) {
          try {
            const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
              headers: { apikey: supabaseKey },
            });
            database = res.ok ? "ok" : "unreachable";
          } catch {
            database = "unreachable";
          }
        }

        const ok = database === "ok" && aiConfigured;
        return Response.json(
          {
            status: ok ? "ok" : "degraded",
            database,
            ai: aiConfigured ? "configured" : "missing_api_key",
            time: new Date().toISOString(),
          },
          { status: ok ? 200 : 503 },
        );
      },
    },
  },
});
