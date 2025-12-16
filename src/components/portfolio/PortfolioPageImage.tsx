import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  rotated?: boolean;
  zoomed: boolean;
  onToggleZoom: () => void;
  className?: string;
};

export function PortfolioPageImage({
  src,
  alt,
  rotated = false,
  zoomed,
  onToggleZoom,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [baseScale, setBaseScale] = useState(1);

  const zoomFactor = useMemo(() => (zoomed ? 1.5 : 1), [zoomed]);

  const recompute = useCallback(() => {
    if (!rotated) return;
    if (!containerRef.current || !natural) return;

    const rect = containerRef.current.getBoundingClientRect();
    const rotatedW = natural.h;
    const rotatedH = natural.w;

    const s = Math.min(rect.width / rotatedW, rect.height / rotatedH);
    setBaseScale(Number.isFinite(s) && s > 0 ? s : 1);
  }, [natural, rotated]);

  useEffect(() => {
    recompute();
  }, [recompute]);

  useEffect(() => {
    if (!rotated) return;
    if (!containerRef.current) return;

    const ro = new ResizeObserver(() => recompute());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [recompute, rotated]);

  if (!rotated) {
    return (
      <div
        className={cn(
          "relative bg-card border rounded-lg overflow-hidden shadow-lg",
          zoomed ? "cursor-zoom-out" : "cursor-zoom-in",
          className
        )}
        onClick={onToggleZoom}
      >
        <img
          src={src}
          alt={alt}
          className={cn(
            "w-full h-auto transition-transform duration-300",
            zoomed ? "scale-150" : "scale-100"
          )}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative bg-card border rounded-lg overflow-hidden shadow-lg aspect-[3/4]",
        zoomed ? "cursor-zoom-out" : "cursor-zoom-in",
        className
      )}
      onClick={onToggleZoom}
    >
      <img
        src={src}
        alt={alt}
        onLoad={(e) => {
          const img = e.currentTarget;
          setNatural({ w: img.naturalWidth, h: img.naturalHeight });
        }}
        className="absolute left-1/2 top-1/2 max-w-none max-h-none select-none"
        style={{
          transform: `translate(-50%, -50%) rotate(-90deg) scale(${baseScale * zoomFactor})`,
          transformOrigin: "center",
          transition: "transform 300ms",
        }}
      />
    </div>
  );
}
