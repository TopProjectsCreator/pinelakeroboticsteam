import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, CheckCircle2, Upload } from "lucide-react";

type QuestionType = "text" | "choice" | "multi" | "categorize" | "file";

interface Question {
  type: QuestionType;
  prompt: string;
  options?: string[];
  items?: string[];
  categories?: string[];
  helper?: string;
}

interface Turn {
  question: string;
  answer: string;
  /** Exactly what the applicant did, unformatted */
  type?: Question["type"];
  raw?: string | string[] | Record<string, string> | null;
  /** Choices they were shown, when applicable */
  options?: string[];
  items?: string[];
  categories?: string[];
  file?: { name: string; size: number; contentType: string; path?: string } | null;
  answered_at?: string;
}


const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/application-interview`;
const GRADES = ["6th", "7th", "8th"];

const Applications = () => {
  const { toast } = useToast();
  const [stage, setStage] = useState<"intro" | "interview" | "done">("intro");
  const [applicant, setApplicant] = useState({ name: "", grade: "", email: "" });
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [closing, setClosing] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);

  // answer state
  const [text, setText] = useState("");
  const [multi, setMulti] = useState<string[]>([]);
  const [buckets, setBuckets] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    if (question?.type === "text") inputRef.current?.focus();
  }, [question, transcript.length]);

  const call = async (payload: Record<string, unknown>) => {
    const resp = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ applicant, ...payload }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || "Something went wrong.");
    return data;
  };

  const loadNext = async (nextTranscript: Turn[]) => {
    setLoading(true);
    try {
      const data = await call({ action: "next", transcript: nextTranscript });
      if (data.done) {
        setClosing(data.closing || "Thanks for applying!");
        setQuestion(null);
        await submitApplication(nextTranscript);
      } else {
        setQuestion(data.question);
        setText("");
        setMulti([]);
        setBuckets({});
      }
    } catch (e) {
      toast({
        title: "Interview error",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const submitApplication = async (finalTranscript: Turn[]) => {
    setSubmitting(true);
    try {
      await call({ action: "submit", transcript: finalTranscript, attachments });
      setStage("done");
    } catch (e) {
      toast({
        title: "Could not submit",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const startInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicant.name.trim() || !applicant.grade || !applicant.email.trim()) {
      toast({ title: "Please fill in all three fields.", variant: "destructive" });
      return;
    }
    setStage("interview");
    await loadNext([]);
  };

  const answer = (value: string, meta: Partial<Turn> = {}) => {
    if (!question) return;
    const next: Turn[] = [
      ...transcript,
      {
        question: question.prompt,
        answer: value,
        type: question.type,
        raw: meta.raw ?? value,
        ...(question.options ? { options: question.options } : {}),
        ...(question.items ? { items: question.items } : {}),
        ...(question.categories ? { categories: question.categories } : {}),
        ...(meta.file ? { file: meta.file } : {}),
        answered_at: new Date().toISOString(),
      },
    ];
    setTranscript(next);
    setQuestion(null);
    loadNext(next);
  };


  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const data = await call({
        action: "upload",
        fileName: file.name,
        contentType: file.type,
        dataBase64: btoa(binary),
      });
      setAttachments((prev) => [...prev, data.path]);
      answer(`Uploaded file: ${file.name}`, {
        raw: data.path,
        file: { name: file.name, size: file.size, contentType: file.type, path: data.path },
      });

    } catch (e) {
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  if (stage === "done") {
    return (
      <div className="container mx-auto px-4 py-24 max-w-2xl text-center">
        <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-6" />
        <h1 className="font-orbitron text-3xl font-bold mb-4">Application submitted!</h1>
        <p className="text-muted-foreground">{closing}</p>
        <p className="text-muted-foreground mt-4">
          We'll review your application and reach out at <span className="text-foreground">{applicant.email}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <header className="mb-10 text-center">
        <h1 className="font-orbitron text-4xl font-bold mb-3">Join the Wolverines</h1>
        <p className="text-muted-foreground">
          Apply to FTC Team 23442 at Pine Lake Middle School. Answer a few quick questions, then chat with our AI
          interviewer.
        </p>
      </header>

      {stage === "intro" && (
        <Card className="p-6">
          <form onSubmit={startInterview} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={applicant.name}
                onChange={(e) => setApplicant({ ...applicant, name: e.target.value })}
                placeholder="Your full name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Grade</Label>
              <div className="flex gap-2">
                {GRADES.map((g) => (
                  <Button
                    key={g}
                    type="button"
                    variant={applicant.grade === g ? "default" : "outline"}
                    onClick={() => setApplicant({ ...applicant, grade: g })}
                  >
                    {g}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">School Email</Label>
              <Input
                id="email"
                type="email"
                value={applicant.email}
                onChange={(e) => setApplicant({ ...applicant, email: e.target.value })}
                placeholder="you@example.com"
                required
              />
            </div>

            <Button type="submit" className="w-full">
              Start my interview
            </Button>
          </form>
        </Card>
      )}

      {stage === "interview" && (
        <div className="space-y-4">
          {transcript.map((t, i) => (
            <div key={i} className="space-y-2">
              <div className="bg-muted rounded-lg p-3 text-sm">{t.question}</div>
              <div className="bg-primary text-primary-foreground rounded-lg p-3 text-sm ml-auto max-w-[85%] w-fit">
                {t.answer}
              </div>
            </div>
          ))}

          {(loading || submitting) && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {submitting ? "Submitting and reviewing your application..." : "Thinking..."}
            </div>
          )}

          {question && !loading && (
            <Card className="p-5 space-y-4">
              <div>
                <p className="font-medium">{question.prompt}</p>
                {question.helper && <p className="text-sm text-muted-foreground mt-1">{question.helper}</p>}
              </div>

              {question.type === "text" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (text.trim()) answer(text.trim());
                  }}
                  className="space-y-3"
                >
                  <Textarea
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type your answer..."
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (text.trim()) answer(text.trim());
                      }
                    }}
                  />
                  <Button type="submit" disabled={!text.trim()}>
                    <Send className="h-4 w-4 mr-2" /> Send
                  </Button>
                </form>
              )}

              {question.type === "choice" && (
                <div className="flex flex-wrap gap-2">
                  {(question.options ?? []).map((o) => (
                    <Button key={o} variant="outline" onClick={() => answer(o)}>
                      {o}
                    </Button>
                  ))}
                </div>
              )}

              {question.type === "multi" && (
                <div className="space-y-3">
                  {(question.options ?? []).map((o) => (
                    <label key={o} className="flex items-center gap-3 cursor-pointer">
                      <Checkbox
                        checked={multi.includes(o)}
                        onCheckedChange={(c) =>
                          setMulti((prev) => (c ? [...prev, o] : prev.filter((x) => x !== o)))
                        }
                      />
                      <span className="text-sm">{o}</span>
                    </label>
                  ))}
                  <Button disabled={multi.length === 0} onClick={() => answer(multi.join(", "), { raw: multi })}>
                    Continue
                  </Button>
                </div>
              )}

              {question.type === "categorize" && (
                <div className="space-y-3">
                  {(question.items ?? []).map((item) => (
                    <div key={item} className="flex flex-wrap items-center gap-2">
                      <span className="text-sm flex-1 min-w-[120px]">{item}</span>
                      {(question.categories ?? []).map((cat) => (
                        <Button
                          key={cat}
                          size="sm"
                          variant={buckets[item] === cat ? "default" : "outline"}
                          onClick={() => setBuckets((prev) => ({ ...prev, [item]: cat }))}
                        >
                          {cat}
                        </Button>
                      ))}
                    </div>
                  ))}
                  <Button
                    disabled={(question.items ?? []).some((i) => !buckets[i])}
                    onClick={() =>
                      answer(
                        (question.items ?? []).map((i) => `${i} → ${buckets[i]}`).join("; "),
                        { raw: { ...buckets } },
                      )
                    }

                  >
                    Continue
                  </Button>
                </div>
              )}

              {question.type === "file" && (
                <div className="flex flex-wrap items-center gap-3">
                  <Label
                    htmlFor="app-file"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer hover:bg-muted"
                  >
                    <Upload className="h-4 w-4" /> Choose a file
                  </Label>
                  <input
                    id="app-file"
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                  <Button variant="ghost" onClick={() => answer("Skipped the upload", { raw: null })}>
                    Skip
                  </Button>
                </div>
              )}
            </Card>
          )}

          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};

export default Applications;
