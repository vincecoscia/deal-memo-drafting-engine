"use client";

import { SAMPLE_DOCUMENTS, type SampleDocument } from "@/lib/sample-documents";
import { FileText, FlaskConical } from "lucide-react";

interface SampleDocumentPickerProps {
  onSelect: (sample: SampleDocument) => void;
  disabled?: boolean;
  selectedId?: string | null;
}

const docTypeLabel: Record<string, string> = {
  cim: "CIM",
  term_sheet: "Term Sheet",
  financial_statement: "Financials",
};

export function SampleDocumentPicker({
  onSelect,
  disabled,
  selectedId,
}: SampleDocumentPickerProps) {
  if (SAMPLE_DOCUMENTS.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <FlaskConical className="h-4 w-4" />
        <span>Or try a sample document</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {SAMPLE_DOCUMENTS.map((sample) => (
          <button
            key={sample.id}
            onClick={() => onSelect(sample)}
            disabled={disabled}
            className={`rounded-lg border p-3 text-left transition-colors ${
              selectedId === sample.id
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:bg-muted/50"
            } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            <div className="mb-1 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{sample.name}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              {sample.description}
            </p>
            <span className="mt-2 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {docTypeLabel[sample.documentType] ?? sample.documentType}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
