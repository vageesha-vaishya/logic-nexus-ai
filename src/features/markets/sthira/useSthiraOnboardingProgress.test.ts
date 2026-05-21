import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/features/markets/retail/hooks/useRiskProfile", () => ({ useRiskProfile: vi.fn() }));
vi.mock("@/features/markets/hooks/useBrokerConnections", () => ({ useBrokerConnections: vi.fn() }));

import { useAuth } from "@/hooks/useAuth";
import { useRiskProfile } from "@/features/markets/retail/hooks/useRiskProfile";
import { useBrokerConnections } from "@/features/markets/hooks/useBrokerConnections";
import { useSthiraOnboardingProgress } from "./useSthiraOnboardingProgress";

const setup = (params: {
  authLoading?: boolean;
  user?: { id: string } | null;
  profilePending?: boolean;
  hasOnboarded?: boolean;
  connectionsPending?: boolean;
  brokers?: number;
}) => {
  // Note: `null ?? default` returns default. Use the in-operator so a caller
  // can explicitly request a null user.
  const user = "user" in params ? params.user : { id: "u1" };
  vi.mocked(useAuth).mockReturnValue({
    user: user as any,
    loading: params.authLoading ?? false,
  } as any);
  vi.mocked(useRiskProfile).mockReturnValue({
    isPending: params.profilePending ?? false,
    hasOnboarded: params.hasOnboarded ?? false,
    data: null,
  } as any);
  vi.mocked(useBrokerConnections).mockReturnValue({
    isPending: params.connectionsPending ?? false,
    data: Array.from({ length: params.brokers ?? 0 }, () => ({})),
  } as any);
};

describe("useSthiraOnboardingProgress", () => {
  it("loading while auth is loading", () => {
    setup({ authLoading: true });
    const { result } = renderHook(() => useSthiraOnboardingProgress());
    expect(result.current.step).toBe("loading");
  });

  it("auth when no user", () => {
    setup({ user: null });
    const { result } = renderHook(() => useSthiraOnboardingProgress());
    expect(result.current.step).toBe("auth");
  });

  it("loading while profile or connections queries are pending", () => {
    setup({ profilePending: true });
    expect(renderHook(() => useSthiraOnboardingProgress()).result.current.step).toBe("loading");

    setup({ connectionsPending: true });
    expect(renderHook(() => useSthiraOnboardingProgress()).result.current.step).toBe("loading");
  });

  it("risk when signed in but no risk profile", () => {
    setup({ hasOnboarded: false });
    const { result } = renderHook(() => useSthiraOnboardingProgress());
    expect(result.current.step).toBe("risk");
    expect(result.current.hasAuth).toBe(true);
  });

  it("broker when risk done but no broker connected", () => {
    setup({ hasOnboarded: true, brokers: 0 });
    const { result } = renderHook(() => useSthiraOnboardingProgress());
    expect(result.current.step).toBe("broker");
    expect(result.current.hasRiskProfile).toBe(true);
  });

  it("complete when risk + broker both done", () => {
    setup({ hasOnboarded: true, brokers: 1 });
    const { result } = renderHook(() => useSthiraOnboardingProgress());
    expect(result.current.step).toBe("complete");
    expect(result.current.hasBroker).toBe(true);
  });
});
