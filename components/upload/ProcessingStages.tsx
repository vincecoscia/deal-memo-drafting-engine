"use client";

import { CheckCircle2, Loader2, Circle } from "lucide-react";
import type { ClassificationResult } from "@/types";
import { Badge } from "@/components/ui/badge";

type Stage = "classifying" | "extracting" | "generating" | "complete";

const STAGES: { id: Stage; label: string }[] = [
  { id: "classifying", label: "Classifying document type" },
  { id: "extracting", label: "Extracting structured data" },
  { id: "generating", label: "Generating deal memo" },
  { id: "complete", label: "Analysis complete" },
];

const ORDER: Record<Stage, number> = {
  classifying: 0,
  extracting: 1,
  generating: 2,
  complete: 3,
};

interface ProcessingStagesProps {
  currentStage: Stage;
  classification: ClassificationResult | null;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  cim: "Confidential Information Memorandum",
  term_sheet: "Term Sheet",
  financial_statement: "Financial Statement",
};

export function ProcessingStages({
  currentStage,
  classification,
}: ProcessingStagesProps) {
  const currentIdx = ORDER[currentStage];

  return (
    <div className="space-y-4 py-6">
      {STAGES.map((stage) => {
        const idx = ORDER[stage.id];
        const isActive = idx === currentIdx;
        const isDone = idx < currentIdx;

        return (
          <div key={stage.id} className="flex items-center gap-3">
            {isDone ? (
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            ) : isActive ? (
              <Loader2 className="h-5 w-5 text-accent animate-spin shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground/30 shrink-0" />
            )}
            <span
              className={`text-sm ${
                isDone
                  ? "text-success font-medium"
                  : isActive
                    ? "text-foreground font-medium"
                    : "text-muted-foreground/50"
              }`}
            >
              {stage.label}
            </span>

            {/* Show classification result inline */}
            {stage.id === "classifying" && isDone && classification && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {DOC_TYPE_LABELS[classification.document_type] ??
                  classification.document_type}{" "}
                ({Math.round(classification.confidence * 100)}%)
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}
