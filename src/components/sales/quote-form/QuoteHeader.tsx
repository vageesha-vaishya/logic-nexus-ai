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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function QuoteHeader() {
  const { control, setValue, register, watch } = useFormContext();
  const { opportunities, accounts, contacts, isLoadingOpportunities } = useQuoteContext();
  const [open, setOpen] = useState(false);

  const opportunityId = useWatch({ control, name: 'opportunity_id' });
  const accountId = useWatch({ control, name: 'account_id' });
  const contactId = useWatch({ control, name: 'contact_id' });
  
  // Standalone Mode State
  const [isStandalone, setIsStandalone] = useState(false);

  // Initialize Standalone state based on existing data
  useEffect(() => {
    // Only set if explicitly not set yet (to avoid overriding user toggle during session)
    // But logically, if there is an accountId, it is NOT standalone.
    if (accountId || opportunityId) {
        setIsStandalone(false);
    }
  }, []); // Run once on mount

  const handleStandaloneToggle = (checked: boolean) => {
      setIsStandalone(checked);
      if (checked) {
          setValue('account_id', '');
          setValue('opportunity_id', '');
          setValue('contact_id', '');
          // Optional: Initialize billing address for guest info if empty
          const currentBilling = watch('billing_address');
          if (!currentBilling) {
              setValue('billing_address', { company: '', name: '', email: '' });
          }
      }
  };

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

        {/* CRM Context / Standalone Toggle */}
        <div className="flex items-center justify-between mb-4 bg-muted/20 p-3 rounded-md border border-dashed">
            <div className="flex items-center space-x-2">
                <Switch id="standalone-mode" checked={isStandalone} onCheckedChange={handleStandaloneToggle} />
                <Label htmlFor="standalone-mode" className="font-medium cursor-pointer">
                    Standalone Quote (No CRM Link)
                </Label>
            </div>
            {isStandalone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Info className="w-3 h-3"/> Quote will be created without linking to Account/Opportunity</span>}
        </div>

        {isStandalone ? (
             /* Guest Fields */
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2">
                 <div className="space-y-2">
                    <Label>Guest Company / Name</Label>
                    <Input placeholder="Enter customer name..." {...register('billing_address.company')} />
                 </div>
                 <div className="space-y-2">
                    <Label>Contact Name</Label>
                    <Input placeholder="Enter contact person..." {...register('billing_address.name')} />
                 </div>
                 <div className="space-y-2">
                    <Label>Email</Label>
                    <Input placeholder="customer@example.com" {...register('billing_address.email')} />
                 </div>
             </div>
        ) : (
        /* CRM Context Row */
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
                        {String(con.first_name || '')} {String(con.last_name || '')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        )}
      </CardContent>
    </Card>
  );
}
