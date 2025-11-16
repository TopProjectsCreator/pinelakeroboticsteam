// Deno Edge Function: upload-blog-images
// Public function to upload predefined blog images to the 'blog-images' bucket
// Uses service role key for privileged storage access

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UploadFile {
  path: string; // e.g., "first-game-image-1.png"
  url: string;  // absolute URL where the function can fetch the file
  contentType?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("Missing required environment variables");
      return new Response(
        JSON.stringify({ error: "Configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { files } = await req.json().catch(() => ({ files: [] as UploadFile[] }));
    if (!files || !Array.isArray(files) || files.length === 0) {
      return new Response(
        JSON.stringify({ error: "No files provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ path: string; ok: boolean; error?: string }> = [];

    for (const file of files as UploadFile[]) {
      try {
        const res = await fetch(file.url);
        if (!res.ok) {
          results.push({ path: file.path, ok: false, error: `Fetch failed: ${res.status}` });
          continue;
        }
        const arrayBuffer = await res.arrayBuffer();
        const contentType = file.contentType || res.headers.get("content-type") || "application/octet-stream";

        const { error: uploadError } = await supabase
          .storage
          .from("blog-images")
          .upload(file.path, new Uint8Array(arrayBuffer), { contentType, upsert: true });

        if (uploadError) {
          results.push({ path: file.path, ok: false, error: uploadError.message });
        } else {
          results.push({ path: file.path, ok: true });
        }
      } catch (err) {
        console.error("Upload error for", file.path, err);
        results.push({ path: file.path, ok: false, error: "Unexpected error" });
      }
    }

    const uploaded = results.filter(r => r.ok).length;
    return new Response(
      JSON.stringify({ uploaded, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("upload-blog-images error:", e);
    return new Response(
      JSON.stringify({ error: "An error occurred. Please try again later." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
