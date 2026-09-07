import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import DragDropSort from "@/components/DragDropSort";
import { Loader2, Send, CheckCircle2, Upload, Image, FileText, Film, Music, Paperclip, Link, X } from "lucide-react";

type QuestionType = "text" | "choice" | "multi" | "categorize" | "dragdrop" | "file";

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


interface Attachment {
  path: string;
  previewUrl: string | null;
  name: string;
  size: number;
  contentType: string;
}

type AttachmentKind = "image" | "pdf" | "video" | "audio" | "file";

function kindOf(contentType: string): AttachmentKind {
  if (contentType.startsWith("image/")) return "image";
  if (contentType === "application/pdf") return "pdf";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  return "file";
}

function formatSize(n: number): string {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

// Degenerate-payload guards: non-array truthy values ("nope", 123) must not
// reach .map (white-screen crash), and blank strings must not count as data.
const usableStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim().length > 0) : [];

const hasDupStrings = (v: unknown): boolean => {
  const t = usableStrings(v).map((s) => s.trim());
  if (new Set(t).size !== t.length) return true;
  return new Set(t.map((s) => s.toLowerCase())).size !== t.length;
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function AttachmentPreview({
  attachment,
  onErrorRetry,
}: {
  attachment: Attachment;
  onErrorRetry?: () => void;
}) {
  const kind = kindOf(attachment.contentType);
  if (!attachment.previewUrl) {
    return <p className="text-sm text-muted-foreground">Preview unavailable for {attachment.name}.</p>;
  }
  if (kind === "image") {
    return <img src={attachment.previewUrl} alt={attachment.name} loading="lazy" className="max-h-64 rounded-md border" onError={onErrorRetry} />;
  }
  if (kind === "pdf") {
    return <iframe src={attachment.previewUrl} title={attachment.name} className="h-64 w-full rounded-md border" />;
  }
  if (kind === "video") {
    return <video src={attachment.previewUrl} controls preload="metadata" className="max-h-64 w-full rounded-md border" onError={onErrorRetry} />;
  }
  if (kind === "audio") {
    return <audio src={attachment.previewUrl} controls className="w-full" onError={onErrorRetry} />;
  }
  return (
    <a href={attachment.previewUrl} download={attachment.name} className="text-sm underline">
      Download {attachment.name}
    </a>
  );
}

function AttachmentIcon({ kind }: { kind: AttachmentKind }) {  const cls = "h-4 w-4 shrink-0";
  if (kind === "image") return <Image className={cls} />;
  if (kind === "pdf") return <FileText className={cls} />;
  if (kind === "video") return <Film className={cls} />;
  if (kind === "audio") return <Music className={cls} />;
  return <Paperclip className={cls} />;
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
  const [submitFailed, setSubmitFailed] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [importing, setImporting] = useState(false);
  const selectedAttachment =
    attachments.find((a) => a.path === selectedPath) ??
    attachments[attachments.length - 1] ?? null;

  // answer state
  const [text, setText] = useState("");
  const [multi, setMulti] = useState<string[]>([]);
  const [buckets, setBuckets] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Synchronous in-flight guard. State updates are async, so two taps in the
  // same tick would both pass a state-based check and double-submit.
  const inFlightRef = useRef(false);
  // Shared synchronous gate for both upload entries (file picker + URL
  // import). Held for the whole upload so concurrent starters serialize.
  const uploadGateRef = useRef(false);
  const mountedRef = useRef(true);
  const questionRef = useRef<Question | null>(null);
  const lastQuestionRef = useRef<Question | null>(null);
  const lastTranscriptRef = useRef<Turn[] | null>(null);
  const previewRetryRef = useRef<Set<string>>(new Set());
  const doneHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    questionRef.current = question;
    if (question) lastQuestionRef.current = question;
  });

  useEffect(() => {
    if (stage === "done") doneHeadingRef.current?.focus();
  }, [stage]);

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
        inFlightRef.current = false;
      }
    } catch (e) {
      inFlightRef.current = false;
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
    lastTranscriptRef.current = finalTranscript;
    setSubmitting(true);
    setSubmitFailed(false);
    inFlightRef.current = true;
    try {
      // Drop transcript turns that reference removed uploads so stored rows
      // never dangle. Only file-type string paths are considered; prose,
      // arrays, and records are never rewritten. Cap from the same list.
      const capped = attachments.map((a) => a.path).slice(0, 6);
      const allowed = new Set<string>(capped);
      const sanitized: Turn[] = finalTranscript.map((t) => {
        if (t.type !== "file") return t;
        const rawPath = typeof t.raw === "string" ? t.raw : null;
        const filePath = t.file?.path ?? null;
        if (rawPath === null && filePath === null) return t;
        const rawLooksPath = rawPath !== null && rawPath.includes("/");
        if (!rawLooksPath && filePath === null) return t;
        const rawOk = !rawLooksPath || allowed.has(rawPath as string);
        const fileOk = filePath === null || allowed.has(filePath);
        if (rawOk && fileOk) return t;
        return { ...t, raw: null, file: null };
      });
      await call({ action: "submit", transcript: sanitized, attachments: capped });
      setSubmitFailed(false);
      setStage("done");
    } catch (e) {
      setSubmitFailed(true);
      toast({
        title: "Could not submit",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      inFlightRef.current = false;
    }
  };

  const retrySubmit = () => {
    if (submitting || inFlightRef.current) return;
    const prev = lastTranscriptRef.current;
    if (!prev) return;
    submitApplication(prev);
  };

  const startInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current) return;
    if (!applicant.name.trim() || !applicant.grade || !applicant.email.trim()) {
      toast({ title: "Please fill in all three fields.", variant: "destructive" });
      return;
    }
    setStage("interview");
    inFlightRef.current = true;
    await loadNext([]);
  };

  const answer = (value: string, meta: Partial<Turn> = {}): boolean => {
    if (!question || loading || submitting || inFlightRef.current) return false;
    inFlightRef.current = true;
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
    return true;
  };


  const pushAttachment = (entry: Attachment) => {
    setAttachments((prev) => [...prev, entry]);
    setSelectedPath(entry.path);
  };

  const handleFile = async (file: File) => {
    if (uploadGateRef.current) return;
    if (!file || file.size === 0) {
      toast({ title: "Empty file, not uploaded.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast({ title: "File must be under 10MB.", variant: "destructive" });
      return;
    }
    uploadGateRef.current = true;
    setImporting(true);
    const promptAtEntry = questionRef.current?.prompt;
    let accepted = false;
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
      if (!mountedRef.current) return;
      if (questionRef.current?.prompt !== promptAtEntry) {
        toast({ title: "Upload superseded — already moved on.", variant: "destructive" });
        return;
      }
      const entry: Attachment = {
        path: data.path,
        previewUrl: data.previewUrl ?? null,
        name: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      };
      pushAttachment(entry);
      accepted = answer(`Uploaded file: ${file.name}`, {
        raw: entry.path,
        file: { name: entry.name, size: entry.size, contentType: entry.contentType, path: entry.path },
      });
      if (!accepted) {
        setAttachments((prev) => prev.filter((a) => a.path !== entry.path));
      }
    } catch (e) {
      if (!mountedRef.current) return;
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      uploadGateRef.current = false;
      if (mountedRef.current) setImporting(false);
    }
  };

  const handleUrlImport = async () => {
    const url = urlInput.trim();
    if (!url) return;
    if (uploadGateRef.current || importing) return;
    uploadGateRef.current = true;
    setImporting(true);
    const promptAtEntry = questionRef.current?.prompt;
    let accepted = false;
    try {
      const data = await call({ action: "fetchUrl", url });
      if (!mountedRef.current) return;
      if (questionRef.current?.prompt !== promptAtEntry) {
        toast({ title: "Import superseded — already moved on.", variant: "destructive" });
        return;
      }
      const entry: Attachment = {
        path: data.path,
        previewUrl: data.previewUrl ?? null,
        name: data.name || url,
        size: data.size || 0,
        contentType: data.contentType || "application/octet-stream",
      };
      pushAttachment(entry);
      accepted = answer(`Imported file: ${entry.name}`, {
        raw: entry.path,
        file: { name: entry.name, size: entry.size, contentType: entry.contentType, path: entry.path },
      });
      if (!accepted) {
        setAttachments((prev) => prev.filter((a) => a.path !== entry.path));
      } else {
        setUrlInput("");
      }
    } catch (e) {
      if (!mountedRef.current) return;
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      uploadGateRef.current = false;
      if (mountedRef.current) setImporting(false);
    }
  };

  const refreshPreviews = async () => {
    if (attachments.length === 0) return;
    try {
      const data = await call({ action: "refresh", paths: attachments.map((a) => a.path) });
      const urls = (data.urls ?? {}) as Record<string, string | null>;
      setAttachments((prev) => prev.map((a) => ({ ...a, previewUrl: urls[a.path] ?? a.previewUrl })));
    } catch (e) {
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const removeAttachment = (path: string) => {
    const idx = attachments.findIndex((a) => a.path === path);
    if (idx === -1) return;
    const next = [...attachments.slice(0, idx), ...attachments.slice(idx + 1)];
    setAttachments(next);
    setSelectedPath((sel) => (sel === path ? next[next.length - 1]?.path ?? null : sel));
  };

  const handlePreviewError = (path: string) => {
    if (previewRetryRef.current.has(path)) return;
    previewRetryRef.current.add(path);
    refreshPreviews();
  };

  const resetToIntro = () => {
    setStage("intro");
    setTranscript([]);
    setQuestion(null);
    setClosing("");
    setAttachments([]);
    setSelectedPath(null);
    setText("");
    setMulti([]);
    setBuckets({});
    setUrlInput("");
    setSubmitFailed(false);
    setLoading(false);
    setSubmitting(false);
    setImporting(false);
    inFlightRef.current = false;
    uploadGateRef.current = false;
  };

  if (stage === "done") {
    return (
      <div className="container mx-auto px-4 py-24 max-w-2xl text-center">
        <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-6" />
        <h1 ref={doneHeadingRef} tabIndex={-1} className="font-orbitron text-3xl font-bold mb-4">Application submitted!</h1>
        <p aria-live="polite" className="text-muted-foreground">{closing}</p>
        <p className="text-muted-foreground mt-4">
          We'll review your application and reach out at <span className="text-foreground">{applicant.email}</span>.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button variant="outline" onClick={resetToIntro}>
            Start over
          </Button>
          <Button variant="outline" asChild>
            <a href="/">Home</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <header className="mb-10 text-center">
        <h1 className="font-orbitron text-4xl font-bold mb-3">Join the Wolverines</h1>
        <p className="text-muted-foreground">
          Apply to FTC Team 23442 at Pine Lake Middle School.
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
                placeholder="user@issaquah.wednet.edu"
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

          {attachments.length > 0 && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Your uploads ({attachments.length})</p>
                <Button variant="ghost" size="sm" onClick={refreshPreviews}>
                  Reload previews
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {attachments.map((a, i) => (
                  <div
                    key={`${a.path}::${i}`}
                    onClick={() => setSelectedPath(a.path)}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted ${
                      selectedAttachment?.path === a.path ? "border-primary" : ""
                    }`}
                  >
                    <AttachmentIcon kind={kindOf(a.contentType)} />
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="text-xs text-muted-foreground">{formatSize(a.size)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${a.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAttachment(a.path);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              {selectedAttachment && (
                <AttachmentPreview
                  attachment={selectedAttachment}
                  onErrorRetry={() => handlePreviewError(selectedAttachment.path)}
                />
              )}
            </div>
          )}

          {(loading || submitting) && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {submitting ? "Submitting and reviewing your application..." : "Thinking..."}
            </div>
          )}

          {submitFailed && !question && !submitting && (
            <Card className="p-5 space-y-3 text-center">
              <p className="text-sm text-muted-foreground">Submit failed. Your answers are saved.</p>
              <Button onClick={retrySubmit}>Retry submit</Button>
            </Card>
          )}

          {question && !loading && (
            <Card className="p-5 space-y-4">
              <div>
                <p className="font-medium">
                  {typeof question.prompt === "string" && question.prompt.trim()
                    ? question.prompt
                    : "(Please describe in your own words.)"}
                </p>
                {question.helper && <p className="text-sm text-muted-foreground mt-1">{question.helper}</p>}
              </div>

              {(question.type === "text" ||
                (question.type === "dragdrop" &&
                  (usableStrings(question.items).length === 0 ||
                    usableStrings(question.categories).length === 0 ||
                    hasDupStrings(question.items) ||
                    hasDupStrings(question.categories))) ||
                (question.type === "choice" && usableStrings(question.options).length === 0) ||
                (question.type === "multi" && usableStrings(question.options).length === 0) ||
                (question.type === "categorize" &&
                  (usableStrings(question.items).length === 0 ||
                    usableStrings(question.categories).length === 0 ||
                    hasDupStrings(question.items) ||
                    hasDupStrings(question.categories))) ||
                !["text", "choice", "multi", "categorize", "dragdrop", "file"].includes(question.type)) && (
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

              {question.type === "choice" && usableStrings(question.options).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {usableStrings(question.options).slice(0, 10).map((o) => (
                    <Button key={o} variant="outline" onClick={() => answer(o)}>
                      {o}
                    </Button>
                  ))}
                </div>
              )}

              {question.type === "multi" && usableStrings(question.options).length > 0 && (
                <div className="space-y-3">
                  {usableStrings(question.options).slice(0, 10).map((o) => (
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

              {question.type === "categorize" &&
                usableStrings(question.items).length > 0 &&
                usableStrings(question.categories).length > 0 &&
                !hasDupStrings(question.items) &&
                !hasDupStrings(question.categories) && (
                <div className="space-y-3">
                  {usableStrings(question.items).map((item) => (
                    <div key={item} className="flex flex-wrap items-center gap-2">
                      <span className="text-sm flex-1 min-w-[120px]">{item}</span>
                      {usableStrings(question.categories).map((cat) => (
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

              {question.type === "dragdrop" &&
                usableStrings(question.items).length > 0 &&
                usableStrings(question.categories).length > 0 &&
                !hasDupStrings(question.items) &&
                !hasDupStrings(question.categories) && (
                  <DragDropSort
                    key={`${question.type}:${question.prompt}:${(question.items ?? []).join(" ")}:${(question.categories ?? []).join(" ")}`}
                    items={question.items ?? []}
                    categories={question.categories ?? []}
                    onDone={(text, raw) => answer(text, { raw })}
                  />
                )}

              {question.type === "file" && (
                <div className="space-y-3">
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
                    accept="image/*,application/pdf,video/*,audio/*"
                    className="hidden"
                    disabled={loading || submitting || importing}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.currentTarget.value = "";
                      if (f) handleFile(f);
                    }}
                  />
                  <Button variant="ghost" disabled={loading || submitting || importing} onClick={() => answer("Skipped the upload", { raw: null })}>
                    Skip
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="…or paste a file link (PDF, image, video, audio)"
                    inputMode="url"
                    disabled={loading || submitting || importing}
                    className="min-w-[200px] flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleUrlImport();
                      }
                    }}
                  />
                  <Button variant="outline" disabled={!urlInput.trim() || importing || loading || submitting} onClick={handleUrlImport}>
                    {importing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Link className="mr-2 h-4 w-4" />
                    )}
                    Import
                  </Button>
                </div>
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
