// Unit tests for the static fallback bank (no network, no Deno APIs).
import {
  BANK_QUESTIONS,
  Q1_QUESTION,
  assertInterviewContract,
  bankNext,
  fallbackRank,
  isValidDeletePath,
  sanitizeTranscript,
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

function assertThrows400(fn: () => unknown, label: string): void {
  try {
    fn();
  } catch (e) {
    assert((e as { status?: unknown })?.status === 400, `${label} throws typed 400`);
    return;
  }
  throw new Error(`${label} did not throw`);
}

Deno.test("sanitize rejects structural poison with typed 400", () => {
  assertThrows400(() => sanitizeTranscript({} as unknown), "non-array object");
  assertThrows400(() => sanitizeTranscript("hi" as unknown), "string");
  assertThrows400(() => sanitizeTranscript(123 as unknown), "number");
  for (const bad of [null, 123, "hi", [], {}, { question: null }, { question: 123 }, { answer: {} }]) {
    assertThrows400(() => sanitizeTranscript([bad]), `entry ${JSON.stringify(bad)}`);
  }
});

Deno.test("sanitize truncates giant fields, preserves unicode", () => {
  const t = sanitizeTranscript([{ question: "q".repeat(100000), answer: "a".repeat(100000) }]);
  assert(t[0].question.length === 2000, "question capped 2000");
  assert(t[0].answer.length === 5000, "answer capped 5000");
  const u = sanitizeTranscript([{ question: "Robô 🤖 你好?", answer: "Yes 🎉" }]);
  assert(u[0].question.includes("🤖") && u[0].answer.includes("🎉"), "unicode passthrough");
});

Deno.test("sanitize keeps honest extras, drops unknown keys", () => {
  const t = sanitizeTranscript([{
    question: "Pick all",
    answer: "a, b",
    type: "multi",
    raw: ["a", "b"],
    options: ["a", "b"],
    foo: "bar",
    answered_at: "2026-01-01",
  }]);
  assert(t[0].type === "multi", "type kept");
  assert(Array.isArray(t[0].raw) && (t[0].raw as string[]).length === 2, "raw kept");
  assert(!("foo" in t[0]), "foo dropped");
});

Deno.test("bank constants pass the contract validator (self-consistent)", () => {
  assertInterviewContract({ done: false, question: { ...Q1_QUESTION } });
  for (const q of BANK_QUESTIONS) assertInterviewContract({ done: false, question: { ...q } });
  assertInterviewContract({ done: true, closing: "Thanks!" });
});

Deno.test("validator accepts valid shapes, keeps unknown fields", () => {
  assertInterviewContract({
    done: false,
    question: { type: "dragdrop", prompt: "Sort", items: ["A", "B"], categories: ["X", "Y"] },
    future: 1,
  });
  assertInterviewContract({
    done: false,
    question: { type: "choice", prompt: "Pick", options: ["Yes", "No"] },
  });
});

Deno.test("validator rejects degenerate shapes", () => {
  const bad: unknown[] = [
    { done: false },
    { done: true },
    { done: false, question: {} },
    { done: false, question: { type: "Choice", prompt: "p", options: ["a", "b"] } },
    { done: false, question: { type: "text", prompt: "   " } },
    { done: false, question: { type: "choice", prompt: "p", options: ["Only"] } },
    { done: false, question: { type: "multi", prompt: "p", options: ["A", 5, {}] } },
    { done: false, question: { type: "categorize", prompt: "p", items: ["A"], categories: ["X"] } },
    { done: false, question: { type: "dragdrop", prompt: "p", items: ["A", "A"], categories: ["X", "Y"] } },
    { done: false, question: { type: "dragdrop", prompt: "p", items: ["A", "B"], categories: ["X", "x"] } },
    { done: false, question: { type: "choice", prompt: "p", options: Array.from({ length: 100 }, (_, i) => `o${i}`) } },
    { done: true, closing: "" },
  ];
  for (const b of bad) {
    let threw = false;
    try {
      assertInterviewContract(b as Record<string, unknown>);
    } catch {
      threw = true;
    }
    assert(threw, `rejects ${JSON.stringify(b).slice(0, 80)}`);
  }
});

Deno.test("bank word-boundary: 'teamwork' does not cover key 'team'", () => {
  const t = [
    { question: "What made you want to join the ftc club?", answer: "Robots!" },
    { question: "Can you commit to 10 hours a week?", answer: "Yes" },
    { question: "Can your parents volunteer weekly?", answer: "Yes" },
    { question: "Which fun ones? pick all that apply", answer: "Building" },
    { question: "I love teamwork and collaboration!", answer: "Yes" },
  ];
  const n = bankNext(5, t);
  assert(n.done === false, "not done");
  assert(
    n.question?.prompt.includes("worked on a team"),
    `'teamwork' must not skip team Q, got ${n.question?.prompt}`,
  );
});

Deno.test("bank word-boundary: whole-word 'team' does cover key 'team'", () => {
  const t = [
    { question: "What made you want to join the ftc club?", answer: "Robots!" },
    { question: "Can you commit to 10 hours a week?", answer: "Yes" },
    { question: "Can your parents volunteer weekly?", answer: "Yes" },
    { question: "Which fun ones? pick all that apply", answer: "Building" },
    { question: "I worked on a TEAM project last year.", answer: "It went well" },
  ];
  const n = bankNext(5, t);
  assert(n.done === false, "not done");
  assert(
    !n.question?.prompt.includes("worked on a team"),
    `whole-word team must skip team Q, got ${n.question?.prompt}`,
  );
  assert(n.question?.prompt.includes("learn") || n.question?.prompt.includes("better at"), `skips to learn Q, got ${n.question?.prompt}`);
});

Deno.test("validator ceilings: accept at limits", () => {
  assertInterviewContract({
    done: false,
    question: { type: "text", prompt: "p".repeat(500) },
  });
  assertInterviewContract({
    done: false,
    question: { type: "choice", prompt: "Pick", options: ["a".repeat(200), "b".repeat(200)] },
  });
  assertInterviewContract({
    done: false,
    question: {
      type: "categorize",
      prompt: "Sort",
      items: ["i".repeat(200), "j".repeat(200)],
      categories: ["c".repeat(200), "d".repeat(200)],
    },
  });
});

Deno.test("validator ceilings: reject over limits", () => {
  const over: unknown[] = [
    { done: false, question: { type: "text", prompt: "p".repeat(501) } },
    { done: false, question: { type: "choice", prompt: "Pick", options: ["a".repeat(201), "b"] } },
    {
      done: false,
      question: { type: "multi", prompt: "Pick", options: ["a", "b".repeat(201)] },
    },
    {
      done: false,
      question: {
        type: "categorize",
        prompt: "Sort",
        items: ["A", "B"],
        categories: ["x".repeat(201), "y"],
      },
    },
    {
      done: false,
      question: {
        type: "dragdrop",
        prompt: "Sort",
        items: ["z".repeat(201), "B"],
        categories: ["X", "Y"],
      },
    },
  ];
  for (const b of over) {
    let threw = false;
    try {
      assertInterviewContract(b as Record<string, unknown>);
    } catch {
      threw = true;
    }
    assert(threw, `rejects ceiling breach ${JSON.stringify(b).slice(0, 80)}`);
  }
});

Deno.test("validator ceilings: reject 5.1KB question JSON", () => {
  const big = "q".repeat(Math.ceil(5.1 * 1024));
  let threw = false;
  try {
    assertInterviewContract({
      done: false,
      question: { type: "text", prompt: "ok", helper: big },
    });
  } catch {
    threw = true;
  }
  assert(threw, "rejects 5.1KB question JSON");
});

Deno.test("delete path validation", () => {
  assert(isValidDeletePath("abc/file.png") === true, "valid path");
  assert(isValidDeletePath("") === false, "empty rejected");
  assert(isValidDeletePath("   ") === false, "blank rejected");
  assert(isValidDeletePath("x".repeat(300)) === true, "300 chars ok");
  assert(isValidDeletePath("x".repeat(301)) === false, "301 chars rejected");
  assert(isValidDeletePath(null) === false, "null rejected");
  assert(isValidDeletePath(123) === false, "number rejected");
  assert(isValidDeletePath(undefined) === false, "undefined rejected");
});
