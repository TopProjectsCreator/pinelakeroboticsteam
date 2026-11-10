
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  MapPin,
  Trophy,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import robot2024 from "@/assets/robot-detail.jpg";

const teamEventsUrl =
  "https://ftc-events.firstinspires.org/2026/team/23442";

const Tournaments = () => {
  const inProgressEvents: {
    name: string;
    date: string;
    location: string;
    league: string;
    link: string;
  }[] = [];

  const upcomingEvents = [
    {
      name: "Spencer League Meet 2",
      date: "November 15, 2026",
      location: "Beaver Lake Middle School, Sammamish, WA",
      league: "Spencer",
      link: teamEventsUrl,
    },
    {
      name: "Hawking League Tournament",
      date: "December 13, 2026",
      location: "Mount Si High School, Snoqualmie, WA",
      league: "Hawking",
      link: "https://firstwa.org/event/ftc-hawking-lt-2026/",
    },
  ];

  const pastEvents = [
    {
      name: "Spencer League Meet 1",
      date: "November 1, 2026",
      location: "Beaver Lake Middle School, Sammamish, WA",
      league: "Spencer",
      link: teamEventsUrl,
    },
  ];

  const pastSeasons = [
    {
      year: "2025",
      season: "DECODE",
      achievements: [
        "Launched the team's website",
        "Partnered with Build the Future to sort and prepare LEGO donations for children experiencing homelessness",
      ],
    },
    {
      year: "2024",
      season: "INTO THE DEEP",
      achievements: [
        "Competed in regional tournaments",
        "Advanced autonomous programming",
      ],
      image: robot2024,
      imageAlt: "Wolverines Team 23442 robot - 2024 season",
    },
    {
      year: "2023",
      season: "CENTERSTAGE",
      achievements: [
        "Rookie year",
        "Established team foundation",
        "First competition experience",
      ],
    },
  ];

  const EventCard = ({
    event,
    status,
  }: {
    event: {
      name: string;
      date: string;
      location: string;
      league: string;
      link: string;
    };
    status: "Upcoming" | "Completed" | "In Progress";
  }) => (
    <Card
      className={`hover:shadow-glow transition-shadow ${
        status === "In Progress"
          ? "border-2 border-primary animate-pulse-slow"
          : ""
      }`}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="mb-2">
              {event.name}
            </CardTitle>
            <CardDescription>
              <Badge variant="outline">
                {event.league} League
              </Badge>
            </CardDescription>
          </div>

          <Badge
            variant={
              status === "Completed"
                ? "secondary"
                : "default"
            }
            className={
              status === "In Progress"
                ? "bg-red-500 hover:bg-red-600 animate-pulse"
                : ""
            }
          >
            {status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>{event.date}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 shrink-0" />
            <span>{event.location}</span>
          </div>

          <a
            href={event.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-4"
          >
            <Button
              variant={status === "Upcoming" ? "outline" : "outline"}
              size="sm"
              className="w-full group"
            >
              Event Details
              <ExternalLink className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen py-20">
      <div className="container mx-auto px-4">

        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-orbitron font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
            Tournaments
          </h1>
          <p className="text-xl text-muted-foreground">
            Follow our journey through the 2026 BIOBUZZ season
          </p>
        </div>

        {/* Current Season */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <Trophy className="w-8 h-8 text-primary" />
            <h2 className="text-3xl font-orbitron font-bold">
              2026 Season: BIOBUZZ
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* League Membership */}
            <Card className="hover:shadow-glow transition-shadow">
              <CardHeader>
                <CardTitle>League Membership</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Badge className="mb-2">
                      Spencer League
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Issaquah Area | Washington
                    </p>
                  </div>

                  <div>
                    <Badge variant="secondary" className="mb-2">
                      Hawking League
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Washington State
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Info */}
            <Card className="hover:shadow-glow transition-shadow">
              <CardHeader>
                <CardTitle>Team Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Team Number:
                    </span>
                    <span className="font-semibold">23442</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Region:
                    </span>
                    <span className="font-semibold">Washington</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Rookie Year:
                    </span>
                    <span className="font-semibold">2023</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      School:
                    </span>
                    <span className="font-semibold">PLMS</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Live Events */}
        {inProgressEvents.length > 0 && (
          <section className="mb-16">
            <h2 className="text-3xl font-orbitron font-bold mb-8">
              Live Now
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {inProgressEvents.map((event) => (
                <EventCard
                  key={event.name}
                  event={event}
                  status="In Progress"
                />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <section className="mb-16">
            <h2 className="text-3xl font-orbitron font-bold mb-8">
              Upcoming Events
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {upcomingEvents.map((event) => (
                <EventCard
                  key={event.name}
                  event={event}
                  status="Upcoming"
                />
              ))}
            </div>
          </section>
        )}

        {/* Past League Events */}
        <section className="mb-16">
          <h2 className="text-3xl font-orbitron font-bold mb-8">
            Past League Events
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pastEvents.map((event) => (
              <EventCard
                key={event.name}
                event={event}
                status="Completed"
              />
            ))}
          </div>
        </section>

        {/* Past Seasons */}
        <section>
          <h2 className="text-3xl font-orbitron font-bold mb-8">
            Past Seasons
          </h2>

          <div className="space-y-6">
            {pastSeasons.map((season) => (
              <Card
                key={season.year}
                className="hover:shadow-glow transition-shadow"
              >
                <CardHeader>
                  <CardTitle>
                    {season.year} Season
                  </CardTitle>

                  <CardDescription className="text-lg font-semibold text-primary">
                    {season.season}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {season.image && (
                    <div className="mb-6">
                      <img
                        src={season.image}
                        alt={season.imageAlt}
                        className="w-full max-h-96 object-contain rounded-lg"
                      />
                    </div>
                  )}

                  <ul className="space-y-2">
                    {season.achievements.map(
                      (achievement, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3"
                        >
                          <div className="w-2 h-2 mt-2 bg-primary rounded-full shrink-0" />
                          <span className="text-muted-foreground">
                            {achievement}
                          </span>
                        </li>
                      )
                    )}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};

export default Tournaments;
