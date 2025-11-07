import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ReactNode } from "react";

interface DraggableProps {
  id: string;
  children: ReactNode;
}

export function Draggable({ id, children }: DraggableProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? "none" : "transform 200ms ease",
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...listeners} 
      {...attributes}
      className={`${
        isDragging 
          ? "opacity-40 scale-105 rotate-2 z-50" 
          : "opacity-100 scale-100 rotate-0"
      } transition-all duration-200 cursor-grab active:cursor-grabbing`}
    >
      {children}
    </div>
  );
}
