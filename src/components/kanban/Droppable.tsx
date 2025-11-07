import { useDroppable } from "@dnd-kit/core";
import { ReactNode } from "react";

interface DroppableProps {
  id: string;
  children: ReactNode;
}

export function Droppable({ id, children }: DroppableProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`transition-all duration-300 ${
        isOver 
          ? "ring-2 ring-primary ring-offset-2 bg-primary/5 scale-[1.02]" 
          : ""
      }`}
    >
      {children}
    </div>
  );
}
