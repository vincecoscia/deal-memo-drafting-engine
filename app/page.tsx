"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DropZone } from "@/components/upload/DropZone";
import { ProcessingStages } from "@/components/upload/ProcessingStages";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSession, signOut } from "@/lib/auth-client";
import { FileText, LogOut, Loader2, Clock, Trash2 } from "lucide-react";
import type { SSEEvent, ClassificationResult, MemoListItem, MemoFormat } from "@/types";

type ProcessingStage =
  | "idle"
  | "classifying"
  | "extracting"
  | "generating"
  | "complete";

const FORMAT_OPTIONS: { value: MemoFormat; label: string; desc: string }[] = [
  { value: "concise", label: "Concise", desc: "2-3 page IC screening memo" },
  { value: "standard", label: "Standard", desc: "8-12 page screening memo" },
  { value: "detailed", label: "Detailed", desc: "25+ page full diligence memo" },
];

export default function HomePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [classification, setClassification] =
    useState<ClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentMemos, setRecentMemos] = useState<MemoListItem[]>([]);
  const [memoFormat, setMemoFormat] = useState<MemoFormat>("standard");

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/sign-in");
    }
  }, [isPending, session, router]);

  useEffect(() => {
    if (session) {
      fetch("/api/memos")
        .then((r) => (r.ok ? r.json() : []))
        .then(setRecentMemos)
        .catch(() => {});
    }
  }, [session]);

  const handleAnalyze = useCallback(async () => {
    if (!file) return;
    setError(null);
    setStage("classifying");
    setClassification(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("memo_format", memoFormat);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        setError(`Upload failed: ${response.statusText}`);
        setStage("idle");
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError("Streaming not supported");
        setStage("idle");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const dataMatch = line.match(/^data: (.+)$/m);
          if (!dataMatch) continue;

          try {
            const event = JSON.parse(dataMatch[1]) as SSEEvent;

            switch (event.type) {
              case "stage":
                setStage(event.stage as ProcessingStage);
                break;
              case "classification":
                setClassification(event.result);
                break;
              case "memo_complete":
                router.push(`/memo/${event.memo_id}`);
                return;
              case "error":
                setError(event.message);
                setStage("idle");
                return;
            }
          } catch {
            // skip malformed SSE events
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setStage("idle");
    }
  }, [file, router, memoFormat]);

  const isProcessing = stage !== "idle";

  const docTypeLabel: Record<string, string> = {
    cim: "CIM",
    term_sheet: "Term Sheet",
    financial_statement: "Financial",
  };

  const dealSubTypeLabel: Record<string, string> = {
    lbo: "LBO",
    growth_equity: "Growth Equity",
    venture: "Venture",
    unknown: "",
  };

  if (isPending || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary p-2">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-primary">
              Deal Memo Engine
            </h1>
          </div>
          {session && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {session.user.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  signOut({
                    fetchOptions: {
                      onSuccess: () => router.push("/sign-in"),
                    },
                  })
                }
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Upload a Deal Document
          </h2>
          <p className="mt-2 text-muted-foreground">
            Drop a CIM, term sheet, or financial statement — get a screening
            memo in minutes.
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <DropZone
              onFile={setFile}
              disabled={isProcessing}
              selectedFile={file}
              onClear={() => {
                setFile(null);
                setStage("idle");
                setClassification(null);
                setError(null);
              }}
            />

            {/* Memo Format Selector */}
            {file && !isProcessing && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-muted-foreground mb-2 text-center">
                  Memo Format
                </label>
                <div className="flex justify-center gap-2">
                  {FORMAT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setMemoFormat(opt.value)}
                      className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                        memoFormat === opt.value
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs opacity-70">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isProcessing && (
              <ProcessingStages
                currentStage={
                  stage as
                    | "classifying"
                    | "extracting"
                    | "generating"
                    | "complete"
                }
                classification={classification}
              />
            )}

            {/* Classification result with deal sub-type */}
            {isProcessing && classification && classification.deal_sub_type && classification.deal_sub_type !== "unknown" && (
              <div className="mt-2 flex justify-center">
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                  {dealSubTypeLabel[classification.deal_sub_type] ?? classification.deal_sub_type}
                </span>
              </div>
            )}

            {error && (
              <p className="mt-4 text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            {file && !isProcessing && (
              <div className="mt-6 flex justify-center">
                <Button size="lg" onClick={handleAnalyze} className="px-8">
                  Generate Deal Memo
                </Button>
              </div>
            )}

            {isProcessing && stage !== "complete" && (
              <div className="mt-4 flex justify-center">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  This typically takes 30–90 seconds
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent memos */}
        {recentMemos.length > 0 && (
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock className="h-4 w-4" />
              Recent Memos
            </h3>
            <div className="space-y-2">
              {recentMemos.map((memo) => (
                <Card
                  key={memo.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => router.push(`/memo/${memo.id}`)}
                >
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {memo.documentName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="rounded bg-muted px-2 py-0.5 font-mono">
                        {docTypeLabel[memo.documentType] ?? memo.documentType}
                      </span>
                      <span>
                        {new Date(memo.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!confirm("Delete this memo? This cannot be undone.")) return;
                          fetch(`/api/memos/${memo.id}`, { method: "DELETE" })
                            .then((r) => {
                              if (r.ok) setRecentMemos((prev) => prev.filter((m) => m.id !== memo.id));
                            });
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Delete memo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
