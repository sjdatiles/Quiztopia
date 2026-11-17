import { useEffect, useRef, useState } from 'react';
import type { QuizSessionPublicState } from '../../shared/types.ts';

const AUTH_TOKEN_KEY = 'quiztopia_auth_token';
let memoryAuthToken: string | null = null;

export function getAuthToken(): string | null {
  if (memoryAuthToken) return memoryAuthToken;
  try {
    const ss = window.sessionStorage?.getItem(AUTH_TOKEN_KEY);
    if (ss) {
      memoryAuthToken = ss;
      return ss;
    }
  } catch {
    // storage may be restricted in sandboxed contexts
  }
  try {
    const ls = window.localStorage?.getItem(AUTH_TOKEN_KEY);
    if (ls) {
      memoryAuthToken = ls;
      return ls;
    }
  } catch {
    // ignore storage restriction
  }
  return null;
}

export function setAuthToken(token: string | null | undefined): void {
  const clean = token?.trim() || null;
  memoryAuthToken = clean;
  try {
    if (clean) window.sessionStorage?.setItem(AUTH_TOKEN_KEY, clean);
    else window.sessionStorage?.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore
  }
  try {
    if (clean) window.localStorage?.setItem(AUTH_TOKEN_KEY, clean);
    else window.localStorage?.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function clearAuthToken(): void {
  setAuthToken(null);
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }

  return data as T;
}

export function useQuizSocket(sessionId: string | null, pollEndpoint?: string) {
  const [liveState, setLiveState] = useState<QuizSessionPublicState | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLiveState(null);
      setConnected(false);
      return;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const connect = () => {
      if (cancelled) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = getAuthToken();
      const tokenQs = token ? `&token=${encodeURIComponent(token)}` : '';
      const url = `${protocol}//${window.location.host}/ws/quiz?sessionId=${encodeURIComponent(sessionId)}${tokenQs}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!cancelled) {
          attempts = 0;
          setConnected(true);
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg?.type === 'quiz:state' && msg.payload) {
            setLiveState(msg.payload as QuizSessionPublicState);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        attempts += 1;
        // Back off retries cleanly in environments without WebSockets (e.g., Vercel serverless)
        const delay = attempts <= 2 ? 2500 : 12000;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [sessionId]);

  // Automatic HTTP polling fallback whenever WebSocket is unavailable (e.g. Vercel Serverless)
  useEffect(() => {
    if (!sessionId || !pollEndpoint || connected) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await apiFetch<{ state: QuizSessionPublicState }>(pollEndpoint);
        if (!cancelled && res?.state) {
          setLiveState(res.state);
        }
      } catch {
        // ignore transient poll failures
      }
    };

    const intervalId = setInterval(() => {
      void poll();
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [sessionId, pollEndpoint, connected]);

  return { liveState, setLiveState, connected };
}
