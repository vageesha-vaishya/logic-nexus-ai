import { useEffect, useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuoteContext } from './QuoteContext';
import { FileText, Building2, User, Briefcase, Info, X, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function QuoteHeader() {
  const { control, setValue } = useFormContext();
  const { opportunities, accounts, contacts, isLoadingOpportunities } = useQuoteContext();
  const [open, setOpen] = useState(false);

  const opportunityId = useWatch({ control, name: 'opportunity_id' });
  const accountId = useWatch({ control, name: 'account_id' });
  const contactId = useWatch({ control, name: 'contact_id' });

  // Filter contacts based on selected account
  const filteredContacts = useMemo(() => {
    if (!accountId) return contacts;
    return contacts.filter((c: any) => String(c.account_id) === accountId);
  }, [contacts, accountId]);

  // Filter opportunities based on selected account
  const filteredOpportunities = useMemo(() => {
    if (!accountId) return opportunities;
    return opportunities.filter((o: any) => !o.account_id || String(o.account_id) === accountId);
  }, [opportunities, accountId]);

  // Auto-populate Account and Contact when Opportunity is selected
  useEffect(() => {
    if (opportunityId) {
      const selectedOpp = opportunities.find((o: any) => String(o.id) === opportunityId);
      if (selectedOpp) {
        // Only set if not already set or if different
        if (selectedOpp.account_id && String(selectedOpp.account_id) !== accountId) {
          setValue('account_id', String(selectedOpp.account_id), { shouldValidate: true });
        }
        if (selectedOpp.contact_id && String(selectedOpp.contact_id) !== contactId) {
          setValue('contact_id', String(selectedOpp.contact_id), { shouldValidate: true });
        }
      }
    }
  }, [opportunityId, opportunities, setValue, accountId, contactId]);

  // Auto-populate Account when Contact is selected (if not already selected)
  useEffect(() => {
    if (contactId && !accountId) {
      const selectedContact = contacts.find((c: any) => String(c.id) === contactId);
      if (selectedContact && selectedContact.account_id) {
        setValue('account_id', String(selectedContact.account_id), { shouldValidate: true });
      }
    }
  }, [contactId, accountId, contacts, setValue]);

  return (
    <Card className="shadow-sm border-t-4 border-t-primary">
      <CardHeader>
        <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-full">
                <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
                <CardTitle className="text-xl">Quote Details</CardTitle>
                <CardDescription>General information and customer context</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        {/* Primary Info Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-8">
                <FormField
                    control={control}
                    name="title"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Quote Title</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g. Q4 Logistics Proposal for Acme Corp" className="text-lg font-medium" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <div className="md:col-span-4">
                 <FormField
                    control={control}
                    name="status"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
        </div>

        <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                 <Info className="h-4 w-4 text-muted-foreground" />
                 Description
              </FormLabel>
              <FormControl>
                <Textarea 
                    placeholder="Add detailed scope of work or internal notes..." 
                    className="resize-none min-h-[80px]" 
                    {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator className="my-2" />

        {/* CRM Context Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={control}
            name="opportunity_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    Opportunity
                </FormLabel>
                <div className="flex gap-2">
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={open}
                          className={cn(
                            "w-full justify-between bg-muted/5 font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? filteredOpportunities.find((opp: any) => String(opp.id) === field.value)?.name || "Opportunity not found"
                            : "Link Opportunity"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search opportunities..." />
                        <CommandList>
                          {isLoadingOpportunities ? (
                            <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading opportunities...
                            </div>
                          ) : (
                            <>
                              <CommandEmpty>No opportunity found.</CommandEmpty>
                              <CommandGroup>
                                {filteredOpportunities.map((opp: any) => (
                                  <CommandItem
                                    key={opp.id}
                                    value={opp.name}
                                    onSelect={() => {
                                      setValue('opportunity_id', String(opp.id), { shouldValidate: true });
                                      setOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === String(opp.id) ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                        <span>{opp.name}</span>
                                        {opp.stage && (
                                            <span className="text-xs text-muted-foreground">Stage: {opp.stage}</span>
                                        )}
                                    </div>
                                    {opp.amount && (
                                        <span className="ml-auto text-sm font-medium">
                                            ${opp.amount.toLocaleString()}
                                        </span>
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {field.value && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => setValue('opportunity_id', '', { shouldValidate: true })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="account_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Account
                </FormLabel>
                <div className="flex gap-2">
                  <Select onValueChange={(val) => {
                      field.onChange(val);
                  }} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-muted/5">
                        <SelectValue placeholder="Select Account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map((acc: any) => (
                        <SelectItem key={acc.id} value={String(acc.id)}>
                          {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {field.value && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => {
                          setValue('account_id', '', { shouldValidate: true });
                          setValue('contact_id', '', { shouldValidate: true }); // Clear contact when account is cleared
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="contact_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Contact
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!accountId && filteredContacts.length === 0}>
                  <FormControl>
                    <SelectTrigger className="bg-muted/5">
                      <SelectValue placeholder={accountId ? "Select Contact" : "Select Account First"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {filteredContacts.map((con: any) => (
                      <SelectItem key={con.id} value={String(con.id)}>
                        {con.first_name} {con.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
