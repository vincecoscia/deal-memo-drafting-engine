"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import type { ExtractedData, ClassificationResult } from "@/types";

interface RawDataPanelProps {
  extractedData: ExtractedData;
  classification: ClassificationResult;
}

function JsonViewer({ data }: { data: object }) {
  return (
    <pre className="overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-xs font-mono leading-relaxed text-foreground">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function RawDataPanel({
  extractedData,
  classification,
}: RawDataPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(
      JSON.stringify(extractedData, null, 2)
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full flex-col" data-raw-panel>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Raw Data
        </p>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7">
          {copied ? (
            <Check className="mr-1 h-3 w-3" />
          ) : (
            <Copy className="mr-1 h-3 w-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <Tabs defaultValue="extracted" className="flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="extracted" className="flex-1 text-xs">
            Extracted
          </TabsTrigger>
          <TabsTrigger value="classification" className="flex-1 text-xs">
            Classification
          </TabsTrigger>
        </TabsList>
        <TabsContent value="extracted" className="mt-3 max-h-[calc(100vh-240px)] overflow-auto">
          <JsonViewer data={extractedData} />
        </TabsContent>
        <TabsContent value="classification" className="mt-3">
          <JsonViewer data={classification} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
