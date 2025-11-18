import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowLeft, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import DOMPurify from "dompurify";
import { useEffect, useRef } from "react";
import img1 from "@/assets/blog/first-game-image-1.jpg";
import img2 from "@/assets/blog/first-game-image-2.jpg";
import img3 from "@/assets/blog/first-game-image-3.jpg";
const BlogPost = () => {
  const {
    id
  } = useParams();
  const {
    data: post,
    isLoading
  } = useQuery({
    queryKey: ["blog-post", id],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("blog_posts").select("*").eq("slug", id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.slug,
        title: data.title,
        date: new Date(data.published_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric"
        }),
        category: data.category,
        readTime: data.read_time,
        content: data.content
      };
    },
    enabled: !!id
  });
  const uploadedRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ensureImages = async () => {
      if (!post) return;
      try {
        const storageBase = 'https://cymvcskrchgjkmdwmexu.supabase.co/storage/v1/object/public/blog-images';
        const files = [{
          name: 'first-game-image-1.jpg',
          src: img1,
          type: 'image/jpeg'
        }, {
          name: 'first-game-image-2.jpg',
          src: img2,
          type: 'image/jpeg'
        }, {
          name: 'first-game-image-3.jpg',
          src: img3,
          type: 'image/jpeg'
        }];
        // Always upsert all predefined images to guarantee availability
        for (const f of files) {
          try {
            const res = await fetch(f.src);
            if (!res.ok) continue;
            const blob = await res.blob();
            const {
              error
            } = await supabase.storage.from('blog-images').upload(f.name, blob, {
              contentType: f.type,
              upsert: true
            });
            if (error) console.error('Storage upload error', f.name, error.message);
          } catch (err) {
            console.error('Storage upload exception', f.name, err);
          }
        }
      } catch (e) {
        console.error('Auto-upload blog images error', e);
      }
    };
    if (post && !uploadedRef.current) {
      uploadedRef.current = true;
      ensureImages();
    }
  }, [post]);

  // Enhance images inside the rendered HTML: lazy-load and fallback to local assets if remote fails
  useEffect(() => {
    if (!post) return;
    const t = setTimeout(() => {
      const container = contentRef.current;
      if (!container) return;
      const imgs = Array.from(container.getElementsByTagName('img'));
        const map: Record<string, string> = {
          'first-game-image-1.jpg': img1,
          'first-game-image-2.jpg': img2,
          'first-game-image-3.jpg': img3
        };
      imgs.forEach(img => {
        try {
          img.loading = 'lazy';
          // Set async decoding when supported
          img.setAttribute('decoding', 'async');
          const onError = () => {
            try {
              const name = new URL(img.src).pathname.split('/').pop() || '';
              if (map[name]) {
                img.src = map[name];
              }
            } catch {
              // ignore
            }
          };
          img.addEventListener('error', onError, {
            once: true
          });
        } catch {
          // ignore individual image failures
        }
      });
    }, 0);
    return () => clearTimeout(t);
  }, [post]);
  if (isLoading) {
    return <div className="min-h-screen py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Skeleton className="h-10 w-32 mb-8" />
            <Skeleton className="h-8 w-32 mb-4" />
            <Skeleton className="h-16 w-full mb-4" />
            <div className="flex gap-4 mb-8">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </div>;
  }
  if (!post) {
    return <div className="min-h-screen py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl font-orbitron font-bold mb-4">Post Not Found</h1>
            <p className="text-muted-foreground mb-8">The blog post you're looking for doesn't exist.</p>
            <Link to="/blog">
              <Button>
                <ArrowLeft className="mr-2 w-4 h-4" />
                Back to Blog
              </Button>
            </Link>
          </div>
        </div>
      </div>;
  }
  const sanitizedContent = DOMPurify.sanitize(post.content);
  return <div className="min-h-screen py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {/* Back Button */}
          <Link to="/blog">
            <Button variant="ghost" className="mb-8 group">
              <ArrowLeft className="mr-2 w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to Blog
            </Button>
          </Link>

          {/* Post Header */}
          <article className="animate-fade-in">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Badge variant="secondary">{post.category}</Badge>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {post.readTime}
                </span>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-orbitron font-bold mb-4">
                {post.title}
              </h1>
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <time>{post.date}</time>
              </div>
            </div>

            {/* Post Content */}
            <div ref={contentRef} className="prose prose-lg max-w-none prose-headings:font-orbitron prose-headings:font-bold prose-h1:text-5xl prose-h1:mt-10 prose-h1:mb-6 prose-h2:text-3xl prose-h2:mt-8 prose-h2:mb-4 prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-4 prose-ul:text-muted-foreground prose-li:mb-2 prose-strong:text-foreground prose-img:rounded-lg prose-img:shadow-lg" dangerouslySetInnerHTML={{
            __html: sanitizedContent
          }} />
          </article>

          {/* CAD Model Viewer */}
          

          {/* Share or Related Posts could go here */}
          <div className="mt-12 pt-8 border-t border-border">
            <Link to="/blog">
              <Button variant="outline" className="group">
                <ArrowLeft className="mr-2 w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                View All Posts
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>;
};
export default BlogPost;