import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";

type ServiceStatus = "up" | "down" | "unknown";

type Service = {
  id: string;
  label: string;
  probePath: string;
};

function useServiceStatuses(services: Service[], intervalMs = 30000) {
  const [statuses, setStatuses] = useState<Record<string, ServiceStatus>>({});

  useEffect(() => {
    let cancelled = false;
    async function checkService(svc: Service) {
      try {
        const res = await fetch(svc.probePath, { method: "GET" });
        if (res.ok || res.status === 404) return "up";
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        if (data && data.code === "UPSTREAM_UNAVAILABLE") return "down";
        return res.status >= 500 ? "down" : "unknown";
      } catch {
        return "down";
      }
    }
    async function tick() {
      const results: Record<string, ServiceStatus> = {};
      for (const s of services) {
        results[s.id] = await checkService(s);
      }
      if (!cancelled) setStatuses(results);
    }
    tick();
    const t = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [services, intervalMs]);

  return statuses;
}

export function ServiceStatusBadge() {
  const isDev = import.meta.env.DEV;
  const enableSupabaseFunctionProbe = import.meta.env.VITE_ENABLE_SUPABASE_FUNCTION_PROBE === "true";
  const isLocalBrowser =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname.toLowerCase());
  const services = useMemo<Service[]>(
    () =>
      [
        { id: "crm", label: "CRM", probePath: "/api/crm/__health__" },
        { id: "amro", label: "AMRO", probePath: "/api/v2/amro/__health__" },
        ...(isLocalBrowser ? [] : [{ id: "branding", label: "Branding", probePath: "/api/v1/tenant-branding" }]),
        ...(enableSupabaseFunctionProbe ? [{ id: "sb-fn", label: "Supabase Fn", probePath: "/functions/v1/list-edge-functions" }] : []),
      ] as Service[],
    [enableSupabaseFunctionProbe, isLocalBrowser]
  );
  const statuses = useServiceStatuses(services);
  if (!isDev) return null;
  return (
    <div className="hidden md:flex items-center gap-1.5">
      {services.map((s) => {
        const state = statuses[s.id] || "unknown";
        const tone =
          state === "up" ? "bg-emerald-600 text-white" : state === "down" ? "bg-red-600 text-white" : "bg-gray-300 text-gray-800";
        return (
          <Badge key={s.id} variant="secondary" className={`${tone} border-none`}>
            {s.label}
          </Badge>
        );
      })}
    </div>
  );
}
