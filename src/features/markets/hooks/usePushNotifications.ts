/**
 * Push / in-app notification hooks for the markets module.
 *
 *   useNotificationPermission()     — request browser Notification API permission
 *   useRegisterPushToken()          — save an Expo/FCM token to markets.push_tokens
 *   useInAppAlertNotifications()    — Supabase Realtime subscription that shows a
 *                                     toast when a price alert is triggered for the
 *                                     current user (web-push fallback)
 */

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ── Browser Notification permission ──────────────────────────────────────

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );

  const request = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  return { permission, request };
}

// ── Register a push token ─────────────────────────────────────────────────

interface RegisterTokenInput {
  token:        string;
  platform?:    "expo" | "fcm" | "apns" | "web";
  device_name?: string;
}

/**
 * Upserts a push token into markets.push_tokens.
 * Call after obtaining an Expo or FCM push token on the device.
 */
export function useRegisterPushToken() {
  const { user } = useAuth();

  return useMutation<void, Error, RegisterTokenInput>({
    mutationFn: async ({ token, platform = "expo", device_name }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await (supabase as any)
        .schema("markets")
        .from("push_tokens")
        .upsert(
          {
            user_id:     user.id,
            token,
            platform,
            device_name: device_name ?? null,
            is_active:   true,
          },
          { onConflict: "user_id,token" },
        );

      if (error) throw new Error(error.message ?? "Failed to register push token");
    },
  });
}

// ── In-app alert notifications via Supabase Realtime ─────────────────────

/**
 * Subscribe to Supabase Realtime on markets.price_alerts.
 * When any alert for the current user transitions to status='triggered',
 * display a toast notification.
 *
 * This provides a web-push fallback without needing a Service Worker or VAPID keys.
 * Call this hook once in a provider or page-level component.
 */
export function useInAppAlertNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("markets-price-alerts-realtime")
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "markets",
          table:  "price_alerts",
          filter: `status=eq.triggered`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const record = payload.new;
          // Only show toast for alerts owned by the current user
          if (!record || record["user_id"] !== user.id) return;

          const sym       = String(record["symbol"] ?? "");
          const condition = String(record["condition"] ?? "above");
          const price     = Number(record["triggered_price"] ?? 0);
          const direction = condition === "above" ? "rose above" : "fell below";

          toast.info(
            `Alert: ${sym} ${direction} ₹${price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
            { description: "Markets · Price Alert", duration: 8000 },
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel).catch(() => undefined);
    };
  }, [user?.id]);
}
