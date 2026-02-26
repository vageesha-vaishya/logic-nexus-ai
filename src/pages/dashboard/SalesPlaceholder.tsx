import React from 'react';
import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SalesPlaceholder() {
  const location = useLocation();
  const path = location.pathname.split('/').pop();
  const title = path ? path.charAt(0).toUpperCase() + path.slice(1).replace('-', ' ') : 'Module';

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center p-8">
      <div className="bg-gray-100 p-6 rounded-full mb-6">
        <Construction className="h-12 w-12 text-gray-400" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title} Module</h1>
      <p className="text-gray-500 max-w-md mb-8">
        This module is currently under development. The full feature set for {title} will be available in the next release.
      </p>
      <Button variant="outline" onClick={() => window.history.back()}>
        Go Back
      </Button>
    </div>
  );
}
