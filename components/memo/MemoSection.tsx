"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { ConfidenceIndicator } from "./ConfidenceIndicator";
import { RefreshCw, Pencil, Check, X, Loader2 } from "lucide-react";
import type { MemoSection as MemoSectionType } from "@/types";

interface MemoSectionProps {
  section: MemoSectionType;
  memoId: string;
  onUpdate: (sectionId: string, content: string, confidence: number) => void;
}

export function MemoSection({ section, memoId, onUpdate }: MemoSectionProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(section.content);
  const [regenerating, setRegenerating] = useState(false);

  const handleSave = useCallback(() => {
    onUpdate(section.id, editContent, section.confidence_score);
    setEditing(false);
  }, [editContent, onUpdate, section.id, section.confidence_score]);

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

        {/* Content */}
        {editing ? (
          <div className="space-y-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[200px] w-full rounded-lg border border-input bg-background p-4 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>
                <Check className="mr-1 h-3.5 w-3.5" />
                Save
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
