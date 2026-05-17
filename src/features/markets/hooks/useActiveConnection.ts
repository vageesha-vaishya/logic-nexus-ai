import { useBrokerConnections, type BrokerConnection } from "./useBrokerConnections";

export function useActiveConnection(): {
  connection: BrokerConnection | null;
  hasTradeableConnection: boolean;
  isLoading: boolean;
} {
  const { data: connections, isLoading } = useBrokerConnections();

  const connection =
    connections?.find((c) => c.can_trade && c.status === "active") ??
    connections?.find((c) => c.status === "active") ??
    null;

  return {
    connection,
    hasTradeableConnection: !!connection?.can_trade,
    isLoading,
  };
}
