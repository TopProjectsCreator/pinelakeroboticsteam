import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { applicationsAreClosed } from "@/lib/applicationsDeadline";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/application-interview`;
const GRADES = ["6th", "7th", "8th"];
const APPLICATION_LOCK_KEY = "applications:submitted";

const Applications = () => {
  const { toast } = useToast();
  const [applicant, setApplicant] = useState({ name: "", grade: "", email: "" });
  const [closing, setClosing] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [submissionLocked, setSubmissionLocked] = useState(false);
  const [applicationsClosed, setApplicationsClosed] = useState(false);

  useEffect(() => {
    setApplicationsClosed(applicationsAreClosed());
    try {
      setSubmissionLocked(localStorage.getItem(APPLICATION_LOCK_KEY) === "1");
    } catch {
      setSubmissionLocked(false);
    }
  }, []);

  const lockSubmission = () => {
    setSubmissionLocked(true);
    try {
      localStorage.setItem(APPLICATION_LOCK_KEY, "1");
    } catch {
      // ignore storage write failures
    }
  };

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (applicationsAreClosed()) {
      setApplicationsClosed(true);
      toast({ title: "Applications are now closed.", variant: "destructive" });
      return;
    }
    if (submissionLocked) {
      toast({ title: "Application already submitted.", variant: "destructive" });
      return;
    }
    if (!applicant.name.trim() || !applicant.grade || !applicant.email.trim()) {
      toast({ title: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    setSubmitFailed(false);
    try {
      const transcript = [
        {
          question: "Tell us about yourself.",
          answer: `${applicant.name} (grade ${applicant.grade}, ${applicant.email})`,
          answered_at: new Date().toISOString(),
        },
      ];
      const resp = await fetch(FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ applicant, action: "submit", transcript, attachments: [] }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Something went wrong.");
      lockSubmission();
      setClosing(data.closing || "Thanks for applying!");
      setDone(true);
    } catch (err) {
      setSubmitFailed(true);
      toast({
        title: "Could not submit",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-2xl text-center">
        <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-6" />
        <h1 className="font-orbitron text-3xl font-bold mb-4">Application submitted!</h1>
        <p aria-live="polite" className="text-muted-foreground">{closing}</p>
        <p className="text-muted-foreground mt-4">
          We'll review your application and reach out at <span className="text-foreground">{applicant.email}</span>.
        </p>
        <p className="text-muted-foreground mt-2">Only one application submission is allowed.</p>
        <div className="mt-8 flex items-center justify-center gap-3">
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

      <Card className="p-6">
        {applicationsClosed ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              Applications close on September 17, 2026 at 4:00 PM PST.
            </p>
            <Button variant="outline" asChild>
              <a href="/">Home</a>
            </Button>
          </div>
        ) : submissionLocked ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              This browser has already submitted an application. Only one submission is allowed.
            </p>
            <Button variant="outline" asChild>
              <a href="/">Home</a>
            </Button>
          </div>
        ) : (
          <form onSubmit={submitApplication} className="space-y-5">
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

            {submitFailed && (
              <p className="text-sm text-destructive">
                Submit failed. Please try again.
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" /> Submit application
                </>
              )}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};

export default Applications;