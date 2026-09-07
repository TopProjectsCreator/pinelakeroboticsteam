import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  firecrawlTools,
  runFirecrawlTool,
  getClientIp,
  hashIp,
  checkRateLimit,
  MAX_TOOL_CALLS_PER_MESSAGE,
} from "../_shared/firecrawl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Reject oversized bodies (>256KB) before parsing.
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).length > 256 * 1024) {
      return new Response(JSON.stringify({ error: "Request body too large." }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const incoming = (parsed as { messages?: unknown })?.messages;
    if (!Array.isArray(incoming)) {
      return new Response(JSON.stringify({ error: "messages must be an array." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Role injection guard: keep ONLY plain user messages with string content.
    // Drops system/tool/assistant smuggling (incl. tool_calls), then caps at
    // the 20 newest messages and 12k total chars (truncating oldest first).
    const MAX_HISTORY_MESSAGES = 20;
    const MAX_HISTORY_CHARS = 12000;
    const sanitized: Array<{ role: "user"; content: string }> = [];
    for (const m of incoming) {
      if (!m || typeof m !== "object") continue;
      const r = m as Record<string, unknown>;
      if (r.role !== "user" || typeof r.content !== "string") continue;
      if (!r.content) continue;
      sanitized.push({ role: "user", content: r.content });
    }
    const capped = sanitized.slice(-MAX_HISTORY_MESSAGES);
    let totalChars = capped.reduce((n, m) => n + m.content.length, 0);
    while (totalChars > MAX_HISTORY_CHARS && capped.length > 0) {
      const excess = totalChars - MAX_HISTORY_CHARS;
      const oldest = capped[0];
      if (oldest.content.length <= excess) {
        totalChars -= oldest.content.length;
        capped.shift();
      } else {
        // Trim the oldest message from the front, keeping its most recent tail.
        oldest.content = oldest.content.slice(excess);
        totalChars = MAX_HISTORY_CHARS;
      }
    }
    const messages = capped;
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");


    const chatMessages = [
          {
            role: "system",
            content: `You are the official AI assistant for the Wolverines FTC Team 23442. You have complete, comprehensive knowledge of the team and should answer questions accurately. Be friendly, enthusiastic, and helpful!



=== TEAM IDENTITY ===

Team Number: 23442
Team Name: Wolverines
Team Motto: "All Claws on Deck!"

Founded: 2023 (Rookie Year). We actually had a team before that as #7977 (https://theorangealliance.org/teams/7977) with a rookie year of 2013, but our last active season as that team and team # was 2019/20 - SKYSTONE.
Data about #7977:
  - Also called the Wolverines
  - Same school
  - We still have parts from that team so we have over 13 years worth of parts
Location: Sammamish, Washington

School: PLMS (Pine Lake Middle School) - This is critical: we are NOT affiliated with any other school

Region: Washington State



=== LAST SEASON (2025) ===

Season Name: DECODE

This is the team's 3rd season (not including our old team which competed since 7977.) competing in FIRST Tech Challenge.

League Memberships:

- Spencer League (Based in Issaquah, 12 teams total)

- Tesla League (Parent league for Washington State)



Current Stats:

- 3 Seasons Competing

- 2 Active Team Members

- Spencer League Meets 1 & 2 completed

- Preparing for Tesla Interleague Tournament



=== COMPLETED EVENTS (2025 Season) ===

1. Spencer League Meet 1

   Date: November 09, 2025

   Location: Beaver Lake Middle School

   Status: COMPLETED

   - First competition of the season

   - Team gained valuable experience



2. Spencer League Meet 2

   Date: November 22, 2025

   Location: Beaver Lake Middle School  

   Status: COMPLETED

   - Debuted the new launcher mechanism

   - Learned critical lessons about inspection

   - Backup drivers stepped up when lead driver was absent



3. Tesla League Tournament

   Date: December 14, 2025

   Location: Beaver Lake Middle School

   Link: https://ftc-events.firstinspires.org/2025/USWATELT

   Status: COMPLETED

   - Major interleague competition

   - Team prepared a brand-new robot with ground intake

   - Team was not prepared for all aspects of the tournament, and ended up failing to remember doing a presentation

   - Team ranked 21st our of 22 teams, only beating team Lux Mechanica #30789

   - Team won the Judges Choice award

   - Engineering portfolio at https://pinelakeroboticsteam.lovable.app/portfolio
   - Wins-Losses-Ties: 1-4-0

=== CURRENT SEASON ===


Over the summer it was the offseason for the team, however they got getting ready for the 2026-2027 season BIOBUZZ by making the preseason robot and getting this site up to date.

Goals for preseason bot:

 * Studica listed 6 items that the robot needs to do. 5 of them are still covered up, and one is to intake pollen
 * The team believes that autonomous is very important this season and will work on the limelight (that they planned to buy but budget issues made it impossible) to make them #1 this season

Now the season info is released but due to only having 2 team members we are focusing on tryouts

=== TEAM MEMBERS & ROLES === 

For the 2025-2026 DECODE season:

Build Team (5 members):

- Maksim - Part of the build crew, knows how to CAD
- Janya - Part of the build crew
- Arya - Part of the build crew
- Aditya - Part of the build crew
- Shriyash - Part of the build crew, knows how to CAD

Code Team (4 members):

- Sim - Officially part of the team, but never attended any of the meetings and isnt considered a team member
- Abhi - Officially a coder but does build instead
- Ishaan - Lead programmer, manages GitHub repository
- Edward - Software development

After the DECODE year, many team members left. Only remaining are:
- Ishaan - Main leader
- Maksim

This is why interviews are open! And dont worry, we have more than enough spots!

Programming Details:

- Language: Java
- Framework: FTC SDK (FIRST Tech Challenge Software Development Kit)
- GitHub Repository: https://github.com/EdwardCasler/FtcRobotController
- Wiki: https://github.com/EdwardCasler/FtcRobotController/wiki


=== TEAM VALUES (Core Principles) ===

1. Discovery - We explore new ideas, experiment boldly, and push boundaries

2. Innovation - We create unique solutions through creative thinking and problem-solving

3. Impact - We make meaningful differences through STEM education and community outreach

4. Inclusion - We welcome everyone, value diversity, and respect all perspectives

5. Teamwork - We collaborate effectively, communicate openly, and support each other's growth

6. Fun - We enjoy the journey, celebrate achievements, and maintain a positive environment



=== COMPETITION HISTORY ===



2025 Season - DECODE:

- Competing in Spencer League and Tesla League

- Developed launcher mechanism for scoring

- Building new robot with ground intake for Interleague

- Key improvements: better autonomous routines, mecanum wheel plans



League Meet 2 Highlights:

- Failed initial inspection due to wiring issues and Driver Hub app conflicts

- Control Hub needed firmware updates

- Team learned importance of REV Hardware Client knowledge

- Launcher mechanism was inconsistent (45-degree angle worked best, ~25% success rate)

- Discovered importance of having multiple team members trained on technical tasks



League Meet 1 Highlights:

- First competition with REV chassis

- Learned about importance of preparation

- Gained confidence from the experience



2024 Season - INTO THE DEEP:

- Competed in regional tournaments

- Advanced autonomous programming capabilities

- Significant growth from rookie year



2023 Season - CENTERSTAGE:

- Rookie year for Team 23442

- Established team foundation and culture

- First competition experience

- Built foundational skills in robotics



=== ROBOT TECHNICAL DETAILS ===

Current Robot Features:

- REV Robotics chassis (strengthened and refined)

- Launcher mechanism (still being tuned for consistency)

- UltraPlanetary gearbox (initially mislabeled, caused motor control issues)

- PID-controlled drivetrain



Planned Upgrades:

- Mecanum wheels for omnidirectional movement

- Ground intake mechanism for faster cycling

- Improved autonomous routines

- Better wiring management



Development Tools:

- Android Studio for code development

- Version control via GitHub

- REV Hardware Client for firmware and configuration



=== TEAM ACTIVITIES ===

1. Design & Build: Design, prototype, and build competitive robots using CAD software and fabrication techniques

2. Programming: Develop autonomous and driver-controlled programs using Java and the FTC SDK

3. Outreach: Promote STEM education through demonstrations, workshops, and mentoring younger students

4. Competition: Compete in FTC tournaments while demonstrating gracious professionalism


=== CONTACT & RESOURCES ===

- Official FTC Team Profile: https://ftc-events.firstinspires.org/2025/team/23442
- GitHub Code Repository: https://github.com/EdwardCasler/FtcRobotController
- Team Website: https://pinelakeroboticsteam.lovable.app/
- Engineer Portfolio link: https://pinelakeroboticsteam.lovable.app/portfolio
- Email: Available through contact form on website https://pinelakeroboticsteam.lovable.app/contact

=== WHAT IS FIRST TECH CHALLENGE (FTC)? ===

FTC is a robotics competition for students in grades 7-12. Teams design, build, and program robots to compete in annual challenges. Each season has a new game theme (like DECODE for 2025). Teams earn points through:

- Autonomous period (robot operates independently)
- Driver-controlled period (human operators control the robot)
- End game challenges

=== IMPORTANT REMINDERS ===
- We are from Pine Lake Middle School (PLMS) in Sammamish, WA, United States
- NOT affiliated with Portola High School or any other school
- We compete in Washington State leagues
- Our mascot/name is the Wolverines
- Current season is BIOBUZZ (2026 - 2027)


=== WEB TOOLS ===
You have live web tools (web_search, web_scrape, web_map, web_crawl, web_extract) powered by Firecrawl.
They cost money, so use them ONLY when the answer is not in the knowledge above and the user needs
current or external information. Never use more than ${MAX_TOOL_CALLS_PER_MESSAGE} tool calls per message,
prefer web_search or a single web_scrape, and cite the URLs you used.

=== RESPONSE GUIDELINES ===
- Be enthusiastic and supportive of the team
- Provide accurate information based on the knowledge above
- For questions about FTC rules or general robotics, provide helpful information
- If unsure about specific team details not covered above, say so honestly
- Encourage visitors to check the website, blog, or contact the team for more info
- Keep responses conversational and friendly
- You may also accounter official team members asking questions about the team. Please use what info you have to help with descisions and such.
- Interview link for interviews for 2026-2027 will appear here: (https://pinelakeroboticsteam.lovable.app/applications)
`,
      },
      ...messages,
    ];

    // ---- Tool phase (non-streaming): let the model call Firecrawl tools first ----
    const ipHash = await hashIp(getClientIp(req));
    const toolsAvailable = !!Deno.env.get("FIRECRAWL_API_KEY") && !(await checkRateLimit(ipHash));

    const OPENROUTER_HEADERS: Record<string, string> = {
      "Content-Type": "application/json",
      "HTTP-Referer": "https://pinelakeroboticsteam.lovable.app/",
      "X-Title": "Wolverines FTC 23442 Assistant",
    };

    async function toolCompletion(withTools: boolean) {
      if (OPENROUTER_API_KEY) {
        try {
          const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              ...OPENROUTER_HEADERS,
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            },
            body: JSON.stringify({
              model: "google/gemma-4-31b-it:free",
              models: ["google/gemma-4-31b-it:free", "openrouter/free"],
              messages: chatMessages,
              max_tokens: 1024,
              ...(withTools ? { tools: firecrawlTools, tool_choice: "auto" } : {}),
            }),
          });
          if (r.ok) return await r.json();
          console.error("OpenRouter tool phase error:", r.status, await r.text());
        } catch (err) {
          console.error("OpenRouter tool phase failed:", err);
        }
      }
      if (!LOVABLE_API_KEY) return null;
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Lovable-API-Key": LOVABLE_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-5.6-luna",
          reasoning_effort: "none",
          messages: chatMessages,
          ...(withTools ? { tools: firecrawlTools, tool_choice: "auto" } : {}),
        }),
      });
      if (!r.ok) {
        console.error("Lovable tool phase error:", r.status, await r.text());
        return null;
      }
      try {
        return await r.json();
      } catch (err) {
        console.error("Lovable tool phase returned non-JSON:", err);
        return null;
      }
    }

    if (toolsAvailable) {
      let used = 0;
      let crawlsUsed = 0;
      let searchReturnedUsable = false;
      let rateLimited = false;
      // Search-first: web_crawl is capped at 1 per message and only runs when
      // no earlier web_search returned anything usable.
      for (let round = 0; round < MAX_TOOL_CALLS_PER_MESSAGE && used < MAX_TOOL_CALLS_PER_MESSAGE; round++) {
        if (rateLimited) break;
        const data = await toolCompletion(true);
        const msg = data?.choices?.[0]?.message;
        const calls = msg?.tool_calls;
        if (!msg || !Array.isArray(calls) || calls.length === 0) break;

        chatMessages.push({ role: "assistant", content: msg.content ?? "", tool_calls: calls } as never);

        for (const call of calls.slice(0, MAX_TOOL_CALLS_PER_MESSAGE - used)) {
          used++;
          const toolName = call.function?.name ?? "";
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function?.arguments ?? "{}");
          } catch { /* ignore malformed args */ }
          let result: string;
          if (toolName === "web_crawl") {
            if (crawlsUsed >= 1 || searchReturnedUsable) {
              result = "Skipped: web_crawl is limited to 1 per message and only runs when web_search returned nothing usable. Prefer web_search or web_scrape.";
            } else {
              crawlsUsed++;
              result = await runFirecrawlTool(toolName, args, ipHash);
            }
          } else {
            result = await runFirecrawlTool(toolName, args, ipHash);
            if (
              toolName === "web_search" &&
              !result.startsWith("Rate limited") &&
              !result.startsWith("The web tool failed") &&
              result !== "No results found."
            ) {
              searchReturnedUsable = true;
            }
          }
          chatMessages.push({
            role: "tool",
            tool_call_id: call.id,
            content: result,
          } as never);
          if (result.startsWith("Rate limited")) {
            // Stop the whole tool loop: further calls would burn budget and
            // hammer a limited API. (break, not continue.)
            rateLimited = true;
            break;
          }
        }
      }
    }

    // Translate upstream mid-stream error chunks (e.g. `data: {"error": ...}`)
    // into a terminal client-handleable `data: {"error": "..."}` event instead
    // of letting the client render a blank bubble, then end the stream.
    function toClientStream(upstream: ReadableStream<Uint8Array> | null): ReadableStream<Uint8Array> {
      if (!upstream) return new ReadableStream({ start(c) { c.close(); } });
      const reader = upstream.getReader();
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      let buf = "";
      let terminated = false;
      return new ReadableStream<Uint8Array>({
        async pull(controller) {
          if (terminated) {
            controller.close();
            return;
          }
          const { done, value } = await reader.read();
          if (done) {
            if (buf) controller.enqueue(encoder.encode(buf));
            controller.close();
            return;
          }
          buf += decoder.decode(value, { stream: true });
          const out: string[] = [];
          let idx: number;
          while ((idx = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, idx);
            buf = buf.slice(idx + 1);
            const t = line.endsWith("\r") ? line.slice(0, -1) : line;
            if (t.startsWith("data:")) {
              const payload = t.slice(5).trim();
              if (payload && payload !== "[DONE]") {
                try {
                  const p = JSON.parse(payload) as Record<string, unknown>;
                  if (p && p.error) {
                    const err = p.error as unknown;
                    const msg = typeof err === "string"
                      ? err
                      : typeof (err as Record<string, unknown>)?.message === "string"
                        ? String((err as Record<string, unknown>).message)
                        : "Upstream error";
                    if (out.length) controller.enqueue(encoder.encode(out.join("")));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
                    terminated = true;
                    try { await reader.cancel(); } catch { /* ignore */ }
                    controller.close();
                    return;
                  }
                } catch { /* not JSON — pass through untouched */ }
              }
            }
            out.push(line + "\n");
          }
          if (out.length) controller.enqueue(encoder.encode(out.join("")));
        },
        async cancel() {
          try { await reader.cancel(); } catch { /* ignore */ }
        },
      });
    }

    let response: Response | null = null;


    // 1) OpenRouter: gemma primary, openrouter/free fallback
    if (OPENROUTER_API_KEY) {
      try {
        const orResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            ...OPENROUTER_HEADERS,
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model: "google/gemma-4-31b-it:free",
            models: ["google/gemma-4-31b-it:free", "openrouter/free"],
            messages: chatMessages,
            max_tokens: 1024,
            stream: true,
          }),
        });
        if (orResp.ok) {
          response = orResp;
        } else {
          console.error("OpenRouter error:", orResp.status, await orResp.text());
        }
      } catch (err) {
        console.error("OpenRouter request failed:", err);
      }
    }

    // 2) Final fallback: Lovable AI Gateway (gpt-5.6-luna)
    if (!response) {
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "No AI provider is configured." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const lovableResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Lovable-API-Key": LOVABLE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5.6-luna",
          reasoning_effort: "none",
          messages: chatMessages,
          stream: true,
        }),
      });

      if (!lovableResp.ok) {
        if (lovableResp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (lovableResp.status === 402) {
          return new Response(
            JSON.stringify({ error: "Payment required, please add credits to your Lovable AI workspace." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        console.error("Lovable AI gateway error:", lovableResp.status, await lovableResp.text());
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      response = lovableResp;
    }

    return new Response(toClientStream(response.body), {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    // Log detailed error server-side for debugging
    console.error("chat error:", e);

    // Return generic error message to client
    return new Response(JSON.stringify({ error: "An error occurred. Please try again later." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
