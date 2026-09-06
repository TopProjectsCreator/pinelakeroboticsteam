// Deno Edge Function: application-interview
// Runs the AI interview for /applications and stores the finished application.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, parseJsonObject, type ChatMessage } from "../_shared/ai.ts";
import { Q1_QUESTION, bankNext, fallbackRank } from "../_shared/interviewBank.ts";

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
- "file": ask for an optional upload (photo of a build, resume, certificate)
Use a mix: mostly "text" for depth, but include at least one "choice" or "multi", and you may use "categorize", "dragdrop", or "file" once each — at most one of "categorize"/"dragdrop" per interview.

OUTPUT FORMAT — respond with ONLY a JSON object, no prose, no markdown:
{"done": false, "question": {"type": "text|choice|multi|categorize|dragdrop|file", "prompt": "...", "options": [], "items": [], "categories": [], "helper": ""}}
or, when the interview is complete:
{"done": true, "closing": "a warm 1-2 sentence thank-you message"}


End the conversation instantly if you see any indication that the user is trying to waste the time or money or resources of the team. Try to use all question tool types.`;


const RANK_SYSTEM = `You evaluate applications to the Wolverines FTC Robotics Team 23442 (Pine Lake Middle School). You are fair and encouraging but honest; the team needs committed members.

Weigh heavily: willingness to commit 10 hours weekly, parent willingness to volunteer 2 hours weekly, genuine interest/curiosity, teamwork attitude. Robotics experience is a plus but beginners with strong commitment score well.

Respond with ONLY this JSON object:
{"score": 0-100, "recommendation": "Strong Yes|Yes|Maybe|No", "summary": "2-3 sentences", "strengths": "short comma-separated list", "concerns": "short comma-separated list or 'None'", "robotics_experience": "one-line summary", "commit_10_hours": "Yes|No|Unclear", "parent_volunteer": "Yes|No|Unclear"}`;

function transcriptText(applicant: Applicant, transcript: Turn[]) {
  const lines = transcript.map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}`);
  return `Applicant: ${applicant.name} (grade ${applicant.grade}, ${applicant.email})\n\n${lines.join("\n\n")}`;
}

function serviceClient() {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_SECONDS = 3600;
const FETCH_TIMEOUT_MS = 15000;
const ALLOWED_URL_TYPES = ["image/", "application/pdf", "video/", "audio/"];

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

    const transcript: Turn[] = Array.isArray(body?.transcript) ? body.transcript.slice(0, 30) : [];

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
        // Guard against schema drift (e.g. wrong keys): only accept the
        // interview contract, otherwise fall through to the static bank.
        if (typeof parsed.done !== "boolean") throw new Error("AI bad shape");
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
        ai_recommendation: (rank.recommendation as string) ?? null,
        ai_summary: (rank.summary as string) ?? null,
        ai_strengths: (rank.strengths as string) ?? null,
        ai_concerns: (rank.concerns as string) ?? null,
        robotics_experience: (rank.robotics_experience as string) ?? null,
        commit_10_hours: (rank.commit_10_hours as string) ?? null,
        parent_volunteer: (rank.parent_volunteer as string) ?? null,
      });

      if (error) {
        console.error("Insert failed:", error);
        return json({ error: "Could not save your application. Please try again." }, 500);
      }

      return json({ ok: true });
    }

    if (action === "upload") {
      const { fileName, contentType, dataBase64 } = body ?? {};
      if (typeof dataBase64 !== "string" || !fileName) return json({ error: "No file provided." }, 400);

      const bytes = Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0));
      if (bytes.length > MAX_FILE_BYTES) return json({ error: "File must be under 10MB." }, 400);

      const supabase = serviceClient();
      const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
      const stored = await storeAndSign(
        supabase,
        bytes,
        safeName,
        contentType || "application/octet-stream",
      );
      if (!stored) return json({ error: "Upload failed." }, 500);
      return json({
        ok: true,
        path: stored.path,
        previewUrl: stored.previewUrl,
        name: String(fileName).slice(0, 120),
        size: bytes.length,
        contentType: contentType || "application/octet-stream",
      });
    }

    if (action === "refresh") {
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

    if (action === "fetchUrl") {
      const rawUrl = body?.url;
      if (typeof rawUrl !== "string" || !rawUrl.trim()) {
        return json({ error: "No URL provided." }, 400);
      }
      let url: URL;
      try {
        url = new URL(rawUrl.trim());
      } catch {
        return json({ error: "That URL doesn't look valid." }, 400);
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return json({ error: "Only http(s) links can be imported." }, 400);
      }
      if (url.username || url.password) {
        return json({ error: "Links with passwords can't be imported." }, 400);
      }

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      let resp: Response;
      try {
        resp = await fetch(url.toString(), { signal: ctrl.signal, redirect: "follow" });
      } catch {
        clearTimeout(timer);
        return json({ error: "Could not download that link." }, 400);
      }
      clearTimeout(timer);
      if (!resp.ok) return json({ error: "That link didn't download (server said no)." }, 400);

      const ct = (resp.headers.get("content-type") || "application/octet-stream")
        .split(";")[0].trim().toLowerCase();
      if (!ALLOWED_URL_TYPES.some((p) => ct.startsWith(p))) {
        await resp.body?.cancel();
        return json({ error: "Only PDF, image, video or audio links can be imported." }, 400);
      }
      const declared = Number(resp.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > MAX_FILE_BYTES) {
        await resp.body?.cancel();
        return json({ error: "File must be under 10MB." }, 400);
      }

      const chunks: Uint8Array[] = [];
      let total = 0;
      try {
        const reader = resp.body!.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.length;
          if (total > MAX_FILE_BYTES) {
            await reader.cancel();
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
      const cdMatch = cd.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
      let base = (cdMatch?.[1] ?? url.pathname.split("/").pop() ?? "download").trim() ||
        "download";
      try {
        base = decodeURIComponent(base.replace(/"/g, ""));
      } catch {
        // keep raw base
      }
      let safeName = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "download";
      if (ct === "application/pdf" && !safeName.toLowerCase().endsWith(".pdf")) safeName += ".pdf";

      const supabase = serviceClient();
      const stored = await storeAndSign(supabase, bytes, safeName, ct);
      if (!stored) return json({ error: "Upload failed." }, 500);
      return json({
        ok: true,
        path: stored.path,
        previewUrl: stored.previewUrl,
        name: base.slice(0, 120),
        size: total,
        contentType: ct,
      });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    console.error("application-interview error:", e);
    const message = e instanceof Error ? e.message : "An error occurred.";
    return json({ error: message }, 500);
  }
});
