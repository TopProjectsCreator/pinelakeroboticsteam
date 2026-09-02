// Deno Edge Function: upload-blog-media
// Accepts a single file upload (multipart/form-data) and stores it in the
// public 'blog-images' bucket using the service role. Storage write access is
// intentionally not granted to public/anon roles, so all writes go through here.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED_EXT = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "avif",
  "mp4", "webm", "mov",
  "mp3", "wav", "ogg", "m4a",
  "obj", "gltf", "glb", "fbx", "stl", "dae", "3ds",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("Missing required environment variables");
      return json({ error: "Configuration error" }, 500);
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return json({ error: "No file provided" }, 400);

    if (file.size <= 0 || file.size > MAX_BYTES) {
      return json({ error: "File is empty or too large (max 50MB)" }, 400);
    }

    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return json({ error: "Unsupported file type" }, 400);

    // Server-generated name: never trust the client-supplied path.
    const path = `${crypto.randomUUID()}.${ext}`;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { error } = await supabase.storage
      .from("blog-images")
      .upload(path, new Uint8Array(await file.arrayBuffer()), {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      console.error("upload failed:", error);
      return json({ error: "Upload failed" }, 500);
    }

    const { data } = supabase.storage.from("blog-images").getPublicUrl(path);
    return json({ path, publicUrl: data.publicUrl });
  } catch (e) {
    console.error("upload-blog-media error:", e);
    return json({ error: "An error occurred. Please try again later." }, 500);
  }
});
