import { useEffect, useRef, useCallback, useState } from "react";

export function useSSE<T>(url: string | null, onMessage: (data: T) => void) {
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!url) return;
    const source = new EventSource(url);
    sourceRef.current = source;

    source.onopen = () => setConnected(true);
    source.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data));
      } catch {
        // skip unparseable messages
      }
    };
    source.onerror = () => {
      setConnected(false);
      source.close();
      // reconnect after 5s
      setTimeout(connect, 5000);
    };
  }, [url, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      sourceRef.current?.close();
    };
  }, [connect]);

  return { connected };
}
