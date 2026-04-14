/**
 * Real-Time Updates Hook for Work Package Templates
 * 
 * Features:
 * - WebSocket connection management
 * - Server-Sent Events (SSE) fallback
 * - Automatic reconnection with exponential backoff
 * - Event handling (create, update, delete)
 * - Cache invalidation
 * - User notifications
 * - Connection status tracking
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { templateQueryKeys } from '../hooks/useTemplateQueries';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TemplateEventType =
  | 'TEMPLATE_CREATED'
  | 'TEMPLATE_UPDATED'
  | 'TEMPLATE_DELETED'
  | 'TEMPLATE_STATUS_CHANGED'
  | 'TEMPLATE_VERSION_APPROVED'
  | 'TEMPLATE_VERSION_REJECTED';

export interface TemplateEvent {
  type: TemplateEventType;
  templateId: string;
  tenantId: string;
  timestamp: string;
  userId: string;
  userName?: string;
  data?: Record<string, any>;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseRealTimeUpdatesOptions {
  enabled?: boolean;
  accessToken?: string;
  tenantId?: string;
  onEvent?: (event: TemplateEvent) => void;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const WS_URL = process.env.VITE_WS_URL || 'wss://api.example.com';
const SSE_URL = '/api/v2/amro/events/stream';
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000; // 1 second

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Hook to manage real-time updates via WebSocket/SSE
 */
export function useRealTimeUpdates({
  enabled = true,
  accessToken,
  tenantId,
  onEvent,
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS,
  reconnectDelay = BASE_RECONNECT_DELAY,
}: UseRealTimeUpdatesOptions = {}) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectCountRef = useRef(0);
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<TemplateEvent | null>(null);

  // Calculate reconnect delay with exponential backoff
  const getReconnectDelay = useCallback(() => {
    const attempt = reconnectCountRef.current;
    return Math.min(reconnectDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
  }, [reconnectDelay]);

  // Handle incoming event
  const handleEvent = useCallback(
    (event: TemplateEvent) => {
      setLastEvent(event);

      // Call custom handler if provided
      if (onEvent) {
        onEvent(event);
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: templateQueryKeys.lists() });
      
      if (event.templateId) {
        queryClient.invalidateQueries({
          queryKey: templateQueryKeys.detail(event.templateId),
        });
      }

      // Show toast notification
      const userAction = event.userName ? ` by ${event.userName}` : '';
      
      switch (event.type) {
        case 'TEMPLATE_CREATED':
          toast.success(`Template created${userAction}`, {
            description: event.data?.template_name,
          });
          break;
          
        case 'TEMPLATE_UPDATED':
          toast.info(`Template updated${userAction}`, {
            description: event.data?.template_name,
          });
          break;
          
        case 'TEMPLATE_DELETED':
          toast.warning(`Template deleted${userAction}`, {
            description: event.data?.template_name,
          });
          break;
          
        case 'TEMPLATE_STATUS_CHANGED':
          toast.info(`Template status changed${userAction}`, {
            description: `${event.data?.template_name} → ${event.data?.new_status}`,
          });
          break;
          
        case 'TEMPLATE_VERSION_APPROVED':
          toast.success(`Template version approved${userAction}`, {
            description: event.data?.template_name,
          });
          break;
          
        case 'TEMPLATE_VERSION_REJECTED':
          toast.error(`Template version rejected${userAction}`, {
            description: event.data?.rejection_reason,
          });
          break;
      }
    },
    [queryClient, onEvent]
  );

  // Parse event message
  const parseEvent = useCallback((data: string): TemplateEvent | null => {
    try {
      const event = JSON.parse(data);
      
      // Validate required fields
      if (!event.type || !event.tenantId || !event.timestamp) {
        console.warn('Invalid event received:', event);
        return null;
      }

      return event as TemplateEvent;
    } catch (error) {
      console.error('Failed to parse event:', error);
      return null;
    }
  }, []);

  // Connect via WebSocket
  const connectWebSocket = useCallback(() => {
    if (!accessToken || !tenantId) return;

    try {
      setConnectionStatus('connecting');
      
      const wsUrl = `${WS_URL}/amro/templates?token=${accessToken}&tenant=${tenantId}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus('connected');
        reconnectCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        const parsed = parseEvent(event.data);
        if (parsed) {
          handleEvent(parsed);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnectionStatus('disconnected');
        
        // Attempt reconnection
        if (reconnectCountRef.current < reconnectAttempts) {
          const delay = getReconnectDelay();
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectCountRef.current + 1}/${reconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectCountRef.current++;
            connectWebSocket();
          }, delay);
        } else {
          console.error('Max reconnection attempts reached');
          toast.error('Real-time updates disconnected', {
            description: 'Please refresh the page to reconnect.',
          });
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setConnectionStatus('error');
    }
  }, [accessToken, tenantId, parseEvent, handleEvent, reconnectAttempts, getReconnectDelay]);

  // Connect via Server-Sent Events (fallback)
  const connectSSE = useCallback(() => {
    if (!accessToken || !tenantId) return;

    try {
      setConnectionStatus('connecting');
      
      const eventSource = new EventSource(
        `${SSE_URL}?token=${accessToken}&tenant=${tenantId}`
      );

      eventSource.onopen = () => {
        console.log('SSE connected');
        setConnectionStatus('connected');
        reconnectCountRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        const parsed = parseEvent(event.data);
        if (parsed) {
          handleEvent(parsed);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        eventSource.close();
        setConnectionStatus('error');
        
        // Attempt reconnection
        if (reconnectCountRef.current < reconnectAttempts) {
          const delay = getReconnectDelay();
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectCountRef.current++;
            connectSSE();
          }, delay);
        }
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error('Failed to connect SSE:', error);
      setConnectionStatus('error');
    }
  }, [accessToken, tenantId, parseEvent, handleEvent, reconnectAttempts, getReconnectDelay]);

  // Auto-connect based on feature detection
  const connect = useCallback(() => {
    // Prefer WebSocket, fallback to SSE
    if (typeof WebSocket !== 'undefined') {
      connectWebSocket();
    } else if (typeof EventSource !== 'undefined') {
      connectSSE();
    } else {
      console.warn('Real-time updates not supported in this browser');
      setConnectionStatus('error');
    }
  }, [connectWebSocket, connectSSE]);

  // Disconnect
  const disconnect = useCallback(() => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Close SSE
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionStatus('disconnected');
    reconnectCountRef.current = 0;
  }, []);

  // Reconnect manually
  const reconnect = useCallback(() => {
    disconnect();
    reconnectCountRef.current = 0;
    connect();
  }, [disconnect, connect]);

  // Connection lifecycle
  useEffect(() => {
    if (!enabled || !accessToken || !tenantId) {
      disconnect();
      return;
    }

    connect();

    return () => {
      disconnect();
    };
  }, [enabled, accessToken, tenantId, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionStatus,
    lastEvent,
    reconnect,
    disconnect,
    isConnected: connectionStatus === 'connected',
    isConnecting: connectionStatus === 'connecting',
    isError: connectionStatus === 'error',
  };
}

/**
 * Hook to check if real-time updates are supported
 */
export function useRealTimeSupport(): boolean {
  return typeof WebSocket !== 'undefined' || typeof EventSource !== 'undefined';
}
