// Firecrawl v2 tools for the AI assistant, with per-IP rate limiting.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

// Rate limits per IP (Firecrawl is a paid API).
export const LIMIT_PER_HOUR = 10;
export const LIMIT_PER_DAY = 40;
export const MAX_TOOL_CALLS_PER_MESSAGE = 3;

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

export async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`firecrawl:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Returns null when allowed, or a message when the IP is over the limit. */
export async function checkRateLimit(ipHash: string): Promise<string | null> {
  const supabase = admin();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("firecrawl_usage")
    .select("created_at")
    .eq("ip_hash", ipHash)
    .gte("created_at", dayAgo);

  if (error) {
    console.error("rate limit lookup failed:", error);
    // Fail closed: web tools are paid.
    return "Web tools are temporarily unavailable.";
  }

  const day = data?.length ?? 0;
  const hour = (data ?? []).filter((r) => r.created_at >= hourAgo).length;

  if (hour >= LIMIT_PER_HOUR) return `Web search limit reached (${LIMIT_PER_HOUR}/hour). Try again later.`;
  if (day >= LIMIT_PER_DAY) return `Web search daily limit reached (${LIMIT_PER_DAY}/day). Try again tomorrow.`;
  return null;
}

async function recordUsage(ipHash: string, tool: string) {
  const { error } = await admin().from("firecrawl_usage").insert({ ip_hash: ipHash, tool });
  if (error) console.error("usage record failed:", error);
}

async function firecrawl(path: string, body: unknown) {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured");

  const resp = await fetch(`${FIRECRAWL_V2}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    console.error(`Firecrawl ${path} failed [${resp.status}]:`, JSON.stringify(data));
    throw new Error(`Firecrawl request failed (${resp.status})`);
  }
  return data;
}

function clip(text: unknown, max = 6000): string {
  const s = typeof text === "string" ? text : "";
  return s.length > max ? `${s.slice(0, max)}\n...[truncated]` : s;
}

export const firecrawlTools = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the live web for current information (news, FTC rules, other teams, events). Use when the answer is not in your built-in team knowledge.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          limit: { type: "number", description: "Number of results, 1-5 (default 5)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_scrape",
      description: "Fetch and read the content of a specific URL as markdown.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to read" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_map",
      description: "Discover the list of URLs on a website (fast sitemap). Useful to find the right page before scraping.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The site root URL" },
          search: { type: "string", description: "Optional keyword to filter URLs" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_crawl",
      description:
        "Crawl several pages of a website and return their content. Expensive — only use when a single page is not enough. Limited to 10 pages.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The site URL to crawl" },
          limit: { type: "number", description: "Max pages, 1-10 (default 5)" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_extract",
      description: "Extract a structured summary or specific facts from a page using a natural-language prompt.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to extract from" },
          prompt: { type: "string", description: "What to extract, in plain language" },
        },
        required: ["url", "prompt"],
      },
    },
  },
];

const clampNum = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback;
  return Math.min(max, Math.max(min, n));
};

const isUrl = (v: unknown) => typeof v === "string" && /^https?:\/\/\S+$/i.test(v);

/** Runs a firecrawl tool call. Returns a string result for the model. */
export async function runFirecrawlTool(
  name: string,
  args: Record<string, unknown>,
  ipHash: string,
): Promise<string> {
  const limited = await checkRateLimit(ipHash);
  if (limited) return `Rate limited: ${limited}`;

  try {
    let out: string;
    switch (name) {
      case "web_search": {
        if (typeof args.query !== "string" || !args.query.trim()) return "Error: query is required.";
        const data = await firecrawl("/search", {
          query: args.query.slice(0, 400),
          limit: clampNum(args.limit, 1, 5, 5),
        });
        const results = (data?.data ?? data?.web ?? []) as Array<Record<string, unknown>>;
        out = results.length
          ? results
              .map((r, i) => `${i + 1}. ${r.title ?? "Untitled"}\n${r.url ?? ""}\n${clip(r.description, 500)}`)
              .join("\n\n")
          : "No results found.";
        break;
      }
      case "web_scrape": {
        if (!isUrl(args.url)) return "Error: a valid http(s) url is required.";
        const data = await firecrawl("/scrape", { url: args.url, formats: ["markdown"], onlyMainContent: true });
        out = clip(data?.markdown ?? data?.data?.markdown) || "No content returned.";
        break;
      }
      case "web_map": {
        if (!isUrl(args.url)) return "Error: a valid http(s) url is required.";
        const data = await firecrawl("/map", {
          url: args.url,
          search: typeof args.search === "string" ? args.search.slice(0, 200) : undefined,
          limit: 50,
        });
        const links = (data?.links ?? data?.data?.links ?? []) as Array<string | { url?: string }>;
        out = links.length
          ? links.slice(0, 50).map((l) => (typeof l === "string" ? l : l.url)).join("\n")
          : "No links found.";
        break;
      }
      case "web_crawl": {
        if (!isUrl(args.url)) return "Error: a valid http(s) url is required.";
        const data = await firecrawl("/crawl", {
          url: args.url,
          limit: clampNum(args.limit, 1, 10, 5),
          scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
        });
        const pages = (data?.data ?? []) as Array<Record<string, any>>;
        if (pages.length) {
          out = pages
            .slice(0, 10)
            .map((p) => `## ${p?.metadata?.sourceURL ?? ""}\n${clip(p?.markdown, 1500)}`)
            .join("\n\n");
        } else if (data?.id) {
          out = "Crawl started but results are not ready yet. Try scraping a specific page instead.";
        } else {
          out = "No pages returned.";
        }
        break;
      }
      case "web_extract": {
        if (!isUrl(args.url)) return "Error: a valid http(s) url is required.";
        if (typeof args.prompt !== "string" || !args.prompt.trim()) return "Error: prompt is required.";
        const data = await firecrawl("/scrape", {
          url: args.url,
          formats: [{ type: "json", prompt: args.prompt.slice(0, 500) }],
          onlyMainContent: true,
        });
        const json = data?.json ?? data?.data?.json;
        out = json ? clip(JSON.stringify(json, null, 2)) : "Nothing extracted.";
        break;
      }
      default:
        return `Unknown tool: ${name}`;
    }

    await recordUsage(ipHash, name);
    return out;
  } catch (err) {
    console.error(`firecrawl tool ${name} failed:`, err);
    return `The web tool failed: ${err instanceof Error ? err.message : "unknown error"}`;
  }
}
