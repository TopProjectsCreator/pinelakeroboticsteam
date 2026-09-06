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
export function bankNext(
  asked: number,
  transcript: BankTurn[],
): { done: boolean; closing?: string; question?: BankQuestion } {
  if (asked >= 8) return { done: true, closing: BANK_CLOSING };
  const covered = transcript.map((t) => t.question.toLowerCase()).join("\n");
  const next = BANK_QUESTIONS.find((q) => !q.keys.some((k) => covered.includes(k)));
  if (!next) return { done: true, closing: BANK_CLOSING };
  return { done: false, question: next };
}

function flagCommit(answer: string): string {
  const s = answer.trim().toLowerCase();
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
    transcript.find((t) => re.test(t.question))?.answer ?? "";
  const commit = flagCommit(findAnswer(/10\s*(h|hour)|ten hours|commit/i));
  const parent = flagCommit(findAnswer(/volunteer/i));
  return {
    score: -1,
    recommendation: "AI failed",
    summary: "Automated review was unavailable; manual review required.",
    strengths: "Pending review",
    concerns: "Unreviewed",
    robotics_experience: (transcript[0]?.answer ?? "See transcript").slice(0, 120) ||
      "See transcript",
    commit_10_hours: commit,
    parent_volunteer: parent,
  };
}
