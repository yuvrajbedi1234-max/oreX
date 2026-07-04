// Client-safe mirror of the JSON contract returned by /api/demo/* routes.

export type SeedStepStatus = "CREATED" | "FOUND" | "UPDATED" | "FAILED" | "MANUAL_ACTION_REQUIRED";

export interface SeedStepResult {
  step: string;
  label: string;
  status: SeedStepStatus;
  message?: string;
  xeroId?: string;
}

export interface SeedResult {
  steps: SeedStepResult[];
  success: boolean;
}
