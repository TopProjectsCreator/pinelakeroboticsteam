import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Heart, Lightbulb, Award } from "lucide-react";
import teamCollaboration from "@/assets/team-collaboration.jpg";

const About = () => {
  return (
    <div className="min-h-screen py-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-orbitron font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
            About the Wolverines
          </h1>
          <p className="text-xl text-muted-foreground">
            Team 23442 - Building the future through robotics and teamwork
          </p>
        </div>

        {/* Team Image */}
        <div className="max-w-5xl mx-auto mb-16">
          <img 
            src={teamCollaboration} 
            alt="Wolverines team collaboration" 
            className="rounded-2xl shadow-card w-full h-auto"
          />
        </div>

        {/* Our Story */}
        <section className="max-w-4xl mx-auto mb-20">
          <h2 className="text-3xl font-orbitron font-bold mb-6">Our Story</h2>
          <div className="space-y-4 text-lg text-muted-foreground">
            <p>
              Founded in 2023, the Wolverines (Team 23442) emerged from Pine Lake Middle School in Sammamish, Washington, with a mission to explore the exciting world of robotics and STEM education.
            </p>
            <p>
              As a rookie team, we quickly learned that success in FTC robotics requires more than just building robots—it demands collaboration, innovation, critical thinking, and gracious professionalism. These values have become the foundation of our team culture.
            </p>
            <p>
              We compete in both the Spencer and Tesla leagues in Washington State, participating in the FIRST Tech Challenge program. Each season brings new challenges, new opportunities to learn, and new ways to grow as engineers and teammates.
            </p>
          </div>
        </section>

        {/* Values */}
        <section className="mb-20">
          <h2 className="text-3xl font-orbitron font-bold mb-10 text-center">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-glow transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
                  <Target className="w-6 h-6 text-primary-foreground" />
                </div>
                <CardTitle>Innovation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Pushing boundaries and finding creative solutions to complex challenges.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-glow transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-accent rounded-lg flex items-center justify-center mb-4">
                  <Heart className="w-6 h-6 text-accent-foreground" />
                </div>
                <CardTitle>Teamwork</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Collaborating effectively and supporting each other's growth.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-glow transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
                  <Lightbulb className="w-6 h-6 text-primary-foreground" />
                </div>
                <CardTitle>Learning</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Continuously improving our skills in engineering and problem-solving.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-glow transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-accent rounded-lg flex items-center justify-center mb-4">
                  <Award className="w-6 h-6 text-accent-foreground" />
                </div>
                <CardTitle>Excellence</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Striving for the highest quality in everything we build and do.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* What We Do */}
        <section className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-orbitron font-bold mb-6">What We Do</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Design & Build</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We design, prototype, and build competitive robots from scratch, learning mechanical engineering, CAD, and fabrication techniques.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Programming</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Our software team develops autonomous and driver-controlled programs using Java and the FTC SDK.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Outreach</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We promote STEM education in our community through demonstrations, workshops, and mentoring younger students.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Competition</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We compete in FTC tournaments, forming alliances and demonstrating gracious professionalism on and off the field.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
};

export default About;
