import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { H1, H2 } from '@/components/ui/Heading';
import { logger } from "@/lib/logger";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    logger.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <H1 className="mb-4">404</H1>
        <H2 className="mb-4">Oops! Page not found</H2>
        <a href="/" className="text-blue-500 underline hover:text-blue-700">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
