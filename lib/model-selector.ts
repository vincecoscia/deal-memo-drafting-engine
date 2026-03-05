import type { DocumentType, DealSubType, MemoFormat } from "@/types";

export type ModelId = "claude-sonnet-4-6" | "claude-opus-4-6";

export interface ModelSelectionContext {
  documentCount?: number;
  pageCount?: number;
  memoFormat?: MemoFormat;
  documentType?: DocumentType;
  dealSubType?: DealSubType;
  stage: "classify" | "extract" | "generate" | "verify" | "score";
}

export function selectModel(ctx: ModelSelectionContext): ModelId {
  // Classification and verification are always Sonnet (fast, cheap, sufficient)
  if (ctx.stage === "classify" || ctx.stage === "verify") {
    return "claude-sonnet-4-6";
  }

  // Escalate to Opus for multi-document analysis
  if (ctx.documentCount && ctx.documentCount > 1) {
    return "claude-opus-4-6";
  }

  // Escalate for detailed memo generation
  if (ctx.stage === "generate" && ctx.memoFormat === "detailed") {
    return "claude-opus-4-6";
  }

  // Escalate for very large documents during extraction
  if (ctx.stage === "extract" && ctx.pageCount && ctx.pageCount > 80) {
    return "claude-opus-4-6";
  }

  return "claude-sonnet-4-6";
}
