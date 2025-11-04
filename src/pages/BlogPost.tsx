import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowLeft } from "lucide-react";

const BlogPost = () => {
  const { id } = useParams();

  // This would normally come from a database or CMS
  const post = {
    title: "2025 DECODE Season Kickoff",
    date: "September 15, 2025",
    category: "Season Update",
    readTime: "5 min read",
    content: `
      <p>The 2025 FTC season is officially underway, and we couldn't be more excited! This year's game, DECODE, presents unique challenges that will test our engineering, programming, and strategic thinking skills.</p>
      
      <h2>Understanding the Game</h2>
      <p>DECODE introduces several new game elements that require innovative solutions. Our team has spent the past few weeks analyzing the game manual, watching reveal videos, and brainstorming potential robot designs.</p>
      
      <h2>Our Strategy</h2>
      <p>After careful consideration, we've identified three key areas of focus for this season:</p>
      <ul>
        <li><strong>Autonomous Programming:</strong> Developing reliable and efficient autonomous routines will be crucial for maximizing our scoring potential.</li>
        <li><strong>Mechanical Precision:</strong> This year's game requires precise manipulation of game elements, so we're prioritizing accuracy in our mechanical design.</li>
        <li><strong>Speed and Efficiency:</strong> The ability to complete tasks quickly will give us a competitive edge, so we're designing for rapid cycles.</li>
      </ul>
      
      <h2>Team Goals</h2>
      <p>Beyond competition success, we have several team goals for this season:</p>
      <ul>
        <li>Improve our engineering documentation and design process</li>
        <li>Expand our community outreach efforts</li>
        <li>Mentor newer team members and share knowledge</li>
        <li>Maintain a positive and collaborative team culture</li>
      </ul>
      
      <h2>Looking Ahead</h2>
      <p>We're excited about the challenges ahead and look forward to competing in the Spencer and Tesla leagues. Stay tuned for more updates as we design, build, and test our robot!</p>
      
      <p>Go Wolverines! 🐺⚙️</p>
    `
  };

  return (
    <div className="min-h-screen py-20">
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
                <span className="text-sm text-muted-foreground">{post.readTime}</span>
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
            <div 
              className="prose prose-lg max-w-none prose-headings:font-orbitron prose-headings:font-bold prose-h2:text-3xl prose-h2:mt-8 prose-h2:mb-4 prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-4 prose-ul:text-muted-foreground prose-li:mb-2 prose-strong:text-foreground"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </article>

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
    </div>
  );
};

export default BlogPost;
