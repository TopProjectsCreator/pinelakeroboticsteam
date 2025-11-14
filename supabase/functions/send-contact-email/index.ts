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

// HTML escape function to prevent injection
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
    console.error("Error in send-contact-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
