import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
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
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="touch-none cursor-grab select-none rounded-md border bg-background px-3 py-1.5 text-sm shadow-sm active:cursor-grabbing"
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
      className={`rounded-lg border p-3 transition-colors ${
        isOver ? "border-primary bg-primary/10" : muted ? "bg-muted/50" : "bg-muted/30"
      }`}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="flex min-h-[44px] flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** Drag-and-drop sorting question. Payload contract is identical to the
 *  tap-to-assign "categorize" renderer: answer text "item → cat; …" plus
 *  raw buckets Record<string, string>. Remount per question via key. */
export default function DragDropSort({ items, categories, onDone }: DragDropSortProps) {
  const [placement, setPlacement] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(items.map((_, i) => [`item-${i}`, null])),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const labelOf = (id: string) => items[Number(id.replace("item-", ""))] ?? id;

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
      const cat = categories[Number(overId.replace("col-", ""))];
      if (cat) setPlacement((prev) => ({ ...prev, [itemId]: cat }));
    }
  }

  const unplaced = Object.keys(placement).filter((id) => placement[id] == null);
  const complete = unplaced.length === 0 && items.length > 0;

  function handleContinue() {
    const buckets: Record<string, string> = {};
    items.forEach((label, i) => {
      buckets[label] = placement[`item-${i}`] ?? "";
    });
    onDone(items.map((label) => `${label} → ${buckets[label]}`).join("; "), buckets);
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
              <DropZone key={cat} id={`col-${j}`} title={cat}>
                {inCol.map((id) => (
                  <Chip key={id} id={id} label={labelOf(id)} />
                ))}
              </DropZone>
            );
          })}
        </div>
      </DndContext>
      <Button disabled={!complete} onClick={handleContinue}>
        Continue
      </Button>
    </div>
  );
}
