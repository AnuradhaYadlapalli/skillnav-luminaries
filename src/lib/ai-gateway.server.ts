import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * AI provider resolution (server-only).
 *
 * 1. GEMINI_API_KEY  -> Google Gemini directly (works on any machine, no Lovable needed)
 * 2. LOVABLE_API_KEY -> Lovable AI Gateway (only present when hosted on Lovable)
 */

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

export const GEMINI_MODEL = process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash";
export const LEARNING_MODEL = "google/gemini-3.7-flash";

function createGeminiProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "google-gemini",
    baseURL: GEMINI_BASE_URL,
    supportsStructuredOutputs: false,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

export function createLovableAiGatewayProvider(lovableApiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    supportsStructuredOutputs: false,
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

export function getGatewayModel() {
  const geminiKey = process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_API_KEY"];
  if (geminiKey) {
    return createGeminiProvider(geminiKey)(GEMINI_MODEL);
  }

  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (lovableKey) {
    return createLovableAiGatewayProvider(lovableKey)(LEARNING_MODEL);
  }

  throw new Error(
    "AI is not configured. Set GEMINI_API_KEY in your .env file (get one at https://aistudio.google.com/apikey).",
  );
}
