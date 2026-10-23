import path from "path";

export const DATA_DIR = path.join(process.cwd(), "data");

export const isMock = () => process.env.MOCK_AI === "1";
export const apiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

/** Candidate Flash model ids, tried in order on a "model not found" error (free, not retried paid). */
export function flashModelChain(): string[] {
  const chain = [process.env.GEMINI_FLASH_MODEL, "gemini-3.8-flash", "gemini-3-flash-preview"].filter(
    (m): m is string => !!m,
  );
  return [...new Set(chain)];
}

export const deepResearchAgent = () => process.env.DEEP_RESEARCH_AGENT || "deep-research-preview-04-2026";
export const budgetUsd = () => Number(process.env.BUDGET_USD) || 25;
export const maxDeepResearchRuns = () => {
  const v = process.env.MAX_DEEP_RESEARCH_RUNS;
  return v !== undefined && v !== "" && !isNaN(Number(v)) ? Number(v) : 5;
};

export const ELECTION_NAME = "2026 General Election";
export const ELECTION_DATE = "2026-11-03";

export class AiError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}
export class BudgetError extends AiError {
  constructor(message: string) {
    super(message, 402);
  }
}
