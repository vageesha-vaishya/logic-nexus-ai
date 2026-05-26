/**
 * useAndroidBack — subscribe to the Capacitor hardware Back button.
 *
 * The handler should return `true` if it consumed the event (e.g. navigated
 * to the previous wizard step). Returning `false` or `undefined` falls
 * through to Capacitor's default: if the WebView has history, go back;
 * otherwise exit the app — matching standard Android root-screen behaviour.
 *
 * No-op on web and iOS. Safe to mount unconditionally.
 */
import { useEffect, useRef } from "react";
import { App, type BackButtonListenerEvent } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

type Handler = (event: BackButtonListenerEvent) => boolean | void;

export function useAndroidBack(handler: Handler): void {
  const handlerRef = useRef<Handler>(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;

    let listener: PluginListenerHandle | undefined;
    let cancelled = false;

    void App.addListener("backButton", (event) => {
      const consumed = handlerRef.current(event);
      if (consumed) return;
      if (event.canGoBack) {
        window.history.back();
      } else {
        void App.exitApp();
      }
    }).then((h) => {
      if (cancelled) {
        void h.remove();
      } else {
        listener = h;
      }
    });

    return () => {
      cancelled = true;
      if (listener) void listener.remove();
    };
  }, []);
}
