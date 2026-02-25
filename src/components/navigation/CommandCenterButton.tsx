import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

interface CommandCenterButtonProps {
  className?: string;
}

export function CommandCenterButton({ className }: CommandCenterButtonProps) {
  const { state, setOpen, isMobile, setOpenMobile } = useSidebar();
  const [position, setPosition] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">("top-left");
  const [isHovered, setIsHovered] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Determine if sidebar is open based on device type
  const isOpen = isMobile ? state === "expanded" : state === "expanded";

  const toggleSidebar = () => {
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

  return (
    <motion.button
      ref={buttonRef}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ 
        scale: isHovered ? 1.1 : 1, 
        opacity: 1,
        rotate: isHovered ? 5 : 0
      }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      onClick={toggleSidebar}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "fixed z-[1000] flex items-center justify-center w-10 h-10 rounded-lg shadow-lg cursor-pointer",
        "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
        "hover:shadow-xl hover:shadow-primary/20 transition-shadow duration-300",
        // Position logic
        "top-4 left-4", // Default position
        className
      )}
      aria-label={isOpen ? "Close Menu" : "Open Menu"}
      aria-expanded={isOpen}
      aria-controls="app-sidebar"
    >
      <div className="relative w-6 h-6">
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
      
      {/* Pulse animation for attention on load */}
      <span className="absolute -inset-1 rounded-lg bg-primary/30 animate-ping opacity-75 pointer-events-none" style={{ animationDuration: '3s' }} />
    </motion.button>
  );
}
