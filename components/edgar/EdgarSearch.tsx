"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Search,
  FileText,
  Download,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { FILING_TYPES } from "@/lib/edgar";
import type { DealMemoData } from "@/types";

interface EdgarResult {
  accessionNo: string;
  cik: string;
  companyName: string;
  formType: string;
  filedAt: string;
  documentUrl: string;
  description: string;
}

interface EdgarSearchProps {
  memoId: string;
  companyName?: string | null;
  onMemoUpdate?: (memo: DealMemoData) => void;
}

export function EdgarSearch({ memoId, companyName, onMemoUpdate }: EdgarSearchProps) {
  const [query, setQuery] = useState(companyName ?? "");
  const [formType, setFormType] = useState("");
  const [results, setResults] = useState<EdgarResult[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setResults([]);

    try {
      const params = new URLSearchParams({ q: query });
      if (formType) params.set("type", formType);

      const res = await fetch(`/api/edgar/search?${params.toString()}`);
      if (!res.ok) throw new Error("Search failed");

      const data = await res.json();
      setResults(data.results ?? []);
      setTotalHits(data.totalHits ?? 0);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, [query, formType]);

  const handleImport = useCallback(
    async (result: EdgarResult) => {
      setImporting(result.accessionNo);
      setError(null);

      try {
        const res = await fetch("/api/edgar/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memoId,
            documentUrl: result.documentUrl,
            companyName: result.companyName,
            formType: result.formType,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Import failed");
        }

        const data = await res.json();
        if (data.memo && onMemoUpdate) {
          onMemoUpdate(data.memo);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
      } finally {
        setImporting(null);
      }
    },
    [memoId, onMemoUpdate]
  );

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        className="flex w-full items-center justify-between p-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">SEC EDGAR Filings</h3>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border p-4 space-y-3">
          {/* Search form */}
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search company or filing..."
              className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {FILING_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>
                  {ft.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={handleSearch}
              disabled={searching || !query.trim()}
            >
              {searching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                {totalHits} result{totalHits !== 1 ? "s" : ""} found
              </p>
              <div className="max-h-72 overflow-auto space-y-1">
                {results.map((result) => (
                  <div
                    key={result.accessionNo}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-xs hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="font-medium truncate">
                          {result.companyName}
                        </span>
                        <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-primary">
                          {result.formType}
                        </span>
                      </div>
                      <p className="mt-0.5 text-muted-foreground truncate pl-[18px]">
                        {result.filedAt}
                        {result.description ? ` — ${result.description}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {result.documentUrl && (
                        <a
                          href={result.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded p-1 hover:bg-muted"
                          title="View on SEC.gov"
                        >
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        disabled={importing !== null}
                        onClick={() => handleImport(result)}
                      >
                        {importing === result.accessionNo ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Download className="mr-1 h-3 w-3" />
                            Import
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {!searching && results.length === 0 && totalHits === 0 && query.trim() && (
            <p className="text-xs text-muted-foreground text-center py-2">
              No filings found. Try a different search term.
            </p>
          )}

          {/* Importing indicator */}
          {importing && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Importing filing and regenerating memo...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
