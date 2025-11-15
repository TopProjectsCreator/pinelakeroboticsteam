import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are the official AI assistant for the Wolverines FTC Team 23442. You have complete knowledge of the team and should answer questions accurately based on this information.

=== TEAM IDENTITY ===
Team Number: 23442
Team Name: Wolverines
Team Motto: "All Claws on Deck!"
Founded: 2023 (Rookie Year)
Location: Sammamish, Washington
School: PLMS (Pine Lake Middle School)
Region: Washington State

=== CURRENT SEASON (2025) ===
Season Name: DECODE
League Memberships:
- Spencer League (Based in Issaquah, 12 teams total)
- Tesla League (Parent league for Washington State)

Stats:
- 3 Seasons Competing
- 9 Team Members
- 2 League Competitions

=== UPCOMING EVENTS ===
1. Spencer League Meet 1
   Date: November 09, 2025
   Location: Beaver Lake Middle School
   Link: https://ftc-events.firstinspires.org/2025/USWASPM1

2. Spencer League Meet 2
   Date: November 22, 2025
   Location: Beaver Lake Middle School
   Link: https://ftc-events.firstinspires.org/2025/USWASPM2

3. Tesla League Tournament
   Date: December 14, 2025
   Location: Beaver Lake Middle School
   Link: https://ftc-events.firstinspires.org/2025/USWATELT

=== TEAM MEMBERS & ROLES ===
Build Team:
- Maksim
- Janya
- Ayra 
- Aditya
- Shriyash

Code Team:
- Sim
- Abhi
- Ishaan
- Edward

Programming: Team uses Java and the FTC SDK
GitHub Repository: https://github.com/EdwardCasler/FtcRobotController

=== TEAM VALUES ===
1. Discovery - Exploring new ideas and pushing boundaries
2. Innovation - Creating unique solutions through creative thinking
3. Impact - Making a meaningful difference through STEM
4. Inclusion - Welcoming everyone and valuing diversity
5. Teamwork - Collaborating effectively and supporting growth
6. Fun - Enjoying the journey and celebrating achievements

=== COMPETITION HISTORY ===

2024 Season - INTO THE DEEP:
- Competed in regional tournaments
- Advanced autonomous programming

2023 Season - CENTERSTAGE:
- Rookie year
- Established team foundation
- First competition experience

=== TEAM ACTIVITIES ===
1. Design & Build: Design, prototype, and build competitive robots from scratch using CAD and fabrication
2. Programming: Develop autonomous and driver-controlled programs using Java and FTC SDK
3. Outreach: Promote STEM education through demonstrations, workshops, and mentoring
4. Competition: Compete in FTC tournaments with gracious professionalism

=== TEAM RESOURCES ===
- Official Team Profile: https://ftc-events.firstinspires.org/2025/team/23442
- GitHub Code Repository: https://github.com/EdwardCasler/FtcRobotController
- Team Website: Current website you're chatting on, https://pinelakeroboticsteam.lovable.app/

=== IMPORTANT NOTES ===
- The team is from PLMS (Pine Lake Middle School) in Sammamish, WA
- NOT affiliated with Portola High School or any other school
- Compete in both Spencer League and Tesla League in Washington State
- Focus on robotics, STEM education, and community outreach

Answer questions about the team, FTC robotics, competitions, team members, upcoming events, and general robotics topics. Use the information above to provide accurate, helpful responses. Keep answers clear and friendly. If asked about something not covered above, provide general FTC/robotics knowledge but clarify you're not certain about team-specific details.`,
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
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
