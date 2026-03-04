"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Copy, Check, Printer, Loader2, FileDown } from "lucide-react";
import type { DealMemoData } from "@/types";

interface ExportControlsProps {
  memoId: string;
  memo: DealMemoData;
}

export function ExportControls({ memoId, memo }: ExportControlsProps) {
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
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

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const mainContent = document.querySelector("main");
      if (!mainContent) throw new Error("Could not find main content");

      const canvas = await html2canvas(mainContent as HTMLElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF("p", "mm", "a4");
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const companyName = memo.metrics.company_name?.replace(/[^a-zA-Z0-9]/g, "_") ?? "export";
      pdf.save(`deal-memo-${companyName}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      setExportingPdf(false);
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
        Word
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportPdf}
        disabled={exportingPdf}
      >
        {exportingPdf ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="mr-2 h-4 w-4" />
        )}
        PDF
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
