import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Calendar, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import heroImage from "@/assets/robot-hero.jpg";
import robotDetail from "@/assets/robot-detail.jpg";
import teamPhoto2025 from "@/assets/team-photo-2025.jpg";
import teamWorkspace from "@/assets/team-workspace.jpg";
import teamBuilding from "@/assets/team-building.jpg";
import teamShopping from "@/assets/team-shopping.jpg";

const Home = () => {
  const { data: recentPosts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["recent-blog-posts"],
    queryFn: async () => {
      const { data, error } = await supabase.
      from("blog_posts").
      select("*").
      order("published_at", { ascending: false }).
      limit(2);
      if (error) throw error;
      return data.map((post) => ({
        id: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        category: post.category,
        readTime: post.read_time,
        date: new Date(post.published_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric"
        })
      }));
    }
  });
  useEffect(() => {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [{
        "@type": "Question",
        "name": "What is FTC (FIRST Tech Challenge)?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "FTC (FIRST Tech Challenge) is a robotics competition for students in grades 7-12. Teams design, build, and program robots to compete in an alliance format against other teams. It combines the excitement of sport with science and technology, teaching students valuable life skills."
        }
      }, {
        "@type": "Question",
        "name": "Where is the Wolverines team located?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The Wolverines (Team 23442) are based in Sammamish, Washington, and compete from Pine Lake Middle School (PLMS). We participate in the Spencer and Tesla leagues."
        }
      }, {
        "@type": "Question",
        "name": "How long has the Wolverines team been competing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The Wolverines team started competing in the 2023 season as a rookie team. We are currently in our third season of FTC competition."
        }
      }, {
        "@type": "Question",
        "name": "What leagues do the Wolverines compete in?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The Wolverines compete in both the Spencer and Tesla leagues in the FTC competition structure. We participate in league meets and qualification tournaments throughout the season."
        }
      }]
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(faqSchema);
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);
  return <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{
        backgroundImage: `url(${heroImage})`
      }}>
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/60" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl animate-fade-in">
            <div className="inline-block px-4 py-2 bg-primary/10 rounded-full mb-6">
              <span className="text-primary font-semibold">Team 23442</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-orbitron font-bold mb-4 bg-gradient-primary bg-clip-text text-orange-600">
              Wolverines
            </h1>
            <p className="text-2xl md:text-3xl font-semibold mb-6 text-foreground">
              "All Claws on Deck!"
            </p>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">
              Building the future, one robot at a time. FTC robotics team from Sammamish, WA.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/about">
                <Button size="lg" className="group text-cyan-50 bg-blue-950 hover:bg-blue-800">
                  Learn About Us
                  <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/tournaments">
                <Button size="lg" variant="outline">
                  View Tournaments
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-orbitron font-bold mb-12 text-center text-blue-900">Our Impact</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center hover:shadow-glow transition-shadow">
              <CardContent className="pt-8 pb-8">
                <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="text-3xl font-bold mb-2">3</h3>
                <p className="text-muted-foreground">Seasons Competing</p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-glow transition-shadow">
              <CardContent className="pt-8 pb-8">
                <div className="w-16 h-16 bg-gradient-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-accent-foreground" />
                </div>
                <h3 className="text-3xl font-bold mb-2">9</h3>
                <p className="text-muted-foreground">Team Members</p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-glow transition-shadow">
              <CardContent className="pt-8 pb-8">
                <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="text-3xl font-bold mb-2">2</h3>
                <p className="text-muted-foreground">League Competitions</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Team in Action Gallery */}
      










      {/* About Preview */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <h2 className="text-4xl font-orbitron font-bold mb-6 text-blue-900">Who We Are</h2>
              <p className="text-lg text-muted-foreground mb-6">
                The Wolverines are a dedicated FTC robotics team from Sammamish, Washington. Since our rookie year in 2023, we've been pushing the boundaries of innovation and teamwork.
              </p>
              <p className="text-lg text-muted-foreground mb-8">From PLMS, we compete in both the Spencer and Tesla leagues, bringing our passion for STEM and robotics to every competition.</p>
              <Link to="/about">
                <Button variant="outline" size="lg" className="group">
                  Read Our Story
                  <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
            <div className="order-1 lg:order-2">
              <img src={teamPhoto2025} alt="Wolverines Team 23442 - 2025 Season" className="rounded-2xl shadow-card w-full h-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* Blog Preview Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-orbitron font-bold mb-4 text-blue-900">Latest from Our Blog</h2>
            <p className="text-lg text-muted-foreground">
              Updates, insights, and stories from the Wolverines
            </p>
          </div>
          
          {postsLoading ?
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {[1, 2].map((i) =>
          <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-24 mb-2" />
                    <Skeleton className="h-8 w-full mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
          )}
            </div> :
        recentPosts.length === 0 ?
        <div className="text-center py-8">
              <p className="text-muted-foreground">No blog posts yet. Check back soon!</p>
            </div> :

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {recentPosts.map((post) =>
          <Card key={post.id} className="hover:shadow-glow transition-all group">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary">{post.category}</Badge>
                      <span className="text-sm text-muted-foreground">{post.readTime}</span>
                    </div>
                    <CardTitle className="group-hover:text-primary transition-colors line-clamp-2">
                      {post.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2">
                      <Calendar className="w-4 h-4" />
                      {post.date}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground line-clamp-2 mb-4">
                      {post.excerpt}
                    </p>
                    <Link to={`/blog/${post.id}`} aria-label={`Read ${post.title}`}>
                      <Button variant="ghost" className="group/btn w-full">
                        Read {post.title}
                        <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
          )}
            </div>
        }
          
          <div className="text-center mt-8">
            <Link to="/blog">
              <Button variant="outline" size="lg" className="group">
                View All Posts
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-4xl font-orbitron font-bold mb-6 text-center">Frequently Asked Questions</h2>
          <p className="text-lg text-muted-foreground mb-12 text-center">
            Learn more about the Wolverines and FTC robotics
          </p>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-left">What is FTC (FIRST Tech Challenge)?</AccordionTrigger>
              <AccordionContent>
                FTC (FIRST Tech Challenge) is a robotics competition for students in grades 7-12. Teams design, build, and program robots to compete in an alliance format against other teams. It combines the excitement of sport with science and technology, teaching students valuable life skills.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-left">Where is the Wolverines team located?</AccordionTrigger>
              <AccordionContent>
                The Wolverines (Team 23442) are based in Sammamish, Washington, and compete from Pine Lake Middle School (PLMS). We participate in the Spencer and Tesla leagues.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-left">How long has the Wolverines team been competing?</AccordionTrigger>
              <AccordionContent>
                The Wolverines team started competing in the 2023 season as a rookie team. We are currently in our third season of FTC competition.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger className="text-left">What leagues do the Wolverines compete in?</AccordionTrigger>
              <AccordionContent>
                The Wolverines compete in both the Spencer and Tesla leagues in the FTC competition structure. We participate in league meets and qualification tournaments throughout the season.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-orbitron font-bold mb-6">Get in Touch</h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Interested in robotics? Want to support our team? Have questions about FTC?
          </p>
          <Link to="/contact">
            <Button size="lg" variant="secondary">
              Contact Us
            </Button>
          </Link>
        </div>
      </section>
    </div>;
};
export default Home;