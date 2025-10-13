import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, FileText, Users, Building2, Package, X } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useNavigate } from "react-router-dom";
import { useCRM } from "@/hooks/useCRM";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: "lead" | "account" | "contact" | "quote" | "opportunity";
  path: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { supabase, context } = useCRM();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !context.tenantId) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const searchPattern = `%${searchQuery}%`;
      const franchiseFilter = context.franchiseId 
        ? { franchise_id: context.franchiseId }
        : { tenant_id: context.tenantId };

      const [leads, accounts, contacts, quotes, opportunities] = await Promise.all([
        supabase
          .from("leads")
          .select("id, first_name, last_name, company, email")
          .match(franchiseFilter)
          .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},company.ilike.${searchPattern},email.ilike.${searchPattern}`)
          .limit(5),
        supabase
          .from("accounts")
          .select("id, name")
          .match(franchiseFilter)
          .ilike("name", searchPattern)
          .limit(5),
        supabase
          .from("contacts")
          .select("id, first_name, last_name, email")
          .match(franchiseFilter)
          .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern}`)
          .limit(5),
        supabase
          .from("quotes")
          .select("id, quote_number, account_id")
          .match(franchiseFilter)
          .ilike("quote_number", searchPattern)
          .limit(5),
        supabase
          .from("opportunities")
          .select("id, name, stage")
          .match(franchiseFilter)
          .ilike("name", searchPattern)
          .limit(5),
      ]);

      const searchResults: SearchResult[] = [
        ...(leads.data || []).map((l) => ({
          id: l.id,
          title: l.company || `${l.first_name} ${l.last_name}`.trim() || "Unnamed Lead",
          subtitle: l.email || undefined,
          type: "lead" as const,
          path: `/dashboard/leads/${l.id}`,
        })),
        ...(accounts.data || []).map((a) => ({
          id: a.id,
          title: a.name,
          type: "account" as const,
          path: `/dashboard/accounts/${a.id}`,
        })),
        ...(contacts.data || []).map((c) => ({
          id: c.id,
          title: `${c.first_name} ${c.last_name}`.trim(),
          subtitle: c.email || undefined,
          type: "contact" as const,
          path: `/dashboard/contacts/${c.id}`,
        })),
        ...(quotes.data || []).map((q) => ({
          id: q.id,
          title: q.quote_number || "Unnamed Quote",
          type: "quote" as const,
          path: `/dashboard/quotes/${q.id}`,
        })),
        ...(opportunities.data || []).map((o) => ({
          id: o.id,
          title: o.name || "Unnamed Opportunity",
          subtitle: o.stage || undefined,
          type: "opportunity" as const,
          path: `/dashboard/opportunities/${o.id}`,
        })),
      ];

      setResults(searchResults);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [context.tenantId, context.franchiseId, supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.path);
    setOpen(false);
    setQuery("");
  };

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "lead": return FileText;
      case "account": return Building2;
      case "contact": return Users;
      case "quote": return Package;
      case "opportunity": return FileText;
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground",
          "border border-input rounded-md bg-background hover:bg-accent transition-colors",
          "w-64"
        )}
      >
        <Search className="h-4 w-4" />
        <span>Search...</span>
        <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search leads, accounts, contacts, quotes..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && results.length === 0 && query && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}
          {!loading && results.length > 0 && (
            <>
              {["lead", "account", "contact", "quote", "opportunity"].map((type) => {
                const typeResults = results.filter((r) => r.type === type);
                if (typeResults.length === 0) return null;
                return (
                  <CommandGroup key={type} heading={type.charAt(0).toUpperCase() + type.slice(1) + "s"}>
                    {typeResults.map((result) => {
                      const Icon = getIcon(result.type);
                      return (
                        <CommandItem
                          key={result.id}
                          onSelect={() => handleSelect(result)}
                          className="cursor-pointer"
                        >
                          <Icon className="mr-2 h-4 w-4" />
                          <div className="flex flex-col">
                            <span>{result.title}</span>
                            {result.subtitle && (
                              <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                            )}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
