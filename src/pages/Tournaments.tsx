import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Trophy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import robot2024 from "@/assets/robot-detail.jpg";
const Tournaments = () => {
  const inProgressEvents: { name: string; date: string; location: string; league: string; status?: string; link: string }[] = [];

  const upcomingEvents: typeof inProgressEvents = [];

  const pastEvents = [{
    name: "Tesla League Tournament",
    date: "December 14, 2025",
    location: "Beaver Lake Middle School",
    league: "Tesla",
    link: "https://ftc-events.firstinspires.org/2025/USWATELT"
  }, {
    name: "Spencer League Meet 2",
    date: "November 22, 2025",
    location: "Beaver Lake Middle School",
    league: "Spencer",
    link: "https://ftc-events.firstinspires.org/2025/USWASPM2"
  }, {
    name: "Spencer League Meet 1",
    date: "November 09, 2025",
    location: "Beaver Lake Middle School",
    league: "Spencer",
    link: "https://ftc-events.firstinspires.org/2025/USWASPM1"
  }];
  const pastSeasons = [{
    year: "2024",
    season: "INTO THE DEEP",
    achievements: ["Competed in regional tournaments", "Advanced autonomous programming"],
    image: robot2024,
    imageAlt: "Wolverines Team 23442 robot - 2024 season"
  }, {
    year: "2023",
    season: "CENTERSTAGE",
    achievements: ["Rookie year", "Established team foundation", "First competition experience"]
  }];
  return <div className="min-h-screen py-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-orbitron font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
            Tournaments
          </h1>
          <p className="text-xl text-muted-foreground">
            Follow our journey through the 2025 DECODE season
          </p>
        </div>

        {/* Current Season */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <Trophy className="w-8 h-8 text-primary" />
            <h2 className="text-3xl font-orbitron font-bold">2025 Season: DECODE</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="hover:shadow-glow transition-shadow">
              <CardHeader>
                <CardTitle>League Membership</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Badge className="mb-2">Spencer League</Badge>
                    <p className="text-sm text-muted-foreground">
                      Location: Issaquah | 12 Teams
                    </p>
                  </div>
                  <div>
                    <Badge variant="secondary" className="mb-2">Tesla League</Badge>
                    <p className="text-sm text-muted-foreground">
                      Parent League | Washington State
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-glow transition-shadow">
              <CardHeader>
                <CardTitle>Team Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Team Number:</span>
                    <span className="font-semibold">23442</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Region:</span>
                    <span className="font-semibold">Washington</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rookie Year:</span>
                    <span className="font-semibold">2023</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">School:</span>
                    <span className="font-semibold">PLMS</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* In Progress Events */}
        {inProgressEvents.length > 0 && (
          <section className="mb-16">
            <h2 className="text-3xl font-orbitron font-bold mb-8">🔴 Live Now</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {inProgressEvents.map((event, index) => (
                <Card key={index} className="hover:shadow-glow transition-shadow border-2 border-primary animate-pulse-slow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="mb-2">{event.name}</CardTitle>
                        <CardDescription>
                          <Badge variant="outline">{event.league} League</Badge>
                        </CardDescription>
                      </div>
                      <Badge className="bg-red-500 hover:bg-red-600 animate-pulse">In Progress</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{event.date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{event.location}</span>
                      </div>
                      <a href={event.link} target="_blank" rel="noopener noreferrer" className="block mt-4">
                        <Button variant="default" size="sm" className="w-full group">
                          Live Event Details
                          <ExternalLink className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <section className="mb-16">
            <h2 className="text-3xl font-orbitron font-bold mb-8">Upcoming Events</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {upcomingEvents.map((event, index) => (
                <Card key={index} className="hover:shadow-glow transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="mb-2">{event.name}</CardTitle>
                        <CardDescription>
                          <Badge variant="outline">{event.league} League</Badge>
                        </CardDescription>
                      </div>
                      <Badge variant="default">Upcoming</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{event.date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{event.location}</span>
                      </div>
                      <a href={event.link} target="_blank" rel="noopener noreferrer" className="block mt-4">
                        <Button variant="outline" size="sm" className="w-full group">
                          Event Details
                          <ExternalLink className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Past League Events */}
        <section className="mb-16">
          <h2 className="text-3xl font-orbitron font-bold mb-8">Past League Events</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pastEvents.map((event, index) => (
              <Card key={index} className="hover:shadow-glow transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="mb-2">{event.name}</CardTitle>
                      <CardDescription>
                        <Badge variant="outline">{event.league} League</Badge>
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">Completed</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{event.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{event.location}</span>
                    </div>
                    <a href={event.link} target="_blank" rel="noopener noreferrer" className="block mt-4">
                      <Button variant="outline" size="sm" className="w-full group">
                        Event Details
                        <ExternalLink className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
        {/* Season Timeline */}
        <section className="mb-16">
          <h2 className="text-3xl font-orbitron font-bold mb-10 text-center">Our Journey</h2>
          <div className="relative max-w-3xl mx-auto">
            {/* Vertical line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-0.5 bg-border md:-translate-x-px" />

            {[
              { year: "2023", season: "CENTERSTAGE", side: "left", items: ["Team founded at PLMS", "Rookie season kickoff", "First competition experience", "Learned the ropes of FTC"] },
              { year: "2024", season: "INTO THE DEEP", side: "right", items: ["Advanced autonomous programming", "Competed in regional tournaments", "Improved mechanical design", "Grew team skills & confidence"] },
              { year: "2025", season: "DECODE", side: "left", items: ["Joined Spencer & Tesla leagues", "3 league events completed", "Stronger team collaboration", "Season still in progress!"] },
            ].map((entry, i) => (
              <div key={i} className={`relative flex items-start mb-12 ${i === 2 ? 'mb-0' : ''} md:${entry.side === 'left' ? 'flex-row' : 'flex-row-reverse'}`}>
                {/* Dot */}
                <div className="absolute left-6 md:left-1/2 w-4 h-4 bg-primary rounded-full border-4 border-background -translate-x-1/2 mt-1 z-10" />

                {/* Content card */}
                <div className={`ml-14 md:ml-0 md:w-[calc(50%-2rem)] ${entry.side === 'left' ? 'md:mr-auto md:pr-8' : 'md:ml-auto md:pl-8'}`}>
                  <Card className="hover:shadow-glow transition-shadow">
                    <CardHeader className="pb-3">
                      <Badge className="w-fit mb-1">{entry.year}</Badge>
                      <CardTitle className="text-lg">{entry.season}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5">
                        {entry.items.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Past Seasons */}
        <section>
          <h2 className="text-3xl font-orbitron font-bold mb-8">Past Seasons</h2>
          <div className="space-y-6">
            {pastSeasons.map((season, index) => <Card key={index} className="hover:shadow-glow transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{season.year} Season</CardTitle>
                      <CardDescription className="text-lg font-semibold text-primary">
                        {season.season}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {season.image && <div className="mb-6">
                      
                    </div>}
                  <ul className="space-y-2">
                    {season.achievements.map((achievement, idx) => <li key={idx} className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full" />
                        <span className="text-muted-foreground">{achievement}</span>
                      </li>)}
                  </ul>
                </CardContent>
              </Card>)}
          </div>
        </section>
      </div>
    </div>;
};
export default Tournaments;