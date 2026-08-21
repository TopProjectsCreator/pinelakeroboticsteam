// Shared AI helper: OpenRouter (gemma primary -> openrouter/free) with a
// final fallback to the Lovable AI Gateway (openai/gpt-5.6-luna).
// Non-streaming, returns the assistant text.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callAI(messages: ChatMessage[], opts: { json?: boolean } = {}): Promise<string> {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  // 1) OpenRouter
  if (OPENROUTER_API_KEY) {
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemma-4-31b-it:free",
          models: ["google/gemma-4-31b-it:free", "openrouter/free"],
          messages,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const text = data?.choices?.[0]?.message?.content;
        if (typeof text === "string" && text.trim()) return text;
        console.error("OpenRouter returned empty content");
      } else {
        console.error("OpenRouter error:", resp.status, await resp.text());
      }
    } catch (err) {
      console.error("OpenRouter request failed:", err);
    }
  }

  // 2) Lovable AI Gateway
  if (!LOVABLE_API_KEY) throw new Error("No AI provider is configured.");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Lovable-API-Key": LOVABLE_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-luna",
      messages,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.error("Lovable AI gateway error:", resp.status, body);
    const err = new Error(
      resp.status === 429
        ? "Rate limits exceeded, please try again in a moment."
        : resp.status === 402
        ? "AI credits are exhausted. Please contact the team."
        : "AI gateway error",
    ) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }

  const data = await resp.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

/** Best-effort extraction of a JSON object from a model response. */
export function parseJsonObject<T = Record<string, unknown>>(text: string): T {
  const cleaned = text.replace(/```json/gi, "```").split("```").filter(Boolean);
  const candidates = [text, ...cleaned];
  for (const c of candidates) {
    const start = c.indexOf("{");
    const end = c.lastIndexOf("}");
    if (start === -1 || end <= start) continue;
    try {
      return JSON.parse(c.slice(start, end + 1)) as T;
    } catch {
      // try next candidate
    }
  }
  throw new Error("Could not parse AI JSON response");
}
