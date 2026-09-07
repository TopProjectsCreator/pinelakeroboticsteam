import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLUG_RE = /^[a-z0-9-]+$/;

// Known blog categories (see src/pages/Blog.tsx). Anything else must still be
// a short plain-text string so custom categories keep working.
const KNOWN_CATEGORIES = new Set([
  "Season Update",
  "Engineering",
  "Programming",
  "Competition",
  "Team",
]);
const GENERIC_CATEGORY_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,49}$/;

function normalizeSlug(raw: unknown): string {
  return String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin passcode gate. Fails closed: when the secret is not configured,
    // publishing is disabled rather than left open.
    const adminPasscode = Deno.env.get("ADMIN_PASSCODE");
    if (!adminPasscode) {
      console.error("ADMIN_PASSCODE is not configured");
      return new Response(
        JSON.stringify({ error: "Publishing is disabled." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { passcode, title, slug, excerpt, content, category, read_time } = body as Record<string, unknown>;
    if (typeof passcode !== "string" || passcode !== adminPasscode) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    if (
      typeof title !== "string" || typeof slug !== "string" ||
      typeof excerpt !== "string" || typeof content !== "string" ||
      typeof category !== "string" || typeof read_time !== "string"
    ) {
      return new Response(
        JSON.stringify({ error: "All fields are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanTitle = title.trim();
    if (cleanTitle.length < 1 || cleanTitle.length > 200) {
      return new Response(
        JSON.stringify({ error: "Title must be between 1 and 200 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanSlug = normalizeSlug(slug);
    if (cleanSlug.length < 1 || cleanSlug.length > 200 || !SLUG_RE.test(cleanSlug)) {
      return new Response(
        JSON.stringify({ error: "Invalid slug. Use 1-200 characters: lowercase letters, numbers, and hyphens." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanExcerpt = excerpt.trim();
    if (cleanExcerpt.length < 1 || cleanExcerpt.length > 500) {
      return new Response(
        JSON.stringify({ error: "Excerpt must be between 1 and 500 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (content.trim().length < 1 || content.length > 100_000) {
      return new Response(
        JSON.stringify({ error: "Content must be between 1 and 100000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanCategory = category.trim();
    if (
      cleanCategory.length < 1 || cleanCategory.length > 50 ||
      (!KNOWN_CATEGORIES.has(cleanCategory) && !GENERIC_CATEGORY_RE.test(cleanCategory))
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid category" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanReadTime = read_time.trim();
    if (cleanReadTime.length < 1 || cleanReadTime.length > 50) {
      return new Response(
        JSON.stringify({ error: "Read time must be between 1 and 50 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing required environment variables");
      return new Response(
        JSON.stringify({ error: "Configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Pre-check slug uniqueness for a clean 409 instead of a raw DB error.
    const { data: existing, error: slugCheckError } = await supabase
      .from("blog_posts")
      .select("id")
      .eq("slug", cleanSlug)
      .maybeSingle();

    if (slugCheckError) {
      console.error("Error checking slug existence:", slugCheckError);
      return new Response(
        JSON.stringify({ error: "Failed to create blog post" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existing) {
      return new Response(
        JSON.stringify({ error: "A post with this slug already exists" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase
      .from("blog_posts")
      .insert({
        title: cleanTitle,
        slug: cleanSlug,
        excerpt: cleanExcerpt,
        content,
        category: cleanCategory,
        read_time: cleanReadTime,
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting blog post:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create blog post" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
