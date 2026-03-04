"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MetricsDashboard } from "@/components/memo/MetricsDashboard";
import { FinancialCharts } from "@/components/memo/FinancialCharts";
import { TableOfContents } from "@/components/memo/TableOfContents";
import { MemoSection } from "@/components/memo/MemoSection";
import { RiskFlags } from "@/components/memo/RiskFlags";
import { InvestmentScorecard } from "@/components/memo/InvestmentScorecard";
import { RawDataPanel } from "@/components/memo/RawDataPanel";
import { ExportControls } from "@/components/memo/ExportControls";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { ArrowLeft, FileText, Database, Trash2 } from "lucide-react";
import type {
  DealMemoData,
  ExtractedData,
  CIMData,
  ClassificationResult,
} from "@/types";

interface MemoViewerClientProps {
  memoId: string;
  memoData: DealMemoData;
  extractedData: ExtractedData;
  classification: ClassificationResult;
  documentName: string;
  documentType: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  cim: "CIM",
  term_sheet: "Term Sheet",
  financial_statement: "Financial Statement",
};

export function MemoViewerClient({
  memoId,
  memoData: initialMemo,
  extractedData,
  classification,
  documentName,
  documentType,
}: MemoViewerClientProps) {
  const router = useRouter();
  const [memo, setMemo] = useState(initialMemo);

  const handleSectionUpdate = useCallback(
    (sectionId: string, content: string, confidence: number) => {
      setMemo((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId
            ? { ...s, content, confidence_score: confidence }
            : s
        ),
      }));
    },
    []
  );

  return (
    <div className="min-h-screen bg-background print:bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur print:hidden">
        <div className="mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <div className="hidden items-center gap-2 sm:flex">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{documentName}</span>
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                {DOC_TYPE_LABELS[documentType] ?? documentType}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (!confirm("Delete this memo? This cannot be undone.")) return;
                fetch(`/api/memos/${memoId}`, { method: "DELETE" })
                  .then((r) => { if (r.ok) router.push("/"); });
              }}
              title="Delete memo"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <ExportControls memoId={memoId} memo={memo} />
            {/* Mobile raw data toggle */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <Database className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[340px] overflow-auto">
                <SheetTitle className="sr-only">Raw Extracted Data</SheetTitle>
                <RawDataPanel
                  extractedData={extractedData}
                  classification={classification}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Three-column layout */}
      <div className="mx-auto flex max-w-[1400px] gap-0">
        {/* Left sidebar: TOC */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-auto border-r border-border p-4 lg:block print:hidden">
          <TableOfContents sections={memo.sections} />
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">
          {/* Metrics Dashboard */}
          <div className="mb-8">
            <MetricsDashboard metrics={memo.metrics} />
          </div>

          {/* Financial Charts (CIM only) */}
          {documentType === "cim" && "financials" in extractedData && (
            <div className="mb-8">
              <FinancialCharts financials={(extractedData as CIMData).financials} />
            </div>
          )}

          {/* Memo Sections */}
          <div className="space-y-6">
            {memo.sections.map((section) => (
              <MemoSection
                key={section.id}
                section={section}
                memoId={memoId}
                onUpdate={handleSectionUpdate}
              />
            ))}
          </div>

          {/* Risk Flags */}
          <div className="mt-8">
            <RiskFlags risks={memo.risk_flags} />
          </div>

          {/* Investment Screening */}
          <div className="mt-8 print:hidden">
            <InvestmentScorecard memoId={memoId} />
          </div>
        </main>

        {/* Right sidebar: Raw data */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 overflow-auto border-l border-border p-4 xl:block print:hidden">
          <RawDataPanel
            extractedData={extractedData}
            classification={classification}
          />
        </aside>
      </div>
    </div>
  );
}
