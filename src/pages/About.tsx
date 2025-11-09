import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass, Lightbulb, Zap, Users, Heart, Sparkles, ExternalLink } from "lucide-react";
import teamCollaboration from "@/assets/team-collaboration.jpg";
import maxsimPhoto from "@/assets/team/maxsim.jpg";
import simPhoto from "@/assets/team/sim.jpg";
import janyaPhoto from "@/assets/team/janya.jpg";
import abhiPhoto from "@/assets/team/abhi.jpg";
import ishaanPhoto from "@/assets/team/ishaan.jpg";
import aryaPhoto from "@/assets/team/arya.jpg";
import edwardPhoto from "@/assets/team/edward.jpg";
import adityaPhoto from "@/assets/team/aditya.jpg";
import shriyashPhoto from "@/assets/team/shriyash.jpg";
const About = () => {
  return <div className="min-h-screen py-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-orbitron font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
            About the Wolverines
          </h1>
          <p className="text-xl text-muted-foreground mb-6">
            Team 23442 - Building the future through robotics and teamwork
          </p>
          <Button asChild variant="outline" size="lg">
            <a href="https://ftc-events.firstinspires.org/2025/team/23442" target="_blank" rel="noopener noreferrer" className="gap-2">
              View Team Profile <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        </div>

        {/* Team Image */}
        <div className="max-w-5xl mx-auto mb-16">
          <img src={teamCollaboration} alt="Wolverines team collaboration" className="rounded-2xl shadow-card w-full h-auto" />
        </div>

        {/* Our Story */}
        <section className="max-w-4xl mx-auto mb-20">
          <h2 className="text-3xl font-orbitron font-bold mb-6">Our Story</h2>
          <div className="space-y-4 text-lg text-muted-foreground">
            <p>
              Founded in 2023, the Wolverines (Team 23442) emerged from PLMS in Sammamish, Washington, with a mission to explore the exciting world of robotics and STEM education.
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-glow transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
                  <Compass className="w-6 h-6 text-primary-foreground" />
                </div>
                <CardTitle>Discovery</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Exploring new ideas and pushing the boundaries of what's possible.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-glow transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-accent rounded-lg flex items-center justify-center mb-4">
                  <Lightbulb className="w-6 h-6 text-accent-foreground" />
                </div>
                <CardTitle>Innovation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Creating unique solutions through creative thinking and experimentation.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-glow transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-primary-foreground" />
                </div>
                <CardTitle>Impact</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Making a meaningful difference in our community through STEM.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-glow transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-accent rounded-lg flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-accent-foreground" />
                </div>
                <CardTitle>Inclusion</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Welcoming everyone and valuing diverse perspectives and backgrounds.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-glow transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
                  <Heart className="w-6 h-6 text-primary-foreground" />
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
                <div className="w-12 h-12 bg-gradient-accent rounded-lg flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-accent-foreground" />
                </div>
                <CardTitle>Fun</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Enjoying the journey and celebrating our achievements together.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Team Roster */}
        <section className="mb-20">
          <h2 className="text-3xl font-orbitron font-bold mb-10 text-center">Meet Our Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-glow transition-shadow">
              <CardContent className="pt-6 text-center">
                <img src={maxsimPhoto} alt="Maxsim - Team Captain" className="w-32 h-32 rounded-full mx-auto mb-4 object-cover" />
                <h3 className="text-xl font-bold mb-1">Maksim</h3>
                <p className="text-muted-foreground">Build Team</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-glow transition-shadow">
              <CardContent className="pt-6 text-center">
                <img src={simPhoto} alt="Sim - Lead Programmer" className="w-32 h-32 rounded-full mx-auto mb-4 object-cover" />
                <h3 className="text-xl font-bold mb-1">Sim</h3>
                <p className="text-muted-foreground">Code team</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-glow transition-shadow">
              <CardContent className="pt-6 text-center">
                <img src={janyaPhoto} alt="Janya - Driver" className="w-32 h-32 rounded-full mx-auto mb-4 object-cover" />
                <h3 className="text-xl font-bold mb-1">Janya</h3>
                <p className="text-muted-foreground">Build Team</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-glow transition-shadow">
              <CardContent className="pt-6 text-center">
                <img src={abhiPhoto} alt="Abhi - Mechanical Lead" className="w-32 h-32 rounded-full mx-auto mb-4 object-cover" />
                <h3 className="text-xl font-bold mb-1">Abhi</h3>
                <p className="text-muted-foreground">Code team</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-glow transition-shadow">
              <CardContent className="pt-6 text-center">
                <img src={ishaanPhoto} alt="Ishaan - CAD Designer" className="w-32 h-32 rounded-full mx-auto mb-4 object-cover" />
                <h3 className="text-xl font-bold mb-1">Ishaan</h3>
                <p className="text-muted-foreground">Code team</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-glow transition-shadow">
              <CardContent className="pt-6 text-center">
                <img src={aryaPhoto} alt="Arya - Outreach Coordinator" className="w-32 h-32 rounded-full mx-auto mb-4 object-cover" />
                <h3 className="text-xl font-bold mb-1">Ayra</h3>
                <p className="text-muted-foreground">Build Team</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-glow transition-shadow">
              <CardContent className="pt-6 text-center">
                <img src={edwardPhoto} alt="Edward - Build Team" className="w-32 h-32 rounded-full mx-auto mb-4 object-cover" />
                <h3 className="text-xl font-bold mb-1">Edward</h3>
                <p className="text-muted-foreground">Code team</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-glow transition-shadow">
              <CardContent className="pt-6 text-center">
                <img src={adityaPhoto} alt="Aditya - Programming Team" className="w-32 h-32 rounded-full mx-auto mb-4 object-cover" />
                <h3 className="text-xl font-bold mb-1">Aditya</h3>
                <p className="text-muted-foreground">Build Team</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-glow transition-shadow">
              <CardContent className="pt-6 text-center">
                <img src={shriyashPhoto} alt="Shriyash - Engineering Notebook" className="w-32 h-32 rounded-full mx-auto mb-4 object-cover" />
                <h3 className="text-xl font-bold mb-1">Shriyash</h3>
                <p className="text-muted-foreground">Build team</p>
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
    </div>;
};
export default About;