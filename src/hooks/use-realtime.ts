import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:9000/ws";

type WsEventType =
  | "ticket:issued"
  | "ticket:called"
  | "ticket:completed"
  | "ticket:no_show"
  | "ticket:cancelled"
  | "ticket:transferred"
  | "order:status_changed"
  | "device:heartbeat"
  | "counter:session_opened"
  | "counter:session_closed"
  | "connected";

export interface WsMessage {
  event: WsEventType;
  branchId?: string;
  companyId?: string;
  payload: {
    ticket_number?: string;
    counter_name?: string;
    counter_id?: string;
    ticket_id?: string;
    queue_group_id?: string;
    [key: string]: unknown;
  };
}

interface UseRealtimeOptions {
  branchId?: string;
  companyId?: string;
  onTicketCalled?: (msg: WsMessage) => void;
  onTicketIssued?: (msg: WsMessage) => void;
  onTicketCompleted?: (msg: WsMessage) => void;
  enabled?: boolean;
}

export type RealtimeStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export function useRealtime(options: UseRealtimeOptions = {}) {
  const {
    branchId, companyId,
    onTicketCalled, onTicketIssued, onTicketCompleted,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasConnectedRef = useRef(false);
  const [status, setStatus] = useState<RealtimeStatus>("idle");

  const onCalledRef = useRef(onTicketCalled);
  const onIssuedRef = useRef(onTicketIssued);
  const onCompletedRef = useRef(onTicketCompleted);
  useEffect(() => { onCalledRef.current = onTicketCalled; }, [onTicketCalled]);
  useEffect(() => { onIssuedRef.current = onTicketIssued; }, [onTicketIssued]);
  useEffect(() => { onCompletedRef.current = onTicketCompleted; }, [onTicketCompleted]);

  const handleMessage = useCallback((msg: WsMessage) => {
    switch (msg.event) {
      case "ticket:issued":
        void queryClient.invalidateQueries({ queryKey: ["tickets"] });
        void queryClient.invalidateQueries({ queryKey: ["queues"] });
        void queryClient.invalidateQueries({ queryKey: ["tickets-waiting-kiosk"] });
        onIssuedRef.current?.(msg);
        break;

      case "ticket:called":
        void queryClient.invalidateQueries({ queryKey: ["tickets"] });
        void queryClient.invalidateQueries({ queryKey: ["tickets-display"] });
        onCalledRef.current?.(msg);
        break;

      case "ticket:completed":
        void queryClient.invalidateQueries({ queryKey: ["tickets"] });
        onCompletedRef.current?.(msg);
        break;

      case "ticket:no_show":
      case "ticket:cancelled":
      case "ticket:transferred":
        void queryClient.invalidateQueries({ queryKey: ["tickets"] });
        break;

      case "counter:session_opened":
      case "counter:session_closed":
        void queryClient.invalidateQueries({ queryKey: ["counters"] });
        break;

      case "order:status_changed":
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
        break;

      case "device:heartbeat":
        void queryClient.invalidateQueries({ queryKey: ["devices"] });
        break;

      default:
        break;
    }
  }, [queryClient]);

  const connect = useCallback(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    const params = new URLSearchParams();
    if (branchId) params.set("branchId", branchId);
    if (companyId) params.set("companyId", companyId);
    const url = `${WS_URL}?${params.toString()}`;

    try {
      setStatus(wasConnectedRef.current ? "reconnecting" : "connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        wasConnectedRef.current = true;
        setStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as WsMessage;
          handleMessage(msg);
        } catch {
          // Ignore malformed socket payloads.
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setStatus("disconnected");
    }
  }, [branchId, companyId, enabled, handleMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  return { sendMessage, status };
}
