// Unit tests for the static fallback bank (no network, no Deno APIs).
import {
  BANK_QUESTIONS,
  Q1_QUESTION,
  bankNext,
  fallbackRank,
} from "./interviewBank.ts";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`assert failed: ${msg}`);
}

Deno.test("Q1 is a free text opener", () => {
  assert(Q1_QUESTION.type === "text", "Q1 type");
  assert(Q1_QUESTION.prompt.includes("robotics"), "Q1 prompt");
});

Deno.test("bank serves Q2 after Q1 with no repeats", () => {
  const t = [{ question: Q1_QUESTION.prompt, answer: "I did FLL." }];
  const n = bankNext(1, t);
  assert(n.done === false && n.question?.prompt.includes("FTC team"), "Q2 next");
});

Deno.test("bank skips topics already covered by AI questions", () => {
  const t = [
    { question: Q1_QUESTION.prompt, answer: "FLL" },
    { question: "Are your parents able to volunteer weekly?", answer: "Yes" },
    { question: "Can you commit to 10 hours a week?", answer: "Yes" },
  ];
  const n = bankNext(3, t);
  assert(n.done === false, "not done");
  assert(n.question?.prompt.includes("FTC team"), `interest Q2 next, got ${n.question?.prompt}`);
  // Q3 (commit) and Q4 (volunteer) must never reappear once covered:
  t.push({ question: n.question!.prompt, answer: "Because robots!" });
  const n2 = bankNext(4, t);
  assert(n2.question?.type === "multi", `skips to multi, got ${n2.question?.type}`);
});

Deno.test("bank always terminates at 8 answered", () => {
  const t = Array.from({ length: 8 }, (_, i) => ({ question: `Q${i}`, answer: "a" }));
  const n = bankNext(8, t);
  assert(n.done === true && typeof n.closing === "string", "done with closing");
});

Deno.test("bank terminates when all topics covered early", () => {
  const t = BANK_QUESTIONS.map((q) => ({ question: q.prompt, answer: "x" }));
  const n = bankNext(4, t);
  assert(n.done === true, "done when covered");
});

Deno.test("full bank walk asks 7 then closes", () => {
  const t = [{ question: Q1_QUESTION.prompt, answer: "FLL + VEX." }];
  let asked = 1;
  const seen: string[] = [];
  for (let i = 0; i < 10; i++) {
    const n = bankNext(asked, t);
    if (n.done) break;
    seen.push(n.question!.prompt);
    t.push({ question: n.question!.prompt, answer: "answer" });
    asked++;
  }
  assert(seen.length === 7, `7 bank questions, got ${seen.length}`);
  assert(new Set(seen).size === 7, "no repeats");
  const end = bankNext(asked, t);
  assert(end.done === true, "closes after Q8");
});

Deno.test("fallbackRank maps structured answers", () => {
  const t = [
    { question: Q1_QUESTION.prompt, answer: "Built robots" },
    { question: "Can you commit to about 10 hours a week?", answer: "Yes" },
    { question: "Can your parents volunteer?", answer: "Need to ask them" },
  ];
  const r = fallbackRank(t);
  assert(r["score"] === -1, `score -1, got ${r["score"]}`);
  assert(r["recommendation"] === "AI failed", "rec AI failed");
  assert(r["commit_10_hours"] === "Yes", "commit Yes");
  assert(r["parent_volunteer"] === "Unclear", "parent Unclear");
});

Deno.test("fallbackRank never misreads 'Not sure' as No", () => {
  const t = [
    { question: "q", answer: "x" },
    { question: "Can you commit to about 10 hours a week?", answer: "Not sure" },
    { question: "Can your parents volunteer?", answer: "No" },
  ];
  const r = fallbackRank(t);
  assert(r["commit_10_hours"] === "Unclear", "'Not sure' is Unclear");
  assert(r["parent_volunteer"] === "No", "'No' is No");
  assert(r["score"] === -1, `score -1, got ${r["score"]}`);
  assert(r["recommendation"] === "AI failed", "rec AI failed");
});

Deno.test("fallbackRank marks empty transcripts AI failed", () => {
  const r = fallbackRank([]);
  assert(r["score"] === -1, `empty scores -1, got ${r["score"]}`);
  assert(r["recommendation"] === "AI failed", "rec AI failed");
  assert(r["commit_10_hours"] === "Unclear", "empty Unclear");
});
