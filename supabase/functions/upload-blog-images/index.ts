// Deno Edge Function: upload-blog-images
// Protected function to upload predefined blog images to the 'blog-images' bucket
// Uses service role key for privileged storage access. Requires ADMIN_PASSCODE.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_FILES = 3;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per fetched file
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

// Server-side allowlist: remote bytes are only stored when the OBSERVED
// response content-type is in this map (client-supplied types are ignored).
// SVG is intentionally excluded: the bucket is public and inline SVG can carry
// executable script (stored XSS).
const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
};

interface UploadFile {
  path?: string;
  url: string; // absolute URL where the function can fetch the file
  contentType?: string; // ignored: content type is derived server-side
}

function isIPv4Literal(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return (
    a === 10 || // 10.0.0.0/8
    a === 127 || // 127.0.0.0/8 loopback
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    a === 0 || // 0.0.0.0/8
    (a === 169 && b === 254) || // 169.254.0.0/16 link-local (cloud metadata)
    (a === 192 && b === 0 && parts[2] === 2) || // TEST-NET-1
    (a === 198 && b === 51 && parts[2] === 100) || // TEST-NET-2
    (a === 203 && b === 0 && parts[2] === 113) || // TEST-NET-3
    a >= 224 // 224.0.0.0/4 multicast + 255.255.255.255
  );
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  return (
    v === "::1" || v === "::" || // loopback / unspecified
    v === "0:0:0:0:0:0:0:1" ||
    v.startsWith("fc") || v.startsWith("fd") || // fc00::/7 unique local
    v.startsWith("fe80") || v.startsWith("fe90") || v.startsWith("fea0") || v.startsWith("feb0") || // fe80::/10 link-local
    v.startsWith("ff") // ff00::/8 multicast
  );
}

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

async function assertHostIsPublic(hostname: string): Promise<void> {
  const host = stripBrackets(hostname).toLowerCase();
  if (!host || host === "localhost") throw new Error("Blocked host");
  if (host.endsWith(".localhost")) throw new Error("Blocked host");
  if (isIPv4Literal(host)) {
    if (isPrivateIPv4(host)) throw new Error("Blocked IP");
    return;
  }
  if (host.includes(":")) {
    // IPv6 literal
    if (isPrivateIPv6(host)) throw new Error("Blocked IP");
    return;
  }
  // DNS check: resolve the name and reject if any record points at a
  // private/link-local/loopback address (blocks DNS-rebinding style targets).
  try {
    const deno = Deno as unknown as {
      resolveDns?: (host: string, type: "A" | "AAAA") => Promise<string[]>;
    };
    if (typeof deno.resolveDns === "function") {
      const [a, aaaa] = await Promise.all([
        deno.resolveDns(host, "A").catch(() => [] as string[]),
        deno.resolveDns(host, "AAAA").catch(() => [] as string[]),
      ]);
      const addrs = [...a, ...aaaa];
      if (addrs.length === 0) throw new Error("DNS resolution failed");
      for (const addr of addrs) {
        if (isIPv4Literal(addr) ? isPrivateIPv4(addr) : isPrivateIPv6(stripBrackets(addr))) {
          throw new Error("Blocked IP");
        }
      }
    }
  } catch (err) {
    // Fail closed on blocked IPs / DNS failures.
    throw err instanceof Error ? err : new Error("Blocked host");
  }
}

async function validateUrlForFetch(raw: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid URL protocol");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Credentials in URL are not allowed");
  }
  if (!parsed.hostname) throw new Error("Invalid URL");
  await assertHostIsPublic(parsed.hostname);
  return parsed;
}

async function fetchValidatedBytes(rawUrl: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    // Every hop is re-validated so a safe URL cannot redirect to an internal one.
    await validateUrlForFetch(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, { redirect: "manual", signal: controller.signal });
    } catch (err) {
      clearTimeout(timer);
      throw err instanceof Error && err.name === "AbortError"
        ? new Error("Fetch timed out")
        : new Error("Fetch failed");
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel().catch(() => {});
      if (!location) throw new Error("Invalid redirect");
      if (hop === MAX_REDIRECTS) throw new Error("Too many redirects");
      current = new URL(location, current).toString();
      continue;
    }

    if (!res.ok) {
      const status = res.status;
      await res.body?.cancel().catch(() => {});
      throw new Error(`Fetch failed with status ${status}`);
    }

    const declared = res.headers.get("content-length");
    if (declared !== null && Number(declared) > MAX_BYTES) {
      await res.body?.cancel().catch(() => {});
      throw new Error("File too large");
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
      throw new Error(bytes.byteLength === 0 ? "Empty file" : "File too large");
    }
    const contentType = (res.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    return { bytes, contentType };
  }
  throw new Error("Too many redirects");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin passcode gate. Fails closed when the secret is not configured.
    const adminPasscode = Deno.env.get("ADMIN_PASSCODE");
    if (!adminPasscode) {
      console.error("ADMIN_PASSCODE is not configured");
      return new Response(
        JSON.stringify({ error: "Publishing is disabled." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { passcode, files } = body as { passcode?: unknown; files?: unknown };
    if (typeof passcode !== "string" || passcode !== adminPasscode) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("Missing required environment variables");
      return new Response(
        JSON.stringify({ error: "Configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (!files || !Array.isArray(files) || files.length === 0) {
      return new Response(
        JSON.stringify({ error: "No files provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (files.length > MAX_FILES) {
      return new Response(
        JSON.stringify({ error: `Too many files (max ${MAX_FILES})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ path: string; ok: boolean; error?: string }> = [];

    for (const file of files as UploadFile[]) {
      const label = typeof file?.path === "string" && file.path ? file.path : "file";
      try {
        if (!file || typeof file.url !== "string" || !file.url) {
          results.push({ path: label, ok: false, error: "Invalid URL" });
          continue;
        }

        let fetched: { bytes: Uint8Array; contentType: string };
        try {
          fetched = await fetchValidatedBytes(file.url);
        } catch (err) {
          console.error("Blocked/failed fetch for", file.url, err);
          const msg = err instanceof Error ? err.message : "Fetch failed";
          const generic = msg === "File too large" || msg === "Empty file"
            ? "File too large"
            : msg === "Too many redirects" || msg === "Invalid redirect"
              ? "Too many redirects"
              : msg === "Invalid URL" || msg === "Invalid URL protocol"
                ? "Invalid URL"
                : "Fetch failed";
          results.push({ path: label, ok: false, error: generic });
          continue;
        }

        const ext = CONTENT_TYPE_TO_EXT[fetched.contentType];
        if (!ext) {
          console.error("Rejected content-type for", file.url, fetched.contentType);
          results.push({ path: label, ok: false, error: "Unsupported content type" });
          continue;
        }

        // Server-generated filename: never trust the client-supplied path.
        const path = `${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase
          .storage
          .from("blog-images")
          .upload(path, fetched.bytes, { contentType: fetched.contentType, upsert: false });

        if (uploadError) {
          console.error("Upload error for", path, uploadError);
          results.push({ path: label, ok: false, error: "Upload failed" });
        } else {
          results.push({ path, ok: true });
        }
      } catch (err) {
        console.error("Upload error for", label, err);
        results.push({ path: label, ok: false, error: "Unexpected error" });
      }
    }

    const uploaded = results.filter((r) => r.ok).length;
    return new Response(
      JSON.stringify({ uploaded, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("upload-blog-images error:", e);
    return new Response(
      JSON.stringify({ error: "An error occurred. Please try again later." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
