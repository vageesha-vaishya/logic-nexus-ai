import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquare, Phone } from 'lucide-react';

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-3 gap-3">
      <Button
        onClick={() => navigate('/dashboard/contacts/new')}
        className="h-16 flex flex-col items-center justify-center gap-1"
      >
        <Plus className="h-5 w-5" />
        <span className="text-xs">Create Lead</span>
      </Button>
      <Button
        variant="outline"
        className="h-16 flex flex-col items-center justify-center gap-1"
        onClick={() => console.log('Log Call - Feature coming soon')}
      >
        <Phone className="h-5 w-5" />
        <span className="text-xs">Log Call</span>
      </Button>
      <Button
        variant="outline"
        className="h-16 flex flex-col items-center justify-center gap-1"
        onClick={() => console.log('Send Email - Feature coming soon')}
      >
        <MessageSquare className="h-5 w-5" />
        <span className="text-xs">Send Email</span>
      </Button>
    </div>
  );
}
