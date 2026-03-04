"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { ConfidenceIndicator } from "./ConfidenceIndicator";
import { RefreshCw, Pencil, Check, X, Loader2, AlertTriangle } from "lucide-react";
import type { MemoSection as MemoSectionType } from "@/types";

function CitationText({ children }: { children: string }) {
  const parts = children.split(/(\[p\.\d+(?:[-–]\d+)?(?:,\s*[^\]]+)?\])/g);
  if (parts.length === 1) return <>{children}</>;

  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[p\.(\d+(?:[-–]\d+)?)(?:,\s*(.+))?\]$/);
        if (!match) return <span key={i}>{part}</span>;
        const page = match[1];
        const section = match[2] ?? "";
        return (
          <span
            key={i}
            className="inline-flex cursor-pointer items-baseline rounded bg-primary/10 px-1 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            title={`Source: Page ${page}${section ? `, ${section}` : ""}`}
            onClick={() => {
              const rawPanel = document.querySelector("[data-raw-panel]");
              if (rawPanel) {
                rawPanel.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
          >
            p.{page}
          </span>
        );
      })}
    </>
  );
}

interface MemoSectionProps {
  section: MemoSectionType;
  memoId: string;
  onUpdate: (sectionId: string, content: string, confidence: number) => void;
}

export function MemoSection({ section, memoId, onUpdate }: MemoSectionProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(section.content);
  const [regenerating, setRegenerating] = useState(false);

  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/memos/${memoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_id: section.id,
          content: editContent,
          confidence_score: section.confidence_score,
        }),
      });
      onUpdate(section.id, editContent, section.confidence_score);
      setEditing(false);
    } catch (err) {
      console.error("Failed to save section:", err);
    } finally {
      setSaving(false);
    }
  }, [editContent, onUpdate, section.id, section.confidence_score, memoId]);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      const response = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo_id: memoId, section_id: section.id }),
      });

      if (!response.ok) throw new Error("Regeneration failed");

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";
      let newContent = "";

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
            const data = JSON.parse(dataMatch[1]);
            if (data.text) newContent += data.text;
            if (data.done && data.section) {
              onUpdate(section.id, data.section.content, data.section.confidence_score);
            }
          } catch {
            // skip
          }
        }
      }
    } catch (err) {
      console.error("Regeneration error:", err);
    } finally {
      setRegenerating(false);
    }
  }, [memoId, section.id, onUpdate]);

  return (
    <div id={section.id} className="scroll-mt-24">
      <div className="group relative rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-sm">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-primary">{section.title}</h2>
            <ConfidenceIndicator score={section.confidence_score} />
          </div>
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {!editing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditContent(section.content);
                    setEditing(true);
                  }}
                  disabled={regenerating}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                >
                  {regenerating ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  )}
                  Regenerate
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Verification Warnings */}
        {section.verification_flags && section.verification_flags.length > 0 && (
          <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-warning mb-1">
              <AlertTriangle className="h-4 w-4" />
              Verification Flags
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
              {section.verification_flags.map((flag, i) => (
                <li key={i}>{flag}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Content */}
        {editing ? (
          <div className="space-y-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[200px] w-full rounded-lg border border-input bg-background p-4 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1 h-3.5 w-3.5" />
                )}
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none text-foreground prose-headings:text-primary prose-strong:text-foreground prose-li:text-foreground">
            {regenerating ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Regenerating section...
              </div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <div className="overflow-x-auto rounded-lg border border-border my-4">
                      <table>{children}</table>
                    </div>
                  ),
                  p: ({ children }) => (
                    <p>
                      {Array.isArray(children)
                        ? children.map((child, i) =>
                            typeof child === "string" ? (
                              <CitationText key={i}>{child}</CitationText>
                            ) : (
                              child
                            )
                          )
                        : typeof children === "string"
                          ? <CitationText>{children}</CitationText>
                          : children}
                    </p>
                  ),
                  li: ({ children }) => (
                    <li>
                      {Array.isArray(children)
                        ? children.map((child, i) =>
                            typeof child === "string" ? (
                              <CitationText key={i}>{child}</CitationText>
                            ) : (
                              child
                            )
                          )
                        : typeof children === "string"
                          ? <CitationText>{children}</CitationText>
                          : children}
                    </li>
                  ),
                }}
              >
                {section.content}
              </ReactMarkdown>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
