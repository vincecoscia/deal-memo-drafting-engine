"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MetricsDashboard } from "@/components/memo/MetricsDashboard";
import { FinancialCharts } from "@/components/memo/FinancialCharts";
import { TableOfContents } from "@/components/memo/TableOfContents";
import { MemoSection } from "@/components/memo/MemoSection";
import { RiskFlags } from "@/components/memo/RiskFlags";
import { InvestmentScorecard } from "@/components/memo/InvestmentScorecard";
import { FinancialModels } from "@/components/memo/FinancialModels";
import { SensitivityTables } from "@/components/memo/SensitivityTables";
import { RawDataPanel } from "@/components/memo/RawDataPanel";
import { ExportControls } from "@/components/memo/ExportControls";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { EdgarSearch } from "@/components/edgar/EdgarSearch";
import { ArrowLeft, FileText, Database, Trash2, Plus, Loader2 } from "lucide-react";
import type {
  DealMemoData,
  ExtractedData,
  CIMData,
  ClassificationResult,
  SourceDocumentInfo,
} from "@/types";

interface MemoViewerClientProps {
  memoId: string;
  memoData: DealMemoData;
  extractedData: ExtractedData;
  classification: ClassificationResult;
  documentName: string;
  documentType: string;
  initialSourceDocs?: SourceDocumentInfo[];
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
  initialSourceDocs = [],
}: MemoViewerClientProps) {
  const router = useRouter();
  const [memo, setMemo] = useState(initialMemo);
  const [sourceDocs, setSourceDocs] = useState<SourceDocumentInfo[]>(initialSourceDocs);
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const addDocInputRef = useRef<HTMLInputElement>(null);

  // Load source documents
  useEffect(() => {
    fetch(`/api/memos/${memoId}/documents`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSourceDocs)
      .catch(() => {});
  }, [memoId]);

  const handleAddDocument = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf") return;
      setIsAddingDoc(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`/api/memos/${memoId}/documents`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Failed to add document");

        const data = await res.json();
        setSourceDocs((prev) => [...prev, data.sourceDocument]);
        if (data.memo) {
          setMemo(data.memo);
        }
      } catch (err) {
        console.error("Failed to add document:", err);
      } finally {
        setIsAddingDoc(false);
      }
    },
    [memoId]
  );

  const [staleSections, setStaleSections] = useState<Set<string>>(new Set());
  const [currentExtractedData, setCurrentExtractedData] = useState(extractedData);

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
      // Clear stale flag when section is regenerated
      setStaleSections((prev) => {
        const next = new Set(prev);
        next.delete(sectionId);
        return next;
      });
    },
    []
  );

  const handleDataUpdate = useCallback(
    async (updatedData: ExtractedData, changedPaths: string[]) => {
      try {
        const res = await fetch(`/api/memos/${memoId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extractedData: updatedData, changedPaths }),
        });
        if (!res.ok) throw new Error("Save failed");

        const result = await res.json();
        setCurrentExtractedData(updatedData);
        if (result.staleSections?.length > 0) {
          setStaleSections(new Set(result.staleSections));
        }
      } catch (err) {
        console.error("Failed to update extracted data:", err);
      }
    },
    [memoId]
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
                  extractedData={currentExtractedData}
                  classification={classification}
                  memoId={memoId}
                  onDataUpdate={handleDataUpdate}
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

          {/* Financial Models (LBO/DCF) */}
          {memo.financialModels && (memo.financialModels.lbo || memo.financialModels.dcf) && (
            <div className="mb-8">
              <FinancialModels modelData={memo.financialModels} memoId={memoId} />
            </div>
          )}

          {/* Hidden file input for adding documents */}
          <input
            ref={addDocInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleAddDocument(f);
              e.target.value = "";
            }}
          />

          {/* Source Documents */}
          <div className="mb-8 print:hidden">
            {sourceDocs.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Source Documents ({sourceDocs.length})
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isAddingDoc}
                    onClick={() => addDocInputRef.current?.click()}
                  >
                    {isAddingDoc ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="mr-1 h-3.5 w-3.5" />
                    )}
                    Add Document
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sourceDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5"
                    >
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{doc.fileName}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {sourceDocs.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={isAddingDoc}
                onClick={() => addDocInputRef.current?.click()}
              >
                {isAddingDoc ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-3.5 w-3.5" />
                )}
                Add Supporting Document
              </Button>
            )}
            {isAddingDoc && (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Processing document and regenerating memo...
              </p>
            )}
          </div>

          {/* SEC EDGAR Search */}
          <div className="mb-8 print:hidden">
            <EdgarSearch
              memoId={memoId}
              companyName={memo.metrics.company_name}
              onMemoUpdate={(updatedMemo) => {
                setMemo(updatedMemo);
                // Refresh source docs
                fetch(`/api/memos/${memoId}/documents`)
                  .then((r) => (r.ok ? r.json() : []))
                  .then(setSourceDocs)
                  .catch(() => {});
              }}
            />
          </div>

          {/* Memo Sections */}
          <div className="space-y-6">
            {memo.sections.map((section) => (
              <MemoSection
                key={section.id}
                section={section}
                memoId={memoId}
                onUpdate={handleSectionUpdate}
                stale={staleSections.has(section.id)}
              />
            ))}
          </div>

          {/* Risk Flags */}
          <div className="mt-8">
            <RiskFlags risks={memo.risk_flags} />
          </div>

          {/* Sensitivity Analysis */}
          {memo.financialModels && (memo.financialModels.lbo || memo.financialModels.dcf) && (
            <div className="mt-8">
              <SensitivityTables modelData={memo.financialModels} />
            </div>
          )}

          {/* Investment Screening */}
          <div className="mt-8 print:hidden">
            <InvestmentScorecard memoId={memoId} />
          </div>
        </main>

        {/* Right sidebar: Raw data */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 overflow-auto border-l border-border p-4 xl:block print:hidden">
          <RawDataPanel
            extractedData={currentExtractedData}
            classification={classification}
            memoId={memoId}
            onDataUpdate={handleDataUpdate}
          />
        </aside>
      </div>
    </div>
  );
}
