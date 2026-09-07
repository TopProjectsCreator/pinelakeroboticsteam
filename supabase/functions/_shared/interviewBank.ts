// Static fallback interview bank: serves applicants when all AI providers fail.
// Deterministic and dependency-free (no Deno/remote imports) so it stays
// testable. Q1 is always served free (no provider call).

export interface BankTurn {
  question: string;
  answer: string;
}

export interface BankQuestion {
  type: "text" | "choice" | "multi" | "categorize" | "dragdrop" | "file";
  prompt: string;
  options?: string[];
  items?: string[];
  categories?: string[];
  helper?: string;
  /** Topic keywords: a bank question is skipped when its topic already
   *  appears anywhere in the transcript (avoids repeats in mixed
   *  AI + bank interviews). */
  keys: string[];
}

export const Q1_QUESTION: BankQuestion = {
  type: "text",
  prompt: "Welcome! To get us started, what experience do you have with robotics?",
  helper: "Feel free to share any projects, clubs, or kits you've worked with.",
  keys: ["robotics", "experience"],
};

export const BANK_QUESTIONS: BankQuestion[] = [
  {
    type: "text",
    prompt: "What made you want to join the FTC team?",
    helper: "There are no wrong answers — we just want to know what excites you.",
    keys: ["join the ftc", "want to join"],
  },
  {
    type: "choice",
    prompt: "Can you commit to about 10 hours a week for practices and competitions?",
    options: ["Yes", "Not sure", "No"],
    helper: "Includes weekday practices plus some Saturdays.",
    keys: ["10 hours", "commit"],
  },
  {
    type: "choice",
    prompt: "Can your parents volunteer about 2 hours a week at the school?",
    options: ["Yes", "Need to ask them", "No"],
    helper: "Volunteering usually means helping supervise practices at Pine Lake Middle School.",
    keys: ["volunteer", "parents"],
  },
  {
    type: "multi",
    prompt: "Which of these sound most fun to you? Pick all that apply.",
    options: [
      "Building & mechanisms",
      "Programming & autonomous",
      "CAD & design",
      "Engineering notebook",
      "Outreach & teamwork",
      "Strategy & scouting",
    ],
    keys: ["fun", "pick all"],
  },
  {
    type: "text",
    prompt:
      "Tell me about a time you worked on a team — anything counts: sports, a school project, family. What went well?",
    helper: "A few sentences is plenty.",
    keys: ["team"],
  },
  {
    type: "text",
    prompt: "What's something you most want to learn or get better at this season?",
    helper:
      "Maybe you want to get better at CAD, try programming for the first time, or explore something totally new.",
    keys: ["learn", "better at"],
  },
  {
    type: "file",
    prompt: "Optional: share a photo of something you've built, a certificate, or a short resume — or skip.",
    keys: ["photo", "resume", "upload", "share a photo"],
  },
  {
    type: "text",
    prompt: "Last one: anything else we should know — schedule conflicts, skills, or questions for us?",
    keys: ["anything else", "last one"],
  },
];

export const BANK_CLOSING =
  "Thanks for applying to the Wolverines! We'll review your application and reach out soon.";

/** Next bank step for `asked` answered questions (asked >= 1; Q1 served free).
 *  Skips topics already covered in mixed AI + bank transcripts. Always
 *  terminates: returns done once 8 questions are answered or all topics
 *  are covered. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function coversTopic(covered: string, key: string): boolean {
  return new RegExp(`\\b${escapeRegExp(key)}\\b`, "i").test(covered);
}

export function bankNext(
  asked: number,
  transcript: BankTurn[],
): { done: boolean; closing?: string; question?: BankQuestion } {
  if (asked >= 8) return { done: true, closing: BANK_CLOSING };
  const covered = transcript.map((t) => String(t?.question ?? "")).join("\n");
  const next = BANK_QUESTIONS.find((q) => !q.keys.some((k) => coversTopic(covered, k)));
  if (!next) return { done: true, closing: BANK_CLOSING };
  return { done: false, question: next };
}

function flagCommit(answer: unknown): string {
  const s = String(answer ?? "").trim().toLowerCase();
  if (!s) return "Unclear";
  if (s.startsWith("yes")) return "Yes";
  if (s === "no" || s.startsWith("no,") || s.startsWith("no ")) return "No";
  return "Unclear";
}

/** Structured rank fallback when AI ranking fails. Always marks the row
 *  unmistakably: score -1 ("AI failed") with a manual-review summary.
 *  The Q3/Q4-derived commitment flags and robotics snippet are still
 *  populated so the row stays triageable (filter `ai_score = -1` for the
 *  manual-review queue). */
export function fallbackRank(transcript: BankTurn[]): Record<string, unknown> {
  const findAnswer = (re: RegExp): string =>
    String(transcript.find((t) => re.test(String(t?.question ?? "")))?.answer ?? "");
  const commit = flagCommit(findAnswer(/10\s*(h|hour)|ten hours|commit/i));
  const parent = flagCommit(findAnswer(/volunteer/i));
  return {
    score: -1,
    recommendation: "AI failed",
    summary: "Automated review was unavailable; manual review required.",
    strengths: "Pending review",
    concerns: "Unreviewed",
    robotics_experience: String(transcript[0]?.answer ?? "See transcript").slice(0, 120) ||
      "See transcript",
    commit_10_hours: commit,
    parent_volunteer: parent,
  };
}

// ---------------------------------------------------------------------------
// Transcript sanitization (fix 10): single choke point for untrusted
// transcript payloads. Structural poison -> typed 400 (fail fast, never 500,
// never coerced garbage). Oversize honest text -> truncated, interview
// continues. Only picked fields survive (never Object.assign/merge).

export interface CleanTurn {
  question: string;
  answer: string;
  type?: string;
  raw?: string | string[] | Record<string, string> | null;
  options?: string[];
  items?: string[];
  categories?: string[];
  file?: { name: string; size: number; contentType: string; path?: string } | null;
  answered_at?: string;
}

export const QUESTION_CAP = 2000;
export const ANSWER_CAP = 5000;
export const PROMPT_TOTAL_CAP = 30000;

export function typed400(message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status: 400 });
}

function capStringArray(v: unknown, itemCap: number, arrCap: number): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.slice(0, itemCap))
    .slice(0, arrCap);
}

export function sanitizeTranscript(raw: unknown): CleanTurn[] {
  if (!Array.isArray(raw)) throw typed400("Transcript must be an array.");
  return raw.slice(0, 30).map((e) => {
    if (typeof e !== "object" || e === null || Array.isArray(e)) {
      throw typed400("Invalid transcript entry.");
    }
    const o = e as Record<string, unknown>;
    if (typeof o.question !== "string" || typeof o.answer !== "string") {
      throw typed400("Invalid transcript entry.");
    }
    if (!o.question.trim() && !o.answer.trim()) throw typed400("Invalid transcript entry.");
    const out: CleanTurn = {
      question: o.question.slice(0, QUESTION_CAP),
      answer: o.answer.slice(0, ANSWER_CAP),
    };
    if (typeof o.type === "string") out.type = o.type.slice(0, 20);
    if (typeof o.answered_at === "string") out.answered_at = o.answered_at.slice(0, 40);
    if (o.raw === null || typeof o.raw === "string") {
      out.raw = typeof o.raw === "string" ? o.raw.slice(0, ANSWER_CAP) : null;
    } else if (Array.isArray(o.raw)) {
      out.raw = capStringArray(o.raw, 500, 20);
    } else if (typeof o.raw === "object") {
      const r: Record<string, string> = {};
      for (const [k, v] of Object.entries(o.raw).slice(0, 20)) {
        if (typeof v === "string") r[String(k).slice(0, 200)] = v.slice(0, 500);
      }
      out.raw = r;
    }
    const opts = capStringArray(o.options, 500, 10);
    if (opts) out.options = opts;
    const items = capStringArray(o.items, 500, 10);
    if (items) out.items = items;
    const cats = capStringArray(o.categories, 500, 10);
    if (cats) out.categories = cats;
    if (o.file && typeof o.file === "object" && !Array.isArray(o.file)) {
      const f = o.file as Record<string, unknown>;
      out.file = {
        name: String(f.name ?? "").slice(0, 120),
        size: Number.isFinite(Number(f.size))
          ? Math.max(0, Math.min(10 * 1024 * 1024, Number(f.size)))
          : 0,
        contentType: String(f.contentType ?? "").slice(0, 100),
        ...(typeof f.path === "string" ? { path: f.path.slice(0, 300) } : {}),
      };
    }
    return out;
  });
}

// ---------------------------------------------------------------------------
// Interview contract validation (fix 11) + uniqueness backstop (fix 14).
// Throws on ANY violation -> caller falls back to bankNext. Unknown fields
// are preserved (forward-compatible). Bank constants must always pass.

export const VALID_QUESTION_TYPES = ["text", "choice", "multi", "categorize", "dragdrop", "file"] as const;
type ValidQuestionType = typeof VALID_QUESTION_TYPES[number];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNonBlankString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;
const isNonBlankStringArray = (v: unknown, min: number, max: number): v is string[] =>
  Array.isArray(v) && v.length >= min && v.length <= max &&
  v.every((x) => typeof x === "string" && (x as string).trim().length > 0);

function hasDup(arr: string[]): boolean {
  const t = arr.map((s) => s.trim());
  if (new Set(t).size !== t.length) return true;
  return new Set(t.map((s) => s.toLowerCase())).size !== t.length;
}

export function assertInterviewContract(parsed: Record<string, unknown>): void {
  if (typeof parsed.done !== "boolean") throw new Error("AI bad shape: done must be boolean");
  if (parsed.done === true) {
    if (!isNonBlankString(parsed.closing)) throw new Error("AI bad shape: closing must be non-blank string");
    return;
  }
  const q = parsed.question;
  if (!isRecord(q)) throw new Error("AI bad shape: question must be object");
  if (!VALID_QUESTION_TYPES.includes(q.type as ValidQuestionType)) {
    throw new Error(`AI bad shape: unknown question.type ${JSON.stringify(q.type)}`);
  }
  if (!isNonBlankString(q.prompt)) throw new Error("AI bad shape: question.prompt must be non-blank string");
  if ((q.prompt as string).length > 500) throw new Error("AI bad shape: question.prompt too long");
  for (const f of ["options", "items", "categories"] as const) {
    const arr = q[f];
    if (Array.isArray(arr)) {
      for (const s of arr) {
        if (typeof s === "string" && s.length > 200) {
          throw new Error(`AI bad shape: question.${f} entry too long`);
        }
      }
    }
  }
  if (JSON.stringify(q).length > 5 * 1024) throw new Error("AI bad shape: question too large");
  const t = q.type as ValidQuestionType;
  if (t === "choice" || t === "multi") {
    if (!isNonBlankStringArray(q.options, 2, 10)) {
      throw new Error(`AI bad shape: ${t} requires 2-10 non-blank options`);
    }
    if (hasDup(q.options as string[])) throw new Error(`AI bad shape: duplicate options`);
  }
  if (t === "categorize" || t === "dragdrop") {
    if (!isNonBlankStringArray(q.items, 2, 10)) {
      throw new Error(`AI bad shape: ${t} requires 2-10 non-blank items`);
    }
    if (!isNonBlankStringArray(q.categories, 2, 10)) {
      throw new Error(`AI bad shape: ${t} requires 2-10 non-blank categories`);
    }
    if (hasDup(q.items as string[]) || hasDup(q.categories as string[])) {
      throw new Error(`AI bad shape: duplicate items/categories`);
    }
  }
}

// Pure validation for the `delete` Edge action's storage path.
export function isValidDeletePath(p: unknown): p is string {
  return typeof p === "string" && p.trim().length > 0 && p.length <= 300;
}
