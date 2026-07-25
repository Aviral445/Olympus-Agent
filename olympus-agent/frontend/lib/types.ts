export interface AuthSession {
  login: string;
  name: string;
  avatar: string;
  token: string;
  isAdmin: boolean;
}

export interface TriggerParams {
  repo_url: string;
  target_file?: string;
  max_attempts?: number;
  bug_description?: string;
  repo_name?: string;
}

export interface TriggerResponse {
  status: string;
  run_id: string;
  message: string;
  target_file: string;
  repo_url: string;
}

export interface LogEvent {
  type: "log" | "complete";
  message?: string;
  result?: "PASS" | "FAIL";
  diff?: string;
}

export interface RunRecord {
  id: number;
  timestamp: string;
  target_file: string;
  attempt: number;
  status: "PASS" | "FAIL";
  git_diff: string;
  error_logs: string;
}

export interface HealthResponse {
  status: string;
  service: string;
}

export type PipelineResult = "PASS" | "FAIL" | null;
export type RunTab = "run" | "history";
export type NodeStatus = "idle" | "running" | "success" | "failed";
