import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LeadForm, LeadFormData } from "@/components/crm/LeadForm";
import { useCRM } from "@/hooks/useCRM";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import optionsConfig from "@/config/Options_Transport_Mode.json";
import interestedConfig from "@/config/Interested_Transport_Mode_checker_config.json";
import { cleanEmail, cleanPhone } from "@/lib/data-cleaning";
import { sanitizeLeadDataForInsert, extractEmailAddress, parseTransportOptionsJSON, type TransportOption } from "./email-to-lead-helpers";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface EmailForConversion {
  id: string;
  subject: string;
  from_email: string;
  from_name?: string;
  body_text?: string;
  body_html?: string;
  snippet?: string;
  received_at: string;
}

interface EmailToLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: EmailForConversion;
  onSuccess?: (leadId?: string) => void;
}

export function EmailToLeadDialog({ open, onOpenChange, email, onSuccess }: EmailToLeadDialogProps) {
  const { supabase, context } = useCRM();
  const [suggestedService, setSuggestedService] = useState<string>("");
  const [isSuggestingService, setIsSuggestingService] = useState(false);
  const [transportOptions, setTransportOptions] = useState<TransportOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);

  const parseName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return { first_name: parts[0], last_name: "" };
    }
    return {
      first_name: parts.slice(0, -1).join(" "),
      last_name: parts[parts.length - 1],
    };
  };

  const getBodyText = (email: EmailForConversion) => {
    if (email.body_text) return email.body_text;
    if (email.body_html) {
      const doc = new DOMParser().parseFromString(email.body_html, 'text/html');
      return doc.body.textContent || "";
    }
    return email.snippet || "";
  };

  const extractedEmail = extractEmailAddress(email.from_email);
  const { first_name, last_name } = parseName(email.from_name || email.from_email);

  const initialData: Partial<LeadFormData> & { custom_fields?: any } = {
    first_name,
    last_name: last_name || "Unknown",
    email: extractedEmail || "",
    description: `Created from email: ${email.subject}\n\n${getBodyText(email)}`,
    source: "email",
    status: "new",
    tenant_id: context.tenantId || undefined,
    franchise_id: context.franchiseId || undefined,
    custom_fields: suggestedService ? { service_id: suggestedService } : undefined,
  };

  // 1. Interested Service (Plain Text)
  const fetchInterestedService = async (forceRefresh = false) => {
    if (!email || (!email.subject && !email.body_text && !email.body_html)) return;
    
    const CACHE_KEY = `interested_service_${email.id}`;
    if (!forceRefresh) {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            console.log("Using cached interested service");
            setSuggestedService(cached);
            return;
        }
    }

    setIsSuggestingService(true);
    if (forceRefresh) setSuggestedService("");

    try {
        const subject = email.subject || "";
        const content = getBodyText(email);
        
        let prompt = interestedConfig.system_prompt;
        prompt = prompt.replace("<subject>", subject).replace("<content>", content);

        const requestId = `req_interested_${Date.now()}`;
        const { data, error } = await supabase.functions.invoke('suggest-transport-mode', {
            body: { prompt, requestId },
            headers: { 'x-client-info': 'email-to-lead-interested' }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const text = (data?.text || "").trim();
        console.log(`[InterestedService] Response: ${text}`);
        
        // Simple validation: ensure it's not too long
        if (text && text.length < 100) {
            setSuggestedService(text);
            sessionStorage.setItem(CACHE_KEY, text);
        } else {
            console.warn("[InterestedService] Response too long or empty, ignoring.");
        }

    } catch (err) {
        console.error(`[InterestedService] Error:`, err);
    } finally {
        setIsSuggestingService(false);
    }
  };

  // 2. Recommended Options (JSON)
  const fetchRecommendedOptions = async (forceRefresh = false) => {
    if (!email || (!email.subject && !email.body_text && !email.body_html)) return;

    const CACHE_KEY = `transport_options_${email.id}`;
    if (!forceRefresh) {
        try {
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                    console.log("Using cached transport options");
                    setTransportOptions(parsed);
                    return;
                }
            }
        } catch (e) {
            console.warn("Error reading transport options cache:", e);
        }
    }

    setLoadingOptions(true);
    setSuggestionError(null);
    if (forceRefresh) setTransportOptions([]);

    try {
        const subject = email.subject || "";
        const content = getBodyText(email);
        
        let prompt = optionsConfig.system_prompt;
        prompt = prompt.replace("<subject>", subject).replace("<content>", content);

        const requestId = `req_options_${Date.now()}`;
        const { data, error } = await supabase.functions.invoke('suggest-transport-mode', {
            body: { prompt, requestId, responseFormat: 'json' },
            headers: { 'x-client-info': 'email-to-lead-options' }
        });

        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);

        const buildFallback = (): TransportOption[] => {
          const s = `${subject} ${content}`.toLowerCase();
          const isUrgent = /urgent|asap|immediate|today|tomorrow/.test(s);
          const isInternational = /port|ocean|sea|vessel|incoterms|bl|lcl|fcl/.test(s);
          const isAir = /air|flight|awb|airway bill|airport/.test(s);
          const base: TransportOption[] = [];
          if (isUrgent || isAir) {
            base.push({
              seqNo: "1",
              mode: "Air Freight",
              price: "₹35,000 – ₹65,000",
              transitTime: "1 – 3 Days",
              bestFor: "Speed & Urgency",
              interchangePoints: "Airport-to-Airport (Door optional)",
              logic: "Air freight minimizes transit time for urgent consignments."
            });
          }
          if (isInternational) {
            base.push({
              seqNo: String(base.length + 1),
              mode: "Ocean Freight (LCL)",
              price: "₹12,000 – ₹25,000",
              transitTime: "7 – 21 Days",
              bestFor: "Cost & Reliability",
              interchangePoints: "CY → CFS → CY",
              logic: "Ocean LCL offers economical shipping for international moves."
            });
          }
          base.push({
            seqNo: String(base.length + 1),
            mode: "Road Freight",
            price: "₹8,000 – ₹15,000",
            transitTime: "1 – 3 Days",
            bestFor: "Domestic & Door-to-Door",
            interchangePoints: "None (Direct)",
            logic: "FTL/Part-load road shipment provides simplicity and coverage."
          });
          return base;
        };

        let options: TransportOption[] | null = null;
        const textCandidate = typeof (data as any)?.text === 'string' ? String((data as any).text).trim() : '';
        if (textCandidate) {
          options = parseTransportOptionsJSON(textCandidate);
        } else if (Array.isArray((data as any)?.options)) {
          options = (data as any).options as TransportOption[];
        } else if (typeof data === 'string') {
          options = parseTransportOptionsJSON(String(data));
        } else if (data && typeof data === 'object') {
          try {
            const serialized = JSON.stringify(data);
            options = parseTransportOptionsJSON(serialized);
          } catch {
            options = null;
          }
        }

        if (!options || options.length === 0) {
          options = buildFallback();
        }
        
        setTransportOptions(options);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(options));

    } catch (err) {
        console.error(`[RecommendedOptions] Error:`, err);
        try {
          const subject = email.subject || "";
          const content = getBodyText(email);
          const fallbackOptions: TransportOption[] = [
            {
              seqNo: "1",
              mode: "Road Freight",
              price: "₹8,000 – ₹15,000",
              transitTime: "1 – 3 Days",
              bestFor: "Domestic & Door-to-Door",
              interchangePoints: "None (Direct)",
              logic: "Default recommendation when AI is unavailable."
            }
          ];
          setTransportOptions(fallbackOptions);
          setSuggestionError(null);
          sessionStorage.setItem(`transport_options_${email.id}`, JSON.stringify(fallbackOptions));
        } catch {
          setSuggestionError("Failed to load detailed recommendations.");
        }
    } finally {
        setLoadingOptions(false);
    }
  };

  useEffect(() => {
    setSuggestedService("");
    setTransportOptions([]);
    setIsSuggestingService(false);
    setLoadingOptions(false);
    setSuggestionError(null);
    setSelectedOptionIndex(null);
  }, [email.id, open]);

  useEffect(() => {
    if (open) {
        // Run both services in parallel
        fetchInterestedService();
        fetchRecommendedOptions();
    }
  }, [open, email.id]);

  useEffect(() => {
    if (transportOptions.length > 0) {
      setSelectedOptionIndex(0);
    } else {
      setSelectedOptionIndex(null);
    }
  }, [transportOptions]);

  const handleSubmit = async (data: LeadFormData) => {
    try {
      if (data.email) {
        const normalizedEmail = cleanEmail(data.email).value || data.email.trim().toLowerCase();
        let query = supabase
          .from("leads")
          .select("id")
          .eq("email", normalizedEmail);
        if (context.tenantId) query = query.eq("tenant_id", context.tenantId);
        if (context.franchiseId) query = query.eq("franchise_id", context.franchiseId);
        const { data: existingLead } = await query.maybeSingle();

        if (existingLead) {
          toast.info("Lead already exists with this email");
          onOpenChange(false);
          onSuccess?.(existingLead.id);
          return;
        }
      }

      if (data.phone) {
        const normalizedPhone = cleanPhone(data.phone).value || data.phone.trim();
        let query = supabase
          .from("leads")
          .select("id")
          .eq("phone", normalizedPhone);
        if (context.tenantId) query = query.eq("tenant_id", context.tenantId);
        if (context.franchiseId) query = query.eq("franchise_id", context.franchiseId);
        const { data: existingByPhone } = await query.maybeSingle();

        if (existingByPhone) {
          toast.info("Lead already exists with this phone");
          onOpenChange(false);
          onSuccess?.(existingByPhone.id);
          return;
        }
      }

      const { service_id, attachments } = data;
      const attachmentNames = Array.isArray(attachments)
        ? attachments.map((f: File) => f.name)
        : [];
      const customFields: Record<string, unknown> = {
        service_id: service_id || undefined,
        ...(attachmentNames.length ? { attachments_names: attachmentNames } : {}),
      };

      const { data: lead, error } = await supabase
        .from("leads")
        .insert({
          ...sanitizeLeadDataForInsert(data),
          email: data.email ? (cleanEmail(data.email).value || data.email.trim().toLowerCase()) : null,
          phone: data.phone ? (cleanPhone(data.phone).value || data.phone.trim()) : null,
          tenant_id: data.tenant_id || context.tenantId,
          franchise_id: data.franchise_id || context.franchiseId,
          custom_fields: Object.keys(customFields).filter((k) => customFields[k] !== undefined).length
            ? Object.fromEntries(
                Object.entries(customFields).filter(([, v]) => v !== undefined),
              )
            : null,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Lead created successfully");
      
      try {
        await supabase
          .from("lead_activities")
          .insert({
            lead_id: lead.id,
            type: "email_converted",
            metadata: {
              email_id: email.id,
              subject: email.subject,
              from_email: email.from_email,
              received_at: email.received_at,
            },
            tenant_id: context.tenantId || null,
          });
      } catch (err) {
        console.error("Error recording lead email conversion activity", err);
      }
      
      onOpenChange(false);
      onSuccess?.(lead.id);
    } catch (error: unknown) {
      let message = "Failed to create lead";
      if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
        message = (error as { message: string }).message || message;
      }
      console.error("Error creating lead from email", error);
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert Email to Lead</DialogTitle>
          <DialogDescription>
            Review the email details and confirm the lead information below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
            {/* Recommended Options Section */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            Recommended Options
                            {loadingOptions && <Loader2 className="h-4 w-4 animate-spin" />}
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => fetchRecommendedOptions(true)} 
                            disabled={loadingOptions}
                            title="Regenerate Recommendations"
                        >
                            <RefreshCw className={`h-4 w-4 ${loadingOptions ? 'animate-spin' : ''}`} />
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {suggestionError ? (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{suggestionError}</AlertDescription>
                        </Alert>
                    ) : loadingOptions ? (
                        <div className="flex items-center justify-center py-8 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" />
                            Analyzing transport options...
                        </div>
                    ) : transportOptions.length > 0 ? (
                        <ScrollArea className="h-[300px] w-full rounded-md border">
                            <div className="min-w-[800px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[60px]">Seq</TableHead>
                                        <TableHead className="w-[200px]">Transport Mode</TableHead>
                                        <TableHead className="w-[120px]">Est. Price</TableHead>
                                        <TableHead className="w-[120px]">Transit Time</TableHead>
                                        <TableHead className="w-[150px]">Best For</TableHead>
                                        <TableHead className="w-[200px]">Interchange Points</TableHead>
                                        <TableHead className="min-w-[200px]">Logic</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transportOptions.map((option, index) => (
                                        <TableRow
                                          key={index}
                                          onClick={() => setSelectedOptionIndex(index)}
                                          className={`cursor-pointer ${selectedOptionIndex === index ? 'bg-purple-50' : ''}`}
                                        >
                                            <TableCell className="font-medium">{option.seqNo}</TableCell>
                                            <TableCell>{option.mode}</TableCell>
                                            <TableCell>{option.price}</TableCell>
                                            <TableCell>{option.transitTime}</TableCell>
                                            <TableCell>{option.bestFor}</TableCell>
                                            <TableCell>{option.interchangePoints}</TableCell>
                                            <TableCell className="text-muted-foreground text-xs">{option.logic}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </div>
                        </ScrollArea>
                    ) : (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                            No detailed recommendations available.
                        </div>
                    )}
                </CardContent>
            </Card>

            <LeadForm
                initialData={initialData}
                onSubmit={handleSubmit}
                onCancel={() => onOpenChange(false)}
                suggestedService={suggestedService}
                isSuggestingService={isSuggestingService}
                recommendationSelection={selectedOptionIndex !== null ? transportOptions[selectedOptionIndex] : null}
            />
        </div>
      </DialogContent>
    </Dialog>
  );
}
