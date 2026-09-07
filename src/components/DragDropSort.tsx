import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";

interface DragDropSortProps {
  items: string[];
  categories: string[];
  onDone: (answerText: string, raw: Record<string, string>) => void;
}

const TRAY_ID = "tray";

function Chip({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      tabIndex={0}
      role="button"
      aria-label={`${label} — press Space to pick up, arrow keys to move, Space to drop, Escape to cancel`}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="touch-none max-w-full cursor-grab select-none break-words rounded-md border bg-background px-3 py-1.5 text-sm shadow-sm active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {label}
    </div>
  );
}

function DropZone({
  id,
  title,
  children,
  muted,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-w-0 rounded-lg border p-3 transition-colors ${
        isOver ? "border-primary bg-primary/10" : muted ? "bg-muted/50" : "bg-muted/30"
      }`}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="flex min-h-[44px] min-w-0 flex-wrap gap-2 overflow-hidden">{children}</div>
    </div>
  );
}

/** Drag-and-drop sorting question. Payload contract is identical to the
 *  tap-to-assign "categorize" renderer: answer text "item → cat; …" plus
 *  raw buckets Record<string, string>. Remount per question via key.
 *  Requires unique non-empty items/categories (enforced by the parent). */
export default function DragDropSort({ items, categories, onDone }: DragDropSortProps) {
  const [placement, setPlacement] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(items.map((_, i) => [`item-${i}`, null])),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const labelOf = (id: string) => items[Number(id.replace("item-", ""))] ?? id;
  const droppableLabel = (id: string) => {
    if (id === TRAY_ID) return "the tray";
    if (id.startsWith("col-")) return categories[Number(id.replace("col-", ""))] ?? id;
    return id;
  };

  const announcements = useMemo(
    () => ({
      onDragStart: ({ active }: { active: { id: string | number } }) =>
        `Picked up ${labelOf(String(active.id))}.`,
      onDragOver: ({ active, over }: { active: { id: string | number }; over?: { id: string | number } | null }) =>
        over
          ? `${labelOf(String(active.id))} over ${droppableLabel(String(over.id))}.`
          : `${labelOf(String(active.id))} not over a column.`,
      onDragEnd: ({ active, over }: { active: { id: string | number }; over?: { id: string | number } | null }) =>
        over
          ? `Dropped ${labelOf(String(active.id))} in ${droppableLabel(String(over.id))}.`
          : `Dropped ${labelOf(String(active.id))} outside the columns; returned to its place.`,
      onDragCancel: ({ active }: { active: { id: string | number } }) =>
        `Cancelled moving ${labelOf(String(active.id))}; returned to its place.`,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.join(" | "), categories.join(" | ")],
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const itemId = String(active.id);
    if (!itemId.startsWith("item-")) return;
    if (over.id === TRAY_ID) {
      setPlacement((prev) => ({ ...prev, [itemId]: null }));
      return;
    }
    const overId = String(over.id);
    if (overId.startsWith("col-")) {
      const idx = Number(overId.replace("col-", ""));
      const cat = categories[idx];
      if (idx >= 0 && idx < categories.length && typeof cat === "string") {
        setPlacement((prev) => ({ ...prev, [itemId]: cat }));
      }
    }
  }

  const unplaced = Object.keys(placement).filter((id) => placement[id] == null);
  const complete = unplaced.length === 0 && items.length > 0;
  const placedCount = items.length - unplaced.length;

  function handleContinue() {
    const buckets: Record<string, string> = {};
    items.forEach((label, i) => {
      buckets[label] = placement[`item-${i}`] ?? "";
    });
    onDone(items.map((label) => `${label} → ${buckets[label]}`).join("; "), buckets);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Drag with mouse or touch (hold briefly first), or Tab to a chip, Space to pick up, arrow keys to
        move, Space to drop, Esc to cancel.
      </p>
      <DndContext
        sensors={sensors}
        accessibility={{ announcements }}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          // No state change by design: cancelled drags snap back to source.
        }}
      >
        <DropZone id={TRAY_ID} title="To sort — drag each into a column" muted>
          {unplaced.length === 0 ? (
            <p className="text-sm text-muted-foreground">All sorted! Drag back here to change.</p>
          ) : (
            unplaced.map((id) => <Chip key={id} id={id} label={labelOf(id)} />)
          )}
        </DropZone>
        <div className="grid gap-2 sm:grid-cols-2">
          {categories.map((cat, j) => {
            const inCol = Object.keys(placement).filter((id) => placement[id] === cat);
            return (
              <DropZone key={`${cat}-${j}`} id={`col-${j}`} title={cat}>
                {inCol.map((id) => (
                  <Chip key={id} id={id} label={labelOf(id)} />
                ))}
              </DropZone>
            );
          })}
        </div>
      </DndContext>
      <Button disabled={!complete} onClick={handleContinue}>
        Continue ({placedCount}/{items.length})
      </Button>
    </div>
  );
}
