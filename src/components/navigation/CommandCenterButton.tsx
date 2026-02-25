import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

interface CommandCenterButtonProps {
  className?: string;
}

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export function CommandCenterButton({ className }: CommandCenterButtonProps) {
  const { state, setOpen, isMobile, setOpenMobile } = useSidebar();
  const [corner, setCorner] = useState<Corner>(() => {
    return (localStorage.getItem("command-center-position") as Corner) || "top-left";
  });
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Determine if sidebar is open based on device type
  const isOpen = isMobile ? state === "expanded" : state === "expanded";

  const toggleSidebar = () => {
    if (isDragging) return;
    if (isMobile) {
      setOpenMobile(!isOpen);
    } else {
      setOpen(!isOpen);
    }
  };

  // Keyboard support for ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        if (isMobile) setOpenMobile(false);
        else setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isMobile, setOpen, setOpenMobile]);

  const handleDragEnd = (event: any, info: any) => {
    setIsDragging(false);
    const { point } = info;
    const { innerWidth, innerHeight } = window;
    
    // Determine closest corner
    const isLeft = point.x < innerWidth / 2;
    const isTop = point.y < innerHeight / 2;
    
    let newCorner: Corner = "top-left";
    if (isLeft && isTop) newCorner = "top-left";
    else if (!isLeft && isTop) newCorner = "top-right";
    else if (isLeft && !isTop) newCorner = "bottom-left";
    else if (!isLeft && !isTop) newCorner = "bottom-right";
    
    setCorner(newCorner);
    localStorage.setItem("command-center-position", newCorner);
  };

  // Memoize position to prevent unnecessary re-renders or jumps
  const position = getCornerCoordinates(corner);

  return (
    <>
      {/* Invisible constraints container */}
      <div ref={constraintsRef} className="fixed inset-4 pointer-events-none z-[999]" />
      
      <motion.button
        drag
        dragMomentum={false}
        dragConstraints={constraintsRef}
        dragElastic={0.1}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        initial={false}
        animate={{ 
          scale: isHovered && !isDragging ? 1.1 : 1, 
          opacity: 1,
          rotate: isHovered && !isDragging ? 5 : 0,
          x: 0, 
          y: 0,
          ...position
        }}
        whileTap={{ scale: 0.95 }}
        transition={{ 
          type: "spring", 
          stiffness: 400, 
          damping: 25,
        }}
        onClick={toggleSidebar}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "fixed z-[1000] flex items-center justify-center w-10 h-10 rounded-lg shadow-lg cursor-grab active:cursor-grabbing",
          "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
          "hover:shadow-xl hover:shadow-primary/20 transition-shadow duration-300",
          className
        )}
        style={{ touchAction: "none" }} // Important for drag on mobile
        aria-label={isOpen ? "Close Menu" : "Open Menu"}
        aria-expanded={isOpen}
        aria-controls="app-sidebar"
      >
        <div className="relative w-6 h-6 pointer-events-none">
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <X className="w-6 h-6 drop-shadow-md" />
              </motion.div>
            ) : (
              <motion.div
                key="menu"
                initial={{ opacity: 0, rotate: 90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: -90 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                {/* Custom 3D Hamburger Icon */}
                <div className="flex flex-col gap-[5px] items-center justify-center w-full h-full p-0.5">
                  <span className="w-5 h-[3px] bg-current rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.3)] block transform translate-z-1" />
                  <span className="w-5 h-[3px] bg-current rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.3)] block transform translate-z-1" />
                  <span className="w-5 h-[3px] bg-current rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.3)] block transform translate-z-1" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Pulse animation for attention on load (only if not dragged yet) */}
        {!isDragging && (
          <span className="absolute -inset-1 rounded-lg bg-primary/30 animate-ping opacity-75 pointer-events-none" style={{ animationDuration: '3s' }} />
        )}
      </motion.button>
    </>
  );
}

function getCornerCoordinates(corner: Corner) {
  // We use fixed positioning with top/left/right/bottom, but for Framer Motion 'animate' prop
  // it's cleaner to animate x/y or top/left if we want smooth layout transitions.
  // However, mixing drag with layout animations can be tricky.
  // A robust way is to rely on 'layout' prop and changing classes, OR explicit x/y.
  // Let's use standard fixed positioning values.
  
  switch (corner) {
    case "top-left": return { top: 16, left: 16, right: "auto", bottom: "auto", x: 0, y: 0 };
    case "top-right": return { top: 16, right: 16, left: "auto", bottom: "auto", x: 0, y: 0 };
    case "bottom-left": return { bottom: 16, left: 16, top: "auto", right: "auto", x: 0, y: 0 };
    case "bottom-right": return { bottom: 16, right: 16, top: "auto", left: "auto", x: 0, y: 0 };
  }
}
