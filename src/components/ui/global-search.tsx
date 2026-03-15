import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, FileText, Users, Building2, Package } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useNavigate } from "react-router-dom";
import { useCRM } from "@/hooks/useCRM";
import { cn } from "@/lib/utils";
import { APP_MENU } from "@/config/navigation";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: "lead" | "account" | "contact" | "quote" | "opportunity" | "module";
  path: string;
}

const PER_ENTITY_LIMIT = 5;
const TOTAL_RESULTS_LIMIT = 20;

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const navigate = useNavigate();
  const { scopedDb } = useCRM();

  const buildModuleResults = useCallback((searchQuery: string) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return APP_MENU.flatMap((section) => section.items)
      .filter((item) => {
        if (!normalizedQuery) return true;
        const name = item.name.toLowerCase();
        const description = (item.description || "").toLowerCase();
        return name.includes(normalizedQuery) || description.includes(normalizedQuery);
      })
      .slice(0, PER_ENTITY_LIMIT)
      .map((item) => ({
        id: `module-${item.path}`,
        title: item.name,
        subtitle: item.description,
        type: "module" as const,
        path: item.path,
      }));
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    const openSearch = () => setOpen(true);
    document.addEventListener("keydown", down);
    window.addEventListener("shell:open-global-search", openSearch);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("shell:open-global-search", openSearch);
    };
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    const moduleResults = buildModuleResults(searchQuery);

    if (!searchQuery.trim()) {
      setResults(moduleResults);
      setHasMoreResults(APP_MENU.flatMap((section) => section.items).length > moduleResults.length);
      return;
    }

    if (!scopedDb || typeof scopedDb.from !== "function") {
      setResults(moduleResults);
      setHasMoreResults(APP_MENU.flatMap((section) => section.items).length > moduleResults.length);
      return;
    }

    setLoading(true);
    try {
      const searchPattern = `%${searchQuery}%`;
      const dbResults = await Promise.allSettled([
        scopedDb
          .from("leads")
          .select("id, first_name, last_name, company, email", { count: "exact" })
          .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},company.ilike.${searchPattern},email.ilike.${searchPattern}`)
          .range(0, PER_ENTITY_LIMIT - 1),
        scopedDb
          .from("accounts")
          .select("id, name", { count: "exact" })
          .ilike("name", searchPattern)
          .range(0, PER_ENTITY_LIMIT - 1),
        scopedDb
          .from("contacts")
          .select("id, first_name, last_name, email", { count: "exact" })
          .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern}`)
          .range(0, PER_ENTITY_LIMIT - 1),
        scopedDb
          .from("quotes")
          .select("id, quote_number, account_id", { count: "exact" })
          .ilike("quote_number", searchPattern)
          .range(0, PER_ENTITY_LIMIT - 1),
        scopedDb
          .from("opportunities")
          .select("id, name, stage", { count: "exact" })
          .ilike("name", searchPattern)
          .range(0, PER_ENTITY_LIMIT - 1),
      ]);

      const [leads, accounts, contacts, quotes, opportunities] = dbResults.map((result) => {
        if (result.status !== "fulfilled" || result.value.error) {
          return { data: [], count: 0 };
        }
        return {
          data: result.value.data || [],
          count: result.value.count ?? (result.value.data || []).length,
        };
      });

      const searchResults = [
        ...moduleResults,
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

      const totalMatched =
        moduleResults.length +
        leads.count +
        accounts.count +
        contacts.count +
        quotes.count +
        opportunities.count;

      const limitedResults = searchResults.slice(0, TOTAL_RESULTS_LIMIT);
      setResults(limitedResults);
      setHasMoreResults(totalMatched > limitedResults.length);
    } catch (error) {
      console.error("Search error:", error);
      setResults(moduleResults);
      setHasMoreResults(APP_MENU.flatMap((section) => section.items).length > moduleResults.length);
    } finally {
      setLoading(false);
    }
  }, [buildModuleResults, scopedDb]);

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
      case "module": return Search;
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground",
          "border border-input rounded-md bg-background hover:bg-accent transition-colors",
          "w-44 sm:w-56 lg:w-64"
        )}
      >
        <Search className="h-4 w-4" />
        <span>Search...</span>
        <kbd className="ml-auto pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} commandProps={{ shouldFilter: false }}>
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
              {["module", "lead", "account", "contact", "quote", "opportunity"].map((type) => {
                const typeResults = results.filter((r) => r.type === type);
                if (typeResults.length === 0) return null;
                return (
                  <CommandGroup key={type} heading={type.charAt(0).toUpperCase() + type.slice(1) + "s"}>
                    {typeResults.map((result) => {
                      const Icon = getIcon(result.type);
                      return (
                        <CommandItem
                          key={result.id}
                          value={`${result.type} ${result.title} ${result.subtitle || ""}`.toLowerCase()}
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
              {hasMoreResults && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Showing top {results.length} results. Refine your search to narrow matches.
                </div>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
