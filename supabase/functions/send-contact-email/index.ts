import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting storage (in-memory for simplicity)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Contact form validation schema
const contactSchema = z.object({
  name: z.string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters")
    .regex(/^[a-zA-Z\s\-'\.]+$/, "Name contains invalid characters"),
  email: z.string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters"),
  message: z.string()
    .trim()
    .min(1, "Message is required")
    .max(5000, "Message must be less than 5000 characters"),
});

// HTML escape function to prevent injection (for plain text fields)
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// Allowlist-based sanitizer for rich-text HTML from the Tiptap editor.
// Strips scripts/styles/iframes and all event handlers/javascript: URLs,
// keeps only safe formatting tags and a restricted set of attributes.
const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
  'ul', 'ol', 'li', 'span', 'a', 'blockquote', 'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
]);
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  span: new Set(['style']),
};
const SAFE_STYLE_RE = /^\s*color\s*:\s*(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|[a-zA-Z]+)\s*;?\s*$/;

function sanitizeHtml(dirty: string): string {
  // Remove dangerous blocks entirely
  let out = dirty.replace(/<(script|style|iframe|object|embed|link|meta)[\s\S]*?<\/\1>/gi, '');
  out = out.replace(/<(script|style|iframe|object|embed|link|meta)[^>]*\/?>(?!)/gi, '');

  // Walk tags
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_m, tag: string, attrs: string) => {
    const name = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return '';
    const isClose = _m.startsWith('</');
    if (isClose) return `</${name}>`;

    const allowed = ALLOWED_ATTRS[name];
    let safeAttrs = '';
    if (allowed) {
      const attrRe = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*=\s*"([^"]*)"|([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*=\s*'([^']*)'/g;
      let m: RegExpExecArray | null;
      while ((m = attrRe.exec(attrs)) !== null) {
        const attr = (m[1] || m[3]).toLowerCase();
        const val = (m[2] ?? m[4] ?? '').trim();
        if (!allowed.has(attr)) continue;
        if (/^on/i.test(attr)) continue;
        if (attr === 'href') {
          if (!/^(https?:|mailto:|#|\/)/i.test(val)) continue;
        }
        if (attr === 'style') {
          if (!SAFE_STYLE_RE.test(val)) continue;
        }
        safeAttrs += ` ${attr}="${val.replace(/"/g, '&quot;')}"`;
      }
      // Force safe rel/target on links
      if (name === 'a') safeAttrs += ' rel="noopener noreferrer" target="_blank"';
    }
    return `<${name}${safeAttrs}>`;
  });

  return out;
}

// Strip HTML tags to extract plain text (for empty check + Slack)
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Rate limiting function
function checkRateLimit(identifier: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  const limit = rateLimitMap.get(identifier);
  
  if (limit && limit.resetAt > now) {
    if (limit.count >= 3) {
      return { 
        allowed: false, 
        message: "Too many requests. Please try again later." 
      };
    }
    limit.count++;
    return { allowed: true };
  }
  
  // Reset or create new limit (3 submissions per hour)
  rateLimitMap.set(identifier, {
    count: 1,
    resetAt: now + 60 * 60 * 1000, // 1 hour
  });
  
  return { allowed: true };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    
    // Check rate limit
    const rateLimitCheck = checkRateLimit(clientIp);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ error: rateLimitCheck.message }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const body = await req.json();
    
    // Validate input with zod
    const validationResult = contactSchema.safeParse(body);
    if (!validationResult.success) {
      console.error("Validation failed:", validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: "Invalid input data", 
          details: validationResult.error.errors 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { name, email, message } = validationResult.data;
    
    // Sanitize inputs for HTML
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeMessage = escapeHtml(message);

    console.log("Sending contact email from:", safeEmail);

    // Send Slack notification
    const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
    if (slackWebhookUrl) {
      try {
        const slackResponse = await fetch(slackWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `🔔 New Contact Form Submission`,
            blocks: [
              {
                type: "header",
                text: {
                  type: "plain_text",
                  text: "📬 New Contact Form Message"
                }
              },
              {
                type: "section",
                fields: [
                  {
                    type: "mrkdwn",
                    text: `*Name:*\n${safeName}`
                  },
                  {
                    type: "mrkdwn",
                    text: `*Email:*\n${safeEmail}`
                  }
                ]
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Message:*\n${safeMessage}`
                }
              }
            ]
          })
        });

        if (!slackResponse.ok) {
          console.error("Failed to send Slack notification:", await slackResponse.text());
        } else {
          console.log("Slack notification sent successfully");
        }
      } catch (slackError) {
        console.error("Error sending Slack notification:", slackError);
        // Don't fail the request if Slack fails
      }
    } else {
      console.log("SLACK_WEBHOOK_URL not configured, skipping Slack notification");
    }

    // Send notification email to team
    const teamEmail = await resend.emails.send({
      from: "Pine Lake Robotics <onboarding@resend.dev>",
      to: ["rabia.ahmed.us@gmail.com"],
      subject: `New Contact Form Message from ${safeName}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage.replace(/\n/g, '<br>')}</p>
      `,
    });

    console.log("Team notification sent:", teamEmail);

    // Send confirmation email to user
    const confirmEmail = await resend.emails.send({
      from: "Pine Lake Robotics <onboarding@resend.dev>",
      to: [email],
      subject: "We received your message!",
      html: `
        <h1>Thank you for contacting us, ${safeName}!</h1>
        <p>We have received your message and will get back to you as soon as possible.</p>
        <p><strong>Your message:</strong></p>
        <p>${safeMessage.replace(/\n/g, '<br>')}</p>
        <br>
        <p>Best regards,<br>Pine Lake Robotics Team</p>
      `,
    });

    console.log("Confirmation email sent:", confirmEmail);

    return new Response(
      JSON.stringify({ success: true, teamEmail, confirmEmail }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    // Log detailed error server-side for debugging
    console.error("Error in send-contact-email function:", error);
    
    // Return generic error message to client
    return new Response(
      JSON.stringify({ error: "Failed to send message. Please try again later." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
