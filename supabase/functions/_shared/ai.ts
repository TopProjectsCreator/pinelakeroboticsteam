// Shared AI helper: chained providers, first success wins.
// Order: OpenRouter -> Kilo (stepfun/step-3.7-flash:free, anon) ->
// Zen chat (mimo-v2.5-free, keyless+UA) -> Zen responses
// (muse-spark-1.3-contributor-free) -> Lovable gateway (paid, last).
// Non-streaming, returns the assistant text. Throws if all fail.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const ATTEMPT_TIMEOUT_MS = 12000;
const CHAIN_DEADLINE_MS = 45000;

function runAttempt<T>(
  label: string,
  outer: AbortSignal,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const ctrl = new AbortController();
  const onOuter = () => {
    if (!ctrl.signal.aborted) ctrl.abort(outer.reason);
  };
  outer.addEventListener("abort", onOuter, { once: true });
  const t = setTimeout(() => ctrl.abort(new Error(`${label} timed out`)), ATTEMPT_TIMEOUT_MS);
  // Armed through the whole attempt INCLUDING body reads; disarmed only
  // after the value is extracted, so a late chain-abort can never corrupt
  // an already-won success into an AbortError.
  return fn(ctrl.signal).finally(() => {
    clearTimeout(t);
    outer.removeEventListener("abort", onOuter);
  });
}

function chatBody(model: string, messages: ChatMessage[], json?: boolean): string {
  return JSON.stringify({
    model,
    messages,
    ...(json ? { response_format: { type: "json_object" } } : {}),
  });
}

async function readChatText(resp: Response, label: string): Promise<string> {
  if (!resp.ok) throw new Error(`${label} error: ${resp.status}`);
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error(`${label} returned empty content`);
  }
  return text;
}

async function tryOpenRouter(messages: ChatMessage[], json: boolean | undefined, signal: AbortSignal): Promise<string> {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (!OPENROUTER_API_KEY) throw new Error("OpenRouter not configured.");

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
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal,
  });
  try {
    return await readChatText(resp, "OpenRouter");
  } catch (err) {
    console.error("OpenRouter error:", err);
    throw err;
  }
}

async function tryKilo(messages: ChatMessage[], signal: AbortSignal): Promise<string> {
  // Anonymous: NO Authorization header (free models only).
  const resp = await fetch("https://api.kilo.ai/api/gateway/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: chatBody("stepfun/step-3.7-flash:free", messages, true),
    signal,
  });
  try {
    return await readChatText(resp, "Kilo");
  } catch (err) {
    console.error("Kilo error:", err);
    throw err;
  }
}

async function tryZenChat(messages: ChatMessage[], signal: AbortSignal): Promise<string> {
  const resp = await fetch("https://opencode.ai/zen/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer public",
      "Content-Type": "application/json",
      "User-Agent": "opencode/1.18.16",
    },
    body: chatBody("mimo-v2.5-free", messages, true),
    signal,
  });
  try {
    return await readChatText(resp, "Zen chat");
  } catch (err) {
    console.error("Zen chat error:", err);
    throw err;
  }
}

async function tryZenResponses(messages: ChatMessage[], signal: AbortSignal): Promise<string> {
  const input = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");
  const resp = await fetch("https://opencode.ai/zen/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer public",
      "Content-Type": "application/json",
      "User-Agent": "opencode/1.18.16",
    },
    body: JSON.stringify({
      model: "muse-spark-1.3-contributor-free",
      input,
      max_output_tokens: 1000,
      reasoning: { effort: "minimal" },
    }),
    signal,
  });
  if (!resp.ok) {
    console.error("Zen responses error:", resp.status);
    throw new Error(`Zen responses error: ${resp.status}`);
  }
  const data = await resp.json();
  const msg = (data?.output ?? []).find((o: { type: string }) => o?.type === "message");
  const text = msg?.content?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) {
    console.error("Zen responses returned empty content");
    throw new Error("Zen responses returned empty content");
  }
  return text;
}

async function tryLovable(messages: ChatMessage[], json: boolean | undefined, signal: AbortSignal): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
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
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal,
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
  const text = data?.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("Lovable returned empty content");
  return text;
}

export async function callAI(messages: ChatMessage[], opts: { json?: boolean } = {}): Promise<string> {
  const started = Date.now();
  const chain = new AbortController();
  const chainTimer = setTimeout(
    () => chain.abort(new Error("AI chain deadline exceeded.")),
    CHAIN_DEADLINE_MS,
  );
  const attempts: Array<{ label: string; run: (signal: AbortSignal) => Promise<string> }> = [
    { label: "OpenRouter", run: (s) => tryOpenRouter(messages, opts.json, s) },
    { label: "Kilo", run: (s) => tryKilo(messages, s) },
    { label: "Zen chat", run: (s) => tryZenChat(messages, s) },
    { label: "Zen responses", run: (s) => tryZenResponses(messages, s) },
    { label: "Lovable", run: (s) => tryLovable(messages, opts.json, s) },
  ];
  let lastErr: unknown = new Error("No AI provider is configured.");
  try {
    for (const { label, run } of attempts) {
      if (chain.signal.aborted || Date.now() - started > CHAIN_DEADLINE_MS) {
        lastErr = new Error("AI chain deadline exceeded.");
        break;
      }
      try {
        return await runAttempt(label, chain.signal, run);
      } catch (err) {
        console.error("AI attempt failed:", err);
        lastErr = err;
      }
    }
  } finally {
    clearTimeout(chainTimer);
  }
  throw lastErr;
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
