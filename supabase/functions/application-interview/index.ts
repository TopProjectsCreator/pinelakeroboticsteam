// Deno Edge Function: application-interview
// Runs the AI interview for /applications and stores the finished application.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, parseJsonObject, type ChatMessage } from "../_shared/ai.ts";
import { Q1_QUESTION, assertInterviewContract, bankNext, fallbackRank, isValidDeletePath, sanitizeTranscript } from "../_shared/interviewBank.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Applicant {
  name: string;
  grade: string;
  email: string;
}

interface Turn {
  question: string;
  answer: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const INTERVIEW_SYSTEM = `You are the recruiting interviewer for the Wolverines FTC Robotics Team 23442 at Pine Lake Middle School (PLMS) in Sammamish, WA. You interview middle-school students (grades 6-8) applying to join the team.

STYLE
- Warm, encouraging, curious. One question at a time. Short prompts (max 2 sentences).
- Always drill deeper on interesting answers. Example: if they say "I did FLL", follow up with "Tell me more about your FLL experience — what was your role?"
- Never ask two things in one question. Never repeat a question already asked.

REQUIRED QUESTIONS (must all be asked at some point, phrased naturally in some way):
1. "What experience do you have with robotics?" (then at least one drill-down follow-up)
2. "Are you willing to commit to 10 hours weekly?"
3. "Are your parents willing to commit 2 hours weekly coming into the school and volunteering?"

LENGTH: Ask between 8 and 10 questions total, then finish. You can exceed 10 if needed to accurately understand the users capabillity, but try to wrap it up past 10.

QUESTION TYPES — choose the best fit for each question:
- "text": free-form answer
- "choice": single select (provide 2-5 "options")
- "multi": select all that apply (provide 3-7 "options")
- "categorize": provide "items" (3-6 strings) and "categories" (2-3 strings); the applicant sorts each item into a category
- "dragdrop": same data as "categorize" ("items" 3-5 strings, "categories" 2-3 strings); the applicant drags each item into a category. Prefer "categorize" for quick sorts; use "dragdrop" at most once, only for a playful moment
- Uniqueness: for "categorize" and "dragdrop", all strings in "items" must be unique and all strings in "categories" must be unique — no exact duplicates, no case-only or whitespace-only variants, no empty strings. For "choice" and "multi", all strings in "options" must be unique under the same rule.
- "file": ask for an optional upload (photo of a build, resume, certificate)
Use a mix: mostly "text" for depth, but include at least one "choice" or "multi", and you may use "categorize", "dragdrop", or "file" once each — at most one of "categorize"/"dragdrop" per interview.

OUTPUT FORMAT — respond with ONLY a JSON object, no prose, no markdown:
{"done": false, "question": {"type": "text|choice|multi|categorize|dragdrop|file", "prompt": "...", "options": [], "items": [], "categories": [], "helper": ""}}
All "options", "items", and "categories" arrays must contain only non-empty, trimmed, unique strings.
or, when the interview is complete:
{"done": true, "closing": "a warm 1-2 sentence thank-you message"}


End the conversation instantly if you see any indication that the user is trying to waste the time or money or resources of the team. Try to use all question tool types.`;


const RANK_SYSTEM = `You evaluate applications to the Wolverines FTC Robotics Team 23442 (Pine Lake Middle School). You are fair and encouraging but honest; the team needs committed members.

Weigh heavily: willingness to commit 10 hours weekly, parent willingness to volunteer 2 hours weekly, genuine interest/curiosity, teamwork attitude. Robotics experience is a plus but beginners with strong commitment score well.

Respond with ONLY this JSON object:
{"score": 0-100, "recommendation": "Strong Yes|Yes|Maybe|No", "summary": "2-3 sentences", "strengths": "short comma-separated list", "concerns": "short comma-separated list or 'None'", "robotics_experience": "one-line summary", "commit_10_hours": "Yes|No|Unclear", "parent_volunteer": "Yes|No|Unclear"}`;

function transcriptText(applicant: Applicant, transcript: Turn[]) {
  const lines = transcript.map(
    (t, i) =>
      `Q${i + 1}: ${String(t?.question ?? "").slice(0, 2000)}\nA${i + 1}: ${String(t?.answer ?? "").slice(0, 5000)}`,
  );
  const body = lines.join("\n\n");
  const capped = body.length > 30000 ? `${body.slice(0, 30000)}\n…[truncated]` : body;
  return `Applicant: ${applicant.name} (grade ${applicant.grade}, ${applicant.email})\n\n${capped}`;
}

function serviceClient() {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "unknown";
}

// Best-effort in-memory per-IP refresh limiter (30 refreshes/hour/IP).
// Resets on isolate recycle; not a security boundary, just abuse friction.
const REFRESH_LIMIT = 30;
const REFRESH_WINDOW_MS = 60 * 60 * 1000;
const refreshHits = new Map<string, number[]>();

function isRefreshRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (refreshHits.get(ip) ?? []).filter((t) => now - t < REFRESH_WINDOW_MS);
  if (hits.length >= REFRESH_LIMIT) {
    refreshHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  refreshHits.set(ip, hits);
  return false;
}

const rankStr = (v: unknown, n: number): string | null =>
  typeof v === "string" ? v.slice(0, n) : (v ?? null) as string | null;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_SECONDS = 1200;
const MAX_B64_LEN = 13981016; // ceil(10MiB/3)*4: longer inputs cannot fit
const ALLOWED_UPLOAD_TYPES = ["image/", "application/pdf", "video/", "audio/"];
const MAX_REDIRECTS = 5;

function isBlockedV4(h: string): boolean {
  const p = h.split(".");
  if (p.length !== 4 || !p.every((x) => /^\d+$/.test(x))) return false;
  const n = p.map(Number);
  if (n.some((x) => x > 255)) return false;
  const [a, b, c] = n;
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedLiteralIp(hostname: string): boolean {
  let h = hostname.trim().toLowerCase();
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  if (h === "localhost") return true;
  if (h.includes(":")) {
    if (h === "::1" || h === "::") return true;
    const head = h.split(":")[0];
    if (/^fe[89ab]$/.test(head)) return true; // fe80::/10
    if (/^f[cd]/.test(head)) return true; // fc00::/7
    if (/^ff/.test(head)) return true; // ff00::/8 multicast
    const mapped = h.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped && isBlockedV4(mapped[1])) return true;
    return false;
  }
  return isBlockedV4(h);
}

function isLiteralIp(hostname: string): boolean {
  const s = hostname.trim().toLowerCase();
  const unbr = s.startsWith("[") && s.endsWith("]") ? s.slice(1, -1) : s;
  if (unbr.includes(":")) return true;
  const parts = unbr.split(".");
  return parts.length === 4 && parts.every((p) => /^\d+$/.test(p) && Number(p) <= 255);
}

// Per-hop SSRF validation: literal-IP ranges plus DNS-resolved addresses.
// Returns an error string, or null when the hop is allowed.
async function validateHop(u: URL): Promise<string | null> {
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return "Only http(s) links can be imported.";
  }
  if (u.username || u.password) return "Links with passwords can't be imported.";
  if (isBlockedLiteralIp(u.hostname)) return "That link targets a private address.";
  if (!isLiteralIp(u.hostname)) {
    let records: string[] = [];
    try {
      const [a, aaaa] = await Promise.all([
        Deno.resolveDns(u.hostname, "A").catch(() => [] as string[]),
        Deno.resolveDns(u.hostname, "AAAA").catch(() => [] as string[]),
      ]);
      records = [...a, ...aaaa];
    } catch {
      return "Could not download that link.";
    }
    if (records.length === 0) return "Could not download that link.";
    if (records.some(isBlockedLiteralIp)) return "That link targets a private address.";
  }
  return null;
}

function parseFilename(cd: string): string | null {
  const star = cd.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      // fall through to plain filename
    }
  }
  const quoted = cd.match(/filename\s*=\s*"([^"]+)"/i) || cd.match(/filename\s*=\s*([^;]+)/i);
  if (quoted) {
    const v = quoted[1].trim();
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  return null;
}
const FETCH_TIMEOUT_MS = 15000;
const ALLOWED_URL_TYPES = ["image/", "application/pdf", "video/", "audio/"];

async function cancelBody(resp: Response | null | undefined): Promise<void> {
  try {
    await resp?.body?.cancel();
  } catch {
    // ignore cleanup errors
  }
}

async function storeAndSign(
  supabase: ReturnType<typeof serviceClient>,
  bytes: Uint8Array,
  safeName: string,
  contentType: string,
): Promise<{ path: string; previewUrl: string | null } | null> {
  const path = `${crypto.randomUUID()}/${safeName}`;
  const { error } = await supabase.storage
    .from("application-uploads")
    .upload(path, bytes, { contentType, upsert: false });
  if (error) {
    console.error("Upload failed:", error);
    return null;
  }
  const { data, error: signErr } = await supabase.storage
    .from("application-uploads")
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (signErr) console.error("Sign failed:", signErr);
  return { path, previewUrl: signErr ? null : data.signedUrl };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action: string = body?.action;
    const applicant: Applicant = body?.applicant ?? {};

    if (!applicant?.name || !applicant?.grade || !applicant?.email) {
      return json({ error: "Name, grade and email are required." }, 400);
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(applicant.email)) {
      return json({ error: "Please enter a valid email address." }, 400);
    }

    const transcript: Turn[] = sanitizeTranscript(body?.transcript);

    if (action === "next") {
      const asked = transcript.length;
      // Q1 is standardized: serve free with zero provider calls.
      if (asked === 0) return json({ done: false, question: Q1_QUESTION });
      const messages: ChatMessage[] = [
        { role: "system", content: INTERVIEW_SYSTEM },
        {
          role: "user",
          content:
            `${transcriptText(applicant, transcript)}\n\nQuestions asked so far: ${asked}. ` +
            (asked === 0
              ? "Give the FIRST question (start with robotics experience)."
              : asked >= 10
              ? "You have reached the limit. Finish the interview now."
              : "Give the NEXT question, or finish if all required topics are covered and at least 8 questions were asked."),
        },
      ];

      const raw = await callAI(messages, { json: true }).catch((err) => {
        console.error("AI chain failed, serving bank question:", err);
        return null;
      });
      if (raw === null) {
        return json(bankNext(asked, transcript.map((t) => ({ question: t.question, answer: t.answer }))));
      }
      try {
        const parsed = parseJsonObject<Record<string, unknown>>(raw);
        // Full contract gate (shape + per-type fields + uniqueness):
        // any violation falls through to the static bank.
        assertInterviewContract(parsed);
        return json(parsed);
      } catch {
        console.error("AI response unusable, serving bank question");
        return json(bankNext(asked, transcript.map((t) => ({ question: t.question, answer: t.answer }))));
      }
    }

    if (action === "submit") {
      if (transcript.length === 0) return json({ error: "Nothing to submit yet." }, 400);

      const attachments = Array.isArray(body?.attachments) ? body.attachments.slice(0, 10) : [];

      let rank: Record<string, unknown> = {};
      try {
        const raw = await callAI(
          [
            { role: "system", content: RANK_SYSTEM },
            { role: "user", content: transcriptText(applicant, transcript) },
          ],
          { json: true },
        );
        rank = parseJsonObject(raw);
      } catch (err) {
        console.error("Ranking failed, using structured fallback:", err);
        rank = fallbackRank(transcript);
      }

      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

      const scoreRaw = Number(rank.score);
      // Sentinel: -1 means "AI failed" (manual review). Never clamp it away.
      const aiScore = scoreRaw === -1
        ? -1
        : Number.isFinite(scoreRaw)
        ? Math.max(0, Math.min(100, Math.round(scoreRaw)))
        : null;
      const { error } = await supabase.from("applications").insert({
        name: String(applicant.name).slice(0, 200),
        grade: String(applicant.grade).slice(0, 20),
        email: String(applicant.email).slice(0, 200),
        transcript,
        attachments,
        ai_score: aiScore,
        ai_recommendation: rankStr(rank.recommendation, 500),
        ai_summary: rankStr(rank.summary, 1000),
        ai_strengths: rankStr(rank.strengths, 500),
        ai_concerns: rankStr(rank.concerns, 500),
        robotics_experience: rankStr(rank.robotics_experience, 500),
        commit_10_hours: rankStr(rank.commit_10_hours, 500),
        parent_volunteer: rankStr(rank.parent_volunteer, 500),
      });

      if (error) {
        console.error("Insert failed:", error);
        return json({ error: "Could not save your application. Please try again." }, 500);
      }

      return json({ ok: true });
    }

    if (action === "upload") {
      const { fileName, contentType, dataBase64 } = body ?? {};
      if (typeof fileName !== "string" || !fileName.trim()) {
        return json({ error: "No file provided." }, 400);
      }
      if (typeof dataBase64 !== "string") return json({ error: "No file provided." }, 400);
      const ct = typeof contentType === "string"
        ? contentType.split(";")[0].trim().toLowerCase()
        : "";
      if (!ALLOWED_UPLOAD_TYPES.some((p) => ct.startsWith(p))) {
        return json({ error: "Only PDF, image, video or audio files can be uploaded." }, 400);
      }
      if (dataBase64.startsWith("data:")) return json({ error: "Invalid file data." }, 400);
      if (dataBase64.length > 20000000) return json({ error: "File must be under 10MB." }, 400);
      const stripped = dataBase64.replace(/[\t\n\f\r ]/g, "");
      if (stripped.length === 0) return json({ error: "Invalid file data." }, 400);
      if (stripped.length > MAX_B64_LEN) return json({ error: "File must be under 10MB." }, 400);
      if (stripped.length % 4 === 1) return json({ error: "Invalid file data." }, 400);
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(stripped)) {
        return json({ error: "Invalid file data." }, 400);
      }
      if (stripped.includes("=") && !/^[^=]*={1,2}$/.test(stripped)) {
        return json({ error: "Invalid file data." }, 400);
      }
      if (stripped.includes("=") && stripped.length % 4 !== 0) {
        return json({ error: "Invalid file data." }, 400);
      }
      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(stripped), (c) => c.charCodeAt(0));
      } catch {
        return json({ error: "Invalid file data." }, 400);
      }
      if (bytes.length === 0) return json({ error: "Invalid file data." }, 400);
      if (bytes.length > MAX_FILE_BYTES) return json({ error: "File must be under 10MB." }, 400);

      const supabase = serviceClient();
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
      const stored = await storeAndSign(supabase, bytes, safeName, ct);
      if (!stored) return json({ error: "Upload failed." }, 500);
      return json({
        ok: true,
        path: stored.path,
        previewUrl: stored.previewUrl,
        name: fileName.slice(0, 120),
        size: bytes.length,
        contentType: ct,
      });
    }

    if (action === "refresh") {
      const ip = getClientIp(req);
      if (isRefreshRateLimited(ip)) {
        return json({ error: "Rate limits exceeded, please try again in a moment." }, 429);
      }
      const paths: string[] = Array.isArray(body?.paths)
        ? body.paths.filter((p: unknown): p is string => typeof p === "string").slice(0, 10)
        : [];
      if (paths.length === 0) return json({ error: "No files provided." }, 400);

      const supabase = serviceClient();
      const urls: Record<string, string | null> = {};
      await Promise.all(paths.map(async (p) => {
        const { data, error } = await supabase.storage
          .from("application-uploads")
          .createSignedUrl(p, SIGNED_URL_SECONDS);
        urls[p] = error ? null : data.signedUrl;
      }));
      return json({ ok: true, urls });
    }

    if (action === "delete") {
      const path = body?.path;
      if (!isValidDeletePath(path)) return json({ error: "No file provided." }, 400);
      const supabase = serviceClient();
      const { error } = await supabase.storage.from("application-uploads").remove([path]);
      if (error) {
        console.error("Delete failed:", error);
        return json({ error: "Could not delete file." }, 500);
      }
      return json({ ok: true });
    }

    if (action === "fetchUrl") {
      const rawUrl = body?.url;
      if (typeof rawUrl !== "string" || !rawUrl.trim()) {
        return json({ error: "No URL provided." }, 400);
      }
      let current: URL;
      try {
        current = new URL(rawUrl.trim());
      } catch {
        return json({ error: "That URL doesn't look valid." }, 400);
      }
      const firstErr = await validateHop(current);
      if (firstErr) return json({ error: firstErr }, 400);

      const deadline = Date.now() + FETCH_TIMEOUT_MS;
      let resp: Response | null = null;
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const msLeft = deadline - Date.now();
        if (msLeft <= 0) {
          await cancelBody(resp);
          return json({ error: "Download was interrupted." }, 400);
        }
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), msLeft);
        try {
          resp = await fetch(current.toString(), { signal: ctrl.signal, redirect: "manual" });
        } catch {
          clearTimeout(timer);
          return json({ error: "Could not download that link." }, 400);
        }
        clearTimeout(timer);
        if (resp.status < 300 || resp.status >= 400) break;
        const loc = resp.headers.get("location");
        await resp.body?.cancel().catch(() => {});
        if (!loc) return json({ error: "That link didn't download (server said no)." }, 400);
        if (hop === MAX_REDIRECTS) {
          return json({ error: "That link redirects too many times." }, 400);
        }
        let next: URL;
        try {
          next = new URL(loc, current);
        } catch {
          return json({ error: "That link didn't download (server said no)." }, 400);
        }
        const hopErr = await validateHop(next);
        if (hopErr) return json({ error: hopErr }, 400);
        current = next;
        resp = null;
      }
      if (!resp) return json({ error: "Could not download that link." }, 400);
      try {
        const finalErr = await validateHop(new URL(resp.url || current.toString()));
        if (finalErr) {
          await resp.body?.cancel().catch(() => {});
          return json({ error: finalErr }, 400);
        }
      } catch {
        await resp.body?.cancel().catch(() => {});
        return json({ error: "That link didn't download (server said no)." }, 400);
      }
      if (!resp.ok) {
        await resp.body?.cancel().catch(() => {});
        return json({ error: "That link didn't download (server said no)." }, 400);
      }

      const ct = (resp.headers.get("content-type") || "application/octet-stream")
        .split(";")[0].trim().toLowerCase();
      if (!ALLOWED_URL_TYPES.some((p) => ct.startsWith(p))) {
        await resp.body?.cancel().catch(() => {});
        return json({ error: "Only PDF, image, video or audio links can be imported." }, 400);
      }
      const declared = Number(resp.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > MAX_FILE_BYTES) {
        await resp.body?.cancel().catch(() => {});
        return json({ error: "File must be under 10MB." }, 400);
      }

      const chunks: Uint8Array[] = [];
      let total = 0;
      try {
        const reader = resp.body!.getReader();
        for (;;) {
          const msLeft = deadline - Date.now();
          if (msLeft <= 0) {
            await reader.cancel().catch(() => {});
            return json({ error: "Download was interrupted." }, 400);
          }
          const readP = reader.read();
          const timeoutP = new Promise<"timeout">((resolve) =>
            setTimeout(() => resolve("timeout"), msLeft)
          );
          const out = await Promise.race([readP, timeoutP]);
          if (out === "timeout") {
            readP.catch(() => {});
            await reader.cancel().catch(() => {});
            return json({ error: "Download was interrupted." }, 400);
          }
          const { done, value } = out as ReadableStreamReadResult<Uint8Array>;
          if (done) break;
          total += value.length;
          if (total > MAX_FILE_BYTES) {
            await reader.cancel().catch(() => {});
            return json({ error: "File must be under 10MB." }, 400);
          }
          chunks.push(value);
        }
      } catch {
        return json({ error: "Download was interrupted." }, 400);
      }
      const bytes = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        bytes.set(c, off);
        off += c.length;
      }

      const cd = resp.headers.get("content-disposition") ?? "";
      let base = parseFilename(cd) ?? current.pathname.split("/").pop() ?? "download";
      base = base.trim().replace(/^.*[\\/]/, "") || "download";
      base = base.slice(0, 120);
      let safeName = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "_").slice(-80) ||
        "download";
      if (ct === "application/pdf" && !safeName.toLowerCase().endsWith(".pdf")) safeName += ".pdf";

      const supabase = serviceClient();
      const stored = await storeAndSign(supabase, bytes, safeName, ct);
      if (!stored) return json({ error: "Upload failed." }, 500);
      return json({
        ok: true,
        path: stored.path,
        previewUrl: stored.previewUrl,
        name: safeName,
        size: total,
        contentType: ct,
      });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    console.error("application-interview error:", e);
    // User-actionable upstream signals keep exact text + status.
    if (e instanceof Error && (e as Error & { status?: unknown }).status === 429) {
      return json({ error: "Rate limits exceeded, please try again in a moment." }, 429);
    }
    if (e instanceof Error && (e as Error & { status?: unknown }).status === 402) {
      return json({ error: "AI credits are exhausted. Please contact the team." }, 402);
    }
    if (e instanceof SyntaxError) {
      return json({ error: "Invalid request body." }, 400);
    }
    // Sanitizer errors carry our own safe message.
    if (e instanceof Error && (e as { status?: unknown })?.status === 400) {
      return json({ error: e.message }, 400);
    }
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
