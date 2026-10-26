"use client";

import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId, type ReactNode } from "react";
import { restrictToVerticalAxis } from "@/components/projects/dndModifiers";

export type Handle = { ref: (el: HTMLElement | null) => void; props: Record<string, unknown>; dragging: boolean };

/** A list you reorder by dragging (or with the keyboard); `render` gets the drag handle to attach. */
export function SortableList<T extends { id: string }>({ items, onMove, render, className }: { items: T[]; onMove: (next: T[]) => void; render: (item: T, index: number, handle: Handle) => ReactNode; className?: string }) {
  const id = useId();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((x) => x.id === active.id);
    const to = items.findIndex((x) => x.id === over.id);
    if (from >= 0 && to >= 0) onMove(arrayMove(items, from, to));
  };
  return (
    <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
      <SortableContext items={items.map((x) => x.id)} strategy={verticalListSortingStrategy}>
        <ol className={className}>
          {items.map((item, i) => (
            <Row key={item.id} id={item.id}>
              {(handle) => render(item, i, handle)}
            </Row>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function Row({ id, children }: { id: string; children: (h: Handle) => ReactNode }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 5 : undefined, position: "relative" }}>
      {children({ ref: setActivatorNodeRef, props: { ...attributes, ...listeners }, dragging: isDragging })}
    </li>
  );
}
