import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { ScopedDataAccess, DataAccessContext } from '@/lib/db/access';
import { Skeleton } from '@/components/ui/skeleton';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  title: string | null;
}

export function ContactsWidget() {
  const { supabase, context } = useCRM();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContacts = async () => {
      if (!context?.userId) return;
      
      try {
        const dao = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
        const { data, error } = await dao
          .from('contacts')
          .select('id, first_name, last_name, email, title')
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        setContacts(data as Contact[]);
      } catch (error) {
        console.error('Failed to load contacts widget:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [context?.userId]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Recent Contacts</CardTitle>
        <User className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No recent contacts
          </div>
        ) : (
          <div className="space-y-4">
            {contacts.map((contact) => (
              <div key={contact.id} className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {contact.first_name} {contact.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {contact.title || contact.email || 'No Details'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <div className="p-4 pt-0 mt-auto border-t">
        <Button variant="ghost" className="w-full text-xs" asChild>
          <Link to="/dashboard/contacts">
            View All Contacts <ArrowRight className="ml-2 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
