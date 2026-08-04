import type { TriggerParams, TriggerResponse, RunRecord, HealthResponse } from "./types";

const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// ─── Trigger ─────────────────────────────────────────────────────────────────

export async function triggerRun(params: TriggerParams): Promise<TriggerResponse> {
  const res = await fetch(`${BACKEND}/api/v1/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend error ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── SSE Stream ──────────────────────────────────────────────────────────────

export interface StreamCallbacks {
  onLog: (message: string) => void;
  onComplete: (result: "PASS" | "FAIL", diff: string) => void;
  onError: (msg: string) => void;
}

export function streamRunLogs(runId: string, callbacks: StreamCallbacks): EventSource {
  const es = new EventSource(`${BACKEND}/api/v1/stream/${runId}`);

  es.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      if (parsed.type === "log" && parsed.message) {
        callbacks.onLog(parsed.message.trim());
      } else if (parsed.type === "complete") {
        callbacks.onComplete(parsed.result ?? "FAIL", parsed.diff ?? "");
        es.close();
      }
    } catch {
      // ignore malformed frames
    }
  };

  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) {
      return;
    }
    callbacks.onError("SSE connection lost — check backend is running.");
    es.close();
  };


  return es;
}

// ─── Run History ─────────────────────────────────────────────────────────────

export async function fetchRuns(limit = 50): Promise<RunRecord[]> {
  const res = await fetch(`${BACKEND}/api/v1/runs?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.runs ?? [];
}

// ─── Health ──────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${BACKEND}/health`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
