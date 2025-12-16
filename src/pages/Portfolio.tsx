import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PortfolioPageImage } from "@/components/portfolio/PortfolioPageImage";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X } from "lucide-react";

// Import portfolio pages
import page1 from "@/assets/portfolio/page-1.jpg";
import page2 from "@/assets/portfolio/page-2.jpg";
import page3 from "@/assets/portfolio/page-3.jpg";
import page4 from "@/assets/portfolio/page-4.jpg";
import page5 from "@/assets/portfolio/page-5.jpg";
import page6 from "@/assets/portfolio/page-6.jpg";
import page7 from "@/assets/portfolio/page-7.jpg";
import page8 from "@/assets/portfolio/page-8.jpg";
import page9 from "@/assets/portfolio/page-9.jpg";
import page10 from "@/assets/portfolio/page-10.jpg";
import page11 from "@/assets/portfolio/page-11.jpg";
import page12 from "@/assets/portfolio/page-12.jpg";
import page13 from "@/assets/portfolio/page-13.jpg";
import page14 from "@/assets/portfolio/page-14.jpg";
import page15 from "@/assets/portfolio/page-15.jpg";

const portfolioPages = [
  { src: page1, title: "Cover", rotated: true },
  { src: page2, title: "Our Team" },
  { src: page3, title: "Game Strategy" },
  { src: page4, title: "Robot Architecture" },
  { src: page5, title: "Engineering Process", rotated: true },
  { src: page6, title: "Robot Architecture 2" },
  { src: page7, title: "Robot Upgrades" },
  { src: page8, title: "Robot Overviews" },
  { src: page9, title: "Programming" },
  { src: page10, title: "Obstacles" },
  { src: page11, title: "Lessons Learned" },
  { src: page12, title: "Lessons Learned 2" },
  { src: page13, title: "Outreach" },
  { src: page14, title: "Sponsors & Practice" },
  { src: page15, title: "Mentors" },
];

const Portfolio = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const goToPrevious = () => {
    setCurrentPage((prev) => (prev > 0 ? prev - 1 : portfolioPages.length - 1));
    setIsZoomed(false);
  };

  const goToNext = () => {
    setCurrentPage((prev) => (prev < portfolioPages.length - 1 ? prev + 1 : 0));
    setIsZoomed(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goToPrevious();
    if (e.key === "ArrowRight") goToNext();
    if (e.key === "Escape") {
      setIsFullscreen(false);
      setIsZoomed(false);
    }
  };

  useEffect(() => {
    document.title = "Engineering Portfolio | Wolverines FTC Team 23442";
  }, []);

  const currentPageData = portfolioPages[currentPage];

  return (
    <div
      className="min-h-screen bg-background"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header */}
      <section className="py-16 bg-gradient-to-b from-primary/10 to-background">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Engineering Portfolio
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            2025-2026 Season | Team 23442 Wolverines
          </p>
        </div>
      </section>

      {/* Portfolio Viewer */}
      <section className="py-8 container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Controls */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPrevious}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[100px] text-center">
                Page {currentPage + 1} of {portfolioPages.length}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNext}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsZoomed(!isZoomed)}
                aria-label={isZoomed ? "Zoom out" : "Zoom in"}
              >
                {isZoomed ? (
                  <ZoomOut className="h-4 w-4" />
                ) : (
                  <ZoomIn className="h-4 w-4" />
                )}
              </Button>
              <Button variant="outline" onClick={() => setIsFullscreen(true)}>
                View Fullscreen
              </Button>
            </div>
          </div>

          {/* Current Page Display */}
          <PortfolioPageImage
            src={currentPageData.src}
            alt={`Portfolio page ${currentPage + 1}: ${currentPageData.title}`}
            rotated={!!currentPageData.rotated}
            zoomed={isZoomed}
            onToggleZoom={() => setIsZoomed(!isZoomed)}
          />

          {/* Page Title */}
          <p className="text-center text-muted-foreground mt-4 text-lg">
            {currentPageData.title}
          </p>

          {/* Thumbnail Navigation */}
          <div className="mt-8 grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {portfolioPages.map((page, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentPage(index);
                  setIsZoomed(false);
                }}
                className={`relative aspect-[3/4] rounded overflow-hidden border-2 transition-all ${
                  currentPage === index
                    ? "border-primary ring-2 ring-primary/50"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <img
                  src={page.src}
                  alt={`Portfolio page ${index + 1}: ${page.title}`}
                  className={`w-full h-full object-cover ${page.rotated ? "-rotate-90" : ""}`}
                  loading="lazy"
                />
                <span className="absolute bottom-0 left-0 right-0 bg-background/80 text-[10px] text-center py-0.5">
                  {index + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-16">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
            onClick={() => setIsFullscreen(false)}
          >
            <X className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10"
            onClick={goToPrevious}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10"
            onClick={goToNext}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
          <PortfolioPageImage
            src={currentPageData.src}
            alt={`Portfolio page ${currentPage + 1}: ${currentPageData.title}`}
            rotated={!!currentPageData.rotated}
            zoomed={false}
            onToggleZoom={() => {}}
            className="w-full h-full cursor-default"
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
            Page {currentPage + 1} of {portfolioPages.length} —{" "}
            {currentPageData.title}
          </div>
        </div>
      )}
    </div>
  );
};

export default Portfolio;
