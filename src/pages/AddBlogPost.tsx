import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Eye } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Progress } from "@/components/ui/progress";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TurndownService from "turndown";
import { marked } from "marked";

const blogPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  slug: z.string().min(1, "Slug is required").max(200, "Slug must be less than 200 characters"),
  excerpt: z.string().min(1, "Excerpt is required").max(500, "Excerpt must be less than 500 characters"),
  content: z.string().min(1, "Content is required"),
  category: z.string().min(1, "Category is required"),
  read_time: z.string().min(1, "Read time is required"),
});

type BlogPostFormData = z.infer<typeof blogPostSchema>;

const AddBlogPost = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editorMode, setEditorMode] = useState<"markdown" | "visual">("markdown");
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  const form = useForm<BlogPostFormData>({
    resolver: zodResolver(blogPostSchema),
    defaultValues: {
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      category: "",
      read_time: "",
    },
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = turndownService.turndown(html);
      form.setValue("content", markdown);
    },
  });

  const handleModeSwitch = (mode: "markdown" | "visual") => {
    const currentContent = form.getValues("content");
    
    if (mode === "visual" && editor) {
      // Convert markdown to HTML for visual editor
      const html = marked(currentContent) as string;
      editor.commands.setContent(html);
    } else if (mode === "markdown" && editor) {
      // Content is already in markdown form, just update textarea
      form.setValue("content", currentContent);
    }
    
    setEditorMode(mode);
  };

  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileType = file.type;
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    
    // Validate file type
    const isImage = fileType.startsWith('image/');
    const isVideo = fileType.startsWith('video/');
    const isAudio = fileType.startsWith('audio/');
    const is3D = ['.obj', '.gltf', '.glb', '.fbx', '.stl', '.dae', '.3ds'].includes(`.${fileExt}`);
    
    if (!isImage && !isVideo && !isAudio && !is3D) {
      toast.error("Please select an image, video, audio, or 3D file");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Progress simulation for better UX
      const fileSize = file.size;
      const estimatedTime = Math.max(1000, Math.min(fileSize / 10000, 10000)); // 1-10 seconds based on file size
      
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, estimatedTime / 9);

      const { error: uploadError, data } = await supabase.storage
        .from('blog-images')
        .upload(filePath, file);

      clearInterval(progressInterval);
      
      if (uploadError) throw uploadError;
      
      setUploadProgress(100);

      const { data: { publicUrl } } = supabase.storage
        .from('blog-images')
        .getPublicUrl(filePath);

      // Generate appropriate markdown/HTML based on file type
      let insertText = '';
      if (isImage) {
        insertText = `![${file.name}](${publicUrl})`;
        
        // For visual editor, insert image directly
        if (editorMode === "visual" && editor) {
          editor.chain().focus().setImage({ src: publicUrl, alt: file.name }).run();
          toast.success("Image uploaded successfully!");
          return;
        }
      } else if (isVideo) {
        insertText = `<video controls width="100%">\n  <source src="${publicUrl}" type="${fileType}">\n  Your browser does not support the video tag.\n</video>`;
      } else if (isAudio) {
        insertText = `<audio controls>\n  <source src="${publicUrl}" type="${fileType}">\n  Your browser does not support the audio tag.\n</audio>`;
      } else if (is3D) {
        insertText = `[Download 3D Model: ${file.name}](${publicUrl})`;
      }

      if (editorMode === "visual" && editor) {
        // Insert HTML directly in visual editor
        editor.commands.insertContent(insertText);
      } else {
        // Insert in markdown textarea
        const textarea = contentTextareaRef.current;
      
        if (textarea) {
          const cursorPos = textarea.selectionStart;
          const currentContent = form.getValues('content');
          const newContent = 
            currentContent.slice(0, cursorPos) + 
            insertText + 
            currentContent.slice(cursorPos);
          
          form.setValue('content', newContent);
          
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(
              cursorPos + insertText.length,
              cursorPos + insertText.length
            );
          }, 0);
        }
      }

      const fileTypeText = isImage ? 'Image' : isVideo ? 'Video' : isAudio ? 'Audio' : '3D file';
      toast.success(`${fileTypeText} uploaded successfully!`);
    } catch (error) {
      console.error("Error uploading media:", error);
      toast.error("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      event.target.value = '';
    }
  };

  const onSubmit = async (data: BlogPostFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("create-blog-post", {
        body: data,
      });

      if (error) throw error;

      toast.success("Blog post created successfully!");
      navigate("/blog");
    } catch (error) {
      console.error("Error creating blog post:", error);
      toast.error("Failed to create blog post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="container max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Add New Blog Post</h1>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter blog post title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input placeholder="url-friendly-slug" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Design, Engineering" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="read_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Read Time</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 5 min read" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="excerpt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Excerpt</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Short description of the blog post" 
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FormLabel>Content</FormLabel>
                      <div className="flex items-center gap-2">
                        <div className="flex border border-input rounded-md">
                          <Button
                            type="button"
                            variant={editorMode === "markdown" ? "default" : "ghost"}
                            size="sm"
                            className="rounded-r-none"
                            onClick={() => handleModeSwitch("markdown")}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Markdown
                          </Button>
                          <Button
                            type="button"
                            variant={editorMode === "visual" ? "default" : "ghost"}
                            size="sm"
                            className="rounded-l-none"
                            onClick={() => handleModeSwitch("visual")}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Visual
                          </Button>
                        </div>
                        <Label htmlFor="media-upload" className="cursor-pointer">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isUploading}
                            asChild
                          >
                            <span>
                              <Upload className="mr-2 h-4 w-4" />
                              {isUploading ? "Uploading..." : "Add Media"}
                            </span>
                          </Button>
                          <Input
                            id="media-upload"
                            type="file"
                            accept="image/*,video/*,audio/*,.obj,.gltf,.glb,.fbx,.stl,.dae,.3ds"
                            className="hidden"
                            onChange={handleMediaUpload}
                            disabled={isUploading}
                          />
                        </Label>
                      </div>
                    </div>
                    {isUploading && (
                      <div className="space-y-1">
                        <Progress value={uploadProgress} className="h-2" />
                        <p className="text-xs text-muted-foreground text-right">
                          {uploadProgress}%
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <FormLabel className="text-sm text-muted-foreground mb-2 block">Editor</FormLabel>
                      <FormControl>
                        {editorMode === "markdown" ? (
                          <Textarea 
                            placeholder="Write your blog post content here..." 
                            className="min-h-[400px]"
                            {...field}
                            ref={contentTextareaRef}
                          />
                        ) : (
                          <div className="min-h-[400px] border border-input rounded-md bg-background">
                            <EditorContent 
                              editor={editor} 
                              className="prose prose-sm max-w-none dark:prose-invert p-4 min-h-[400px] focus:outline-none"
                            />
                          </div>
                        )}
                      </FormControl>
                    </div>
                    <div>
                      <FormLabel className="text-sm text-muted-foreground mb-2 block">Preview</FormLabel>
                      <div className="min-h-[400px] border border-input rounded-md bg-background p-4 overflow-auto">
                        {field.value ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-base">
                            <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                              {field.value}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">Preview will appear here...</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Blog Post"}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/blog")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default AddBlogPost;
