/**
 * Push-token registration hooks for the markets module.
 *
 *   useNotificationPermission()  — request browser Notification API permission
 *   useRegisterPushToken()       — save an Expo/FCM token to markets.push_tokens
 *
 * In-app realtime notifications live in src/features/notifications/ and are
 * the only delivery channel today. The hooks below exist for the deferred
 * FCM/APNs path — they have no consumers until the Capacitor shell lands.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

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

