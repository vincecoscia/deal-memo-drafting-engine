"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Copy, Check, Printer, Loader2 } from "lucide-react";
import type { DealMemoData } from "@/types";

interface ExportControlsProps {
  memoId: string;
  memo: DealMemoData;
}

export function ExportControls({ memoId, memo }: ExportControlsProps) {
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExportWord = async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo_id: memoId }),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `deal-memo-${memo.metrics.company_name?.replace(/[^a-zA-Z0-9]/g, "_") ?? "export"}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    const text = memo.sections
      .map((s) => `# ${s.title}\n\n${s.content}`)
      .join("\n\n---\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportWord}
        disabled={exporting}
      >
        {exporting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Export Word
      </Button>
      <Button variant="outline" size="sm" onClick={handleCopy}>
        {copied ? (
          <Check className="mr-2 h-4 w-4" />
        ) : (
          <Copy className="mr-2 h-4 w-4" />
        )}
        {copied ? "Copied" : "Copy"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.print()}
      >
        <Printer className="mr-2 h-4 w-4" />
        Print
      </Button>
    </div>
  );
}
