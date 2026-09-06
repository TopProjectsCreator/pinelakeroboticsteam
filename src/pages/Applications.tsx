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

function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const kind = kindOf(attachment.contentType);
  if (!attachment.previewUrl) {
    return <p className="text-sm text-muted-foreground">Preview unavailable for {attachment.name}.</p>;
  }
  if (kind === "image") {
    return <img src={attachment.previewUrl} alt={attachment.name} loading="lazy" className="max-h-64 rounded-md border" />;
  }
  if (kind === "pdf") {
    return <iframe src={attachment.previewUrl} title={attachment.name} className="h-64 w-full rounded-md border" />;
  }
  if (kind === "video") {
    return <video src={attachment.previewUrl} controls preload="metadata" className="max-h-64 w-full rounded-md border" />;
  }
  if (kind === "audio") {
    return <audio src={attachment.previewUrl} controls className="w-full" />;
  }
  return (
    <a href={attachment.previewUrl} download={attachment.name} className="text-sm underline">
      Download {attachment.name}
    </a>
  );
}

function AttachmentIcon({ kind }: { kind: AttachmentKind }) {
  const cls = "h-4 w-4 shrink-0";
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
    setSubmitting(true);
    inFlightRef.current = true;
    try {
      await call({ action: "submit", transcript: finalTranscript, attachments: attachments.map((a) => a.path) });
      setStage("done");
    } catch (e) {
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

  const answer = (value: string, meta: Partial<Turn> = {}) => {
    if (!question || loading || submitting || inFlightRef.current) return;
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
  };


  const pushAttachment = (entry: Attachment) => {
    setAttachments((prev) => [...prev, entry]);
    setSelectedPath(entry.path);
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
      pushAttachment({
        path: data.path,
        previewUrl: data.previewUrl ?? null,
        name: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      });
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

  const handleUrlImport = async () => {
    const url = urlInput.trim();
    if (!url || importing) return;
    setImporting(true);
    try {
      const data = await call({ action: "fetchUrl", url });
      const entry: Attachment = {
        path: data.path,
        previewUrl: data.previewUrl ?? null,
        name: data.name || url,
        size: data.size || 0,
        contentType: data.contentType || "application/octet-stream",
      };
      pushAttachment(entry);
      setUrlInput("");
      answer(`Imported file: ${entry.name}`, {
        raw: entry.path,
        file: { name: entry.name, size: entry.size, contentType: entry.contentType, path: entry.path },
      });
    } catch (e) {
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
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
    const next = attachments.filter((a) => a.path !== path);
    setAttachments(next);
    setSelectedPath((sel) => (sel === path ? next[next.length - 1]?.path ?? null : sel));
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
                {attachments.map((a) => (
                  <div
                    key={a.path}
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
              {selectedAttachment && <AttachmentPreview attachment={selectedAttachment} />}
            </div>
          )}

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

              {(question.type === "text" ||
                (question.type === "dragdrop" &&
                  ((question.items ?? []).length === 0 ||
                    (question.categories ?? []).length === 0))) && (
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

              {question.type === "dragdrop" &&
                (question.items ?? []).length > 0 &&
                (question.categories ?? []).length > 0 && (
                  <DragDropSort
                    key={question.prompt}
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
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="…or paste a file link (PDF, image, video, audio)"
                    inputMode="url"
                    className="min-w-[200px] flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleUrlImport();
                      }
                    }}
                  />
                  <Button variant="outline" disabled={!urlInput.trim() || importing} onClick={handleUrlImport}>
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
