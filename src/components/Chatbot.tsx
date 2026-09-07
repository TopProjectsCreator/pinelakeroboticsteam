import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

type Message = { 
  role: "user" | "assistant"; 
  content: string;
  images?: Array<{ url: string }>;
};

const MAX_SEND_HISTORY = 20;
const MAX_MALFORMED_STREAK = 5;
const REQUEST_TIMEOUT_MS = 60000;

// Only allow https: image URLs from the AI; drop invalid/empty values.
const isValidImageUrl = (url: unknown): url is string => {
  if (typeof url !== "string" || !url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};

// Block javascript: and data:text/html links in rendered markdown.
const safeUrlTransform = (url: string): string => {
  const lower = url.trim().toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:text/html")) return "";
  return url;
};

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastSend, setLastSend] = useState<Message[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus into the dialog on open + Escape to close.
  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // Abort any in-flight request on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const streamChat = async (userMessages: Message[], signal: AbortSignal) => {
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
    
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: userMessages }),
      signal,
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        toast({
          title: "Rate limit exceeded",
          description: "Please try again later.",
          variant: "destructive",
        });
      } else if (resp.status === 402) {
        toast({
          title: "Payment required",
          description: "Please add funds to continue.",
          variant: "destructive",
        });
      }
      throw new Error("Failed to start stream");
    }

    if (!resp.body) throw new Error("No response body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;
    let assistantContent = "";
    let assistantImages: Array<{ url: string }> = [];
    let malformedStreak = 0;

    const applyChunk = (parsed: unknown): void => {
      const p = parsed as {
        error?: unknown;
        choices?: Array<{ delta?: { content?: unknown }; message?: { images?: unknown } }>;
      };
      // Server-translated terminal error event (upstream mid-stream failure).
      if (p && typeof p.error === "string" && p.error) {
        throw new Error(p.error);
      }
      const content = p?.choices?.[0]?.delta?.content as string | undefined;
      const images = p?.choices?.[0]?.message?.images;

      if (images && Array.isArray(images)) {
        const urls = (images as Array<{ image_url?: { url?: unknown }; url?: unknown }>)
          .map((img) => (typeof img.image_url?.url === "string" ? img.image_url.url : img.url))
          .filter(isValidImageUrl)
          .map((url: string) => ({ url }));
        if (urls.length > 0) assistantImages = urls;
      }

      if (content) {
        assistantContent += content;
      }

      if (content || assistantImages.length > 0) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) =>
              i === prev.length - 1
                ? { ...m, content: assistantContent, images: assistantImages.length > 0 ? assistantImages : undefined }
                : m
            );
          }
          return [...prev, {
            role: "assistant",
            content: assistantContent,
            images: assistantImages.length > 0 ? assistantImages : undefined
          }];
        });
      }
    };

    const consumeLine = (line: string): void => {
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") return;
      if (!line.startsWith("data: ")) return;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        malformedStreak += 1;
        if (malformedStreak >= MAX_MALFORMED_STREAK) {
          // Permanently malformed line: drop it instead of requeueing forever.
          malformedStreak = 0;
          toast({
            title: "Error",
            description: "Received an unreadable response chunk. Skipped it — the reply may be incomplete.",
            variant: "destructive",
          });
          return;
        }
        textBuffer = line + "\n" + textBuffer;
        throw new Error("__requeue__");
      }
      malformedStreak = 0;
      applyChunk(parsed);
    };

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        const line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        try {
          consumeLine(line);
        } catch (err) {
          if (err instanceof Error && err.message === "__requeue__") break;
          throw err;
        }
        if (streamDone) break;
      }
    }

    // Flush any trailing buffered line (e.g. final chunk before [DONE]).
    const trailing = textBuffer.trim();
    if (!streamDone && trailing) {
      try {
        consumeLine(trailing);
      } catch (err) {
        if (!(err instanceof Error && err.message === "__requeue__")) throw err;
      }
    }
    textBuffer = "";
  };

  const runSend = async (toSend: Message[], draft: string) => {
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    setIsLoading(true);
    setSendError(null);

    try {
      await streamChat(toSend, controller.signal);
      setLastSend(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        toast({
          title: "Cancelled",
          description: "Request was cancelled.",
        });
        return;
      }
      console.error("Chat error:", error);
      // Keep the draft so the user doesn't lose their message.
      setInput(draft);
      setLastSend(toSend);
      const message = error instanceof Error && error.message ? error.message : "Failed to send message. Please try again.";
      setSendError(message);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      window.clearTimeout(timer);
      if (abortRef.current === controller) abortRef.current = null;
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const draft = input;
    const userMsg: Message = { role: "user", content: input };
    const toSend = [...messages, userMsg].slice(-MAX_SEND_HISTORY);
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSendError(null);

    await runSend(toSend, draft);
  };

  const handleRetry = async () => {
    if (isLoading || !lastSend) return;
    setSendError(null);
    const draft = input;
    await runSend(lastSend, draft);
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleClear = () => {
    abortRef.current?.abort();
    setMessages([]);
    setSendError(null);
    setLastSend(null);
  };

  return (
    <>
      {/* Floating button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>

      {/* Chat window */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 w-96 h-[500px] shadow-xl z-50 flex flex-col" role="dialog" aria-label="Wolverines AI Assistant chat">
          <div className="p-4 border-b flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-lg">Wolverines AI Assistant</h3>
              <p className="text-sm text-muted-foreground">Ask me about FTC Team 23442</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClear} aria-label="Clear chat">
              Clear
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Start a conversation! Ask me anything about the team.
                </div>
              )}
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.images && msg.images.length > 0 && (
                      <div className="space-y-2 mb-2">
                        {msg.images.map((img, imgIdx) => (
                          <img
                            key={imgIdx}
                            src={img.url}
                            alt="AI generated"
                            className="max-w-full rounded-lg"
                          />
                        ))}
                      </div>
                    )}
                    <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown
                        urlTransform={safeUrlTransform}
                        components={{
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer">
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {sendError && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg p-3 bg-destructive/10 text-sm">
                    <p className="text-destructive">{sendError}</p>
                    {lastSend && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={handleRetry}
                        disabled={isLoading}
                        aria-label="Retry sending message"
                      >
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                aria-label="Chat message"
                disabled={isLoading}
                className="flex-1"
              />
              {isLoading ? (
                <Button type="button" size="icon" onClick={handleCancel} aria-label="Cancel request">
                  <X className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" size="icon" disabled={isLoading} aria-label="Send message">
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </form>
          </div>
        </Card>
      )}
    </>
  );
};

export default Chatbot;
