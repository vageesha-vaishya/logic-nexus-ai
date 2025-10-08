import { useState, useEffect } from 'react';
import { Plus, Search, User, Mail, Phone, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import TitleStrip from '@/components/ui/title-strip';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow, SortableHead } from '@/components/ui/table';
import { useSort } from '@/hooks/useSort';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  account_id: string | null;
  accounts: { name: string } | null;
  created_at: string;
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const { supabase } = useCRM();

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*, accounts(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      toast.error('Failed to load contacts');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    `${contact.first_name} ${contact.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { sorted: sortedContacts, sortField, sortDirection, onSort } = useSort<any>(filteredContacts, {
    accessors: {
      name: (c) => `${c.first_name} ${c.last_name}`,
      title: (c) => c.title ?? '',
      account: (c) => c.accounts?.name ?? '',
      email: (c) => c.email ?? '',
      phone: (c) => c.phone ?? '',
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">Manage your business contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle value={viewMode} onChange={setViewMode} />
          <Button asChild>
            <Link to="/dashboard/contacts/new">
              <Plus className="mr-2 h-4 w-4" />
              New Contact
            </Link>
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading contacts...</p>
        </div>
      ) : filteredContacts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No contacts found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try adjusting your search' : 'Get started by adding your first contact'}
            </p>
            {!searchQuery && (
              <Button asChild>
                <Link to="/dashboard/contacts/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Contact
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        viewMode === 'list' ? (
          <Card>
            <CardHeader className="pb-2">
              <TitleStrip label="All Contacts" />
            </CardHeader>
            <CardContent>
              <Table>
              <TableHeader className="bg-[hsl(var(--title-strip))] [&_th]:text-white [&_th]:font-semibold [&_th]:text-xs [&_th]:px-3 [&_th]:py-2 [&_th]:border-l [&_th]:border-white/60">
                <TableRow className="border-b-2" style={{ borderBottomColor: 'hsl(var(--title-strip))' }}>
                  <SortableHead field="name" activeField={sortField} direction={sortDirection} onSort={onSort}>Name</SortableHead>
                  <SortableHead field="title" activeField={sortField} direction={sortDirection} onSort={onSort}>Title</SortableHead>
                  <SortableHead field="account" activeField={sortField} direction={sortDirection} onSort={onSort}>Account</SortableHead>
                  <SortableHead field="email" activeField={sortField} direction={sortDirection} onSort={onSort}>Email</SortableHead>
                  <SortableHead field="phone" activeField={sortField} direction={sortDirection} onSort={onSort}>Phone</SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedContacts.map((contact) => (
                    <TableRow key={contact.id} className="cursor-pointer" onClick={() => {}}>
                      <TableCell>
                        <Link className="font-medium hover:underline" to={`/dashboard/contacts/${contact.id}`}>
                          {contact.first_name} {contact.last_name}
                        </Link>
                      </TableCell>
                      <TableCell>{contact.title || '-'}</TableCell>
                      <TableCell>{contact.accounts?.name || '-'}</TableCell>
                      <TableCell>{contact.email || '-'}</TableCell>
                      <TableCell>{contact.phone || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="space-y-2">
            <TitleStrip label="All Contacts" />
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredContacts.map((contact) => (
                <Link key={contact.id} to={`/dashboard/contacts/${contact.id}`}>
                  <Card className="hover:shadow transition-shadow cursor-pointer">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base truncate">
                        {contact.first_name} {contact.last_name}
                      </CardTitle>
                      {contact.title && (
                        <CardDescription className="truncate">{contact.title}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {contact.accounts?.name || '-'}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <TitleStrip label="All Contacts" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredContacts.map((contact) => (
                <Link key={contact.id} to={`/dashboard/contacts/${contact.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <User className="h-10 w-10 text-primary" />
                      </div>
                      <CardTitle className="mt-4">
                        {contact.first_name} {contact.last_name}
                      </CardTitle>
                      {contact.title && (
                        <CardDescription>{contact.title}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {contact.accounts && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          <span>{contact.accounts.name}</span>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <span>{contact.phone}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )
      )}
    </div>
    </DashboardLayout>
  );
}
