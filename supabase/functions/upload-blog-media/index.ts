// Deno Edge Function: upload-blog-media
// Accepts a single file upload (multipart/form-data) and stores it in the
// public 'blog-images' bucket using the service role. Storage write access is
// intentionally not granted to public/anon roles, so all writes go through here.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// NOTE: "svg" is deliberately NOT in this set. The bucket is public and inline
// SVG can carry executable script (stored XSS), so SVG uploads are rejected —
// use PNG/WebP instead.
const ALLOWED_EXT = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif",
  "mp4", "webm", "mov",
  "mp3", "wav", "ogg", "m4a",
  "obj", "gltf", "glb", "fbx", "stl", "dae", "3ds",
]);

// Canonical server-side MIME per extension. The upload always uses this value,
// never the client-supplied file.type.
const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  obj: "model/obj",
  gltf: "model/gltf+json",
  glb: "model/gltf-binary",
  fbx: "application/octet-stream",
  stl: "model/stl",
  dae: "model/vnd.collada+xml",
  "3ds": "application/x-3ds",
};

// Client types we accept per extension (common browser aliases). An empty
// client type is treated as "unknown" and allowed; any other mismatch is
// rejected so a renamed executable cannot ride in under an allowed extension.
const EXT_TO_ALLOWED_TYPES: Record<string, Set<string>> = {
  png: new Set(["image/png"]),
  jpg: new Set(["image/jpeg"]),
  jpeg: new Set(["image/jpeg"]),
  gif: new Set(["image/gif"]),
  webp: new Set(["image/webp"]),
  avif: new Set(["image/avif"]),
  mp4: new Set(["video/mp4"]),
  webm: new Set(["video/webm"]),
  mov: new Set(["video/quicktime"]),
  mp3: new Set(["audio/mpeg", "audio/mp3"]),
  wav: new Set(["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"]),
  ogg: new Set(["audio/ogg", "video/ogg"]),
  m4a: new Set(["audio/mp4", "audio/x-m4a", "audio/m4a"]),
  obj: new Set(["model/obj", "text/plain"]),
  gltf: new Set(["model/gltf+json", "application/json"]),
  glb: new Set(["model/gltf-binary"]),
  fbx: new Set(["application/octet-stream"]),
  stl: new Set(["model/stl", "application/vnd.ms-pki.stl"]),
  dae: new Set(["model/vnd.collada+xml", "application/xml", "text/xml"]),
  "3ds": new Set(["application/x-3ds"]),
};

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
      return json({ error: "File is empty or too large (max 10MB)" }, 400);
    }

    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (ext === "svg") {
      // Rejected: public bucket + inline SVG scriptability = stored XSS risk.
      return json({ error: "SVG uploads are not allowed" }, 400);
    }
    if (!ALLOWED_EXT.has(ext)) return json({ error: "Unsupported file type" }, 400);

    const canonicalMime = EXT_TO_MIME[ext];
    if (!canonicalMime) return json({ error: "Unsupported file type" }, 400);

    // Reject client MIME/extension mismatches server-side.
    const clientType = (file.type || "").split(";")[0].trim().toLowerCase();
    if (clientType) {
      const allowed = EXT_TO_ALLOWED_TYPES[ext];
      if (!allowed || !allowed.has(clientType)) {
        console.error("MIME/extension mismatch:", file.name, clientType);
        return json({ error: "File content does not match its extension" }, 400);
      }
    }

    // Server-generated name: never trust the client-supplied path.
    const path = `${crypto.randomUUID()}.${ext}`;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { error } = await supabase.storage
      .from("blog-images")
      .upload(path, new Uint8Array(await file.arrayBuffer()), {
        contentType: canonicalMime,
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
