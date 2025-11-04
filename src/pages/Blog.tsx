import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const Blog = () => {
  const blogPosts = [
    {
      id: "season-kickoff-2025",
      title: "2025 DECODE Season Kickoff",
      excerpt: "The new season is here! Learn about this year's game and our strategy for success.",
      date: "September 15, 2025",
      category: "Season Update",
      readTime: "5 min read"
    },
    {
      id: "building-our-robot",
      title: "Building Our Competition Robot",
      excerpt: "Follow our journey from initial designs to a fully functional competition robot.",
      date: "October 3, 2025",
      category: "Engineering",
      readTime: "7 min read"
    },
    {
      id: "programming-autonomous",
      title: "Programming Autonomous Modes",
      excerpt: "Dive into our approach to autonomous programming and sensor integration.",
      date: "October 18, 2025",
      category: "Programming",
      readTime: "6 min read"
    },
    {
      id: "team-culture",
      title: "Building a Strong Team Culture",
      excerpt: "How we foster collaboration, learning, and fun within our team.",
      date: "October 28, 2025",
      category: "Team",
      readTime: "4 min read"
    },
    {
      id: "first-competition-prep",
      title: "Preparing for Our First Competition",
      excerpt: "The final preparations before Spencer League Meet 1 and what we've learned.",
      date: "November 5, 2025",
      category: "Competition",
      readTime: "5 min read"
    },
    {
      id: "rookie-year-reflections",
      title: "Reflections on Our Rookie Year",
      excerpt: "Looking back at our first year in FTC and the lessons we learned.",
      date: "May 20, 2024",
      category: "Team",
      readTime: "8 min read"
    }
  ];

  const categories = ["All", "Season Update", "Engineering", "Programming", "Competition", "Team"];

  return (
    <div className="min-h-screen py-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-orbitron font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
            Team Blog
          </h1>
          <p className="text-xl text-muted-foreground">
            Updates, insights, and stories from the Wolverines
          </p>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-3 justify-center mb-12">
          {categories.map((category) => (
            <Badge 
              key={category} 
              variant={category === "All" ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors px-4 py-2"
            >
              {category}
            </Badge>
          ))}
        </div>

        {/* Blog Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blogPosts.map((post) => (
            <Card key={post.id} className="hover:shadow-glow transition-all group">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary">{post.category}</Badge>
                  <span className="text-sm text-muted-foreground">{post.readTime}</span>
                </div>
                <CardTitle className="group-hover:text-primary transition-colors">
                  {post.title}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-2">
                  <Calendar className="w-4 h-4" />
                  {post.date}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  {post.excerpt}
                </p>
                <Link to={`/blog/${post.id}`}>
                  <Button variant="ghost" className="group/btn w-full">
                    Read More
                    <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Blog;
