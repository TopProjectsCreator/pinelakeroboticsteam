// Deno Edge Function: application-interview
// Runs the AI interview for /applications and stores the finished application.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, parseJsonObject, type ChatMessage } from "../_shared/ai.ts";

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

REQUIRED QUESTIONS (must all be asked at some point, phrased naturally):
1. "What experience do you have with robotics?" (then at least one drill-down follow-up)
2. "Are you willing to commit to 10 hours weekly?"
3. "Are your parents willing to commit 2 hours weekly coming into the school and volunteering?"

LENGTH: Ask between 8 and 10 questions total, then finish. Never exceed 10.

QUESTION TYPES — choose the best fit for each question:
- "text": free-form answer
- "choice": single select (provide 2-5 "options")
- "multi": select all that apply (provide 3-7 "options")
- "categorize": provide "items" (3-6 strings) and "categories" (2-3 strings); the applicant sorts each item into a category
- "file": ask for an optional upload (photo of a build, resume, certificate)
Use a mix: mostly "text" for depth, but include at least one "choice" or "multi", and you may use "categorize" or "file" once.

OUTPUT FORMAT — respond with ONLY a JSON object, no prose, no markdown:
{"done": false, "question": {"type": "text|choice|multi|categorize|file", "prompt": "...", "options": [], "items": [], "categories": [], "helper": ""}}
or, when the interview is complete:
{"done": true, "closing": "a warm 1-2 sentence thank-you message"}`;

const RANK_SYSTEM = `You evaluate applications to the Wolverines FTC Robotics Team 23442 (Pine Lake Middle School). You are fair and encouraging but honest; the team needs committed members.

Weigh heavily: willingness to commit 10 hours weekly, parent willingness to volunteer 2 hours weekly, genuine interest/curiosity, teamwork attitude. Robotics experience is a plus but beginners with strong commitment score well.

Respond with ONLY this JSON object:
{"score": 0-100, "recommendation": "Strong Yes|Yes|Maybe|No", "summary": "2-3 sentences", "strengths": "short comma-separated list", "concerns": "short comma-separated list or 'None'", "robotics_experience": "one-line summary", "commit_10_hours": "Yes|No|Unclear", "parent_volunteer": "Yes|No|Unclear"}`;

function transcriptText(applicant: Applicant, transcript: Turn[]) {
  const lines = transcript.map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}`);
  return `Applicant: ${applicant.name} (grade ${applicant.grade}, ${applicant.email})\n\n${lines.join("\n\n")}`;
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

      const raw = await callAI(messages, { json: true });
      let parsed: Record<string, unknown>;
      try {
        parsed = parseJsonObject(raw);
      } catch {
        parsed = { done: false, question: { type: "text", prompt: raw.trim().slice(0, 300) || "Tell me more about why you want to join the team." } };
      }
      return json(parsed);
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
        console.error("Ranking failed:", err);
      }

      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

      const scoreRaw = Number(rank.score);
      const { error } = await supabase.from("applications").insert({
        name: String(applicant.name).slice(0, 200),
        grade: String(applicant.grade).slice(0, 20),
        email: String(applicant.email).slice(0, 200),
        transcript,
        attachments,
        ai_score: Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : null,
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
      if (bytes.length > 10 * 1024 * 1024) return json({ error: "File must be under 10MB." }, 400);

      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

      const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
      const path = `${crypto.randomUUID()}/${safeName}`;
      const { error } = await supabase.storage
        .from("application-uploads")
        .upload(path, bytes, { contentType: contentType || "application/octet-stream", upsert: false });

      if (error) {
        console.error("Upload failed:", error);
        return json({ error: "Upload failed." }, 500);
      }
      return json({ ok: true, path });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    console.error("application-interview error:", e);
    const message = e instanceof Error ? e.message : "An error occurred.";
    return json({ error: message }, 500);
  }
});
