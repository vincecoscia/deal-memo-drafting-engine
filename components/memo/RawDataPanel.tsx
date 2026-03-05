"use client";

import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, Check, Save, Loader2 } from "lucide-react";
import type { ExtractedData, ClassificationResult, CIMData } from "@/types";

interface RawDataPanelProps {
  extractedData: ExtractedData;
  classification: ClassificationResult;
  memoId?: string;
  onDataUpdate?: (data: ExtractedData, changedPaths: string[]) => void;
}

function JsonViewer({ data }: { data: object }) {
  return (
    <pre className="overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-xs font-mono leading-relaxed text-foreground">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function EditableField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number | null;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <label className="text-xs text-muted-foreground shrink-0">{label}</label>
      <input
        type={type}
        className="w-28 rounded border border-border bg-background px-2 py-0.5 text-right text-xs font-mono"
        defaultValue={value ?? ""}
        onBlur={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function KeyFieldsEditor({
  extractedData,
  onSave,
}: {
  extractedData: ExtractedData;
  onSave: (data: ExtractedData, changedPaths: string[]) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, string>>({});

  const isCIM = "company" in extractedData && "financials" in extractedData;
  if (!isCIM) return null;

  const cim = extractedData as CIMData;
  const historical = cim.financials?.historical ?? [];
  const latest = [...historical].filter((p) => !p.is_projected).pop();

  const handleChange = useCallback((path: string, value: string) => {
    setChanges((prev) => ({ ...prev, [path]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (Object.keys(changes).length === 0) return;
    setSaving(true);

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const updated = JSON.parse(JSON.stringify(extractedData)) as any;
    const changedPaths: string[] = [];

    for (const [path, value] of Object.entries(changes)) {
      const parts = path.split(".");
      let obj = updated;
      for (let i = 0; i < parts.length - 1; i++) {
        if (obj[parts[i]] == null) break;
        obj = obj[parts[i]];
      }
      const lastKey = parts[parts.length - 1];
      const numVal = parseFloat(value);
      obj[lastKey] = isNaN(numVal) ? value : numVal;
      changedPaths.push(path);
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    onSave(updated as ExtractedData, changedPaths);
    setChanges({});
    setSaving(false);
  }, [changes, extractedData, onSave]);

  const hasChanges = Object.keys(changes).length > 0;

  return (
    <div className="mb-4 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Key Fields
        </p>
        {hasChanges && (
          <Button
            variant="default"
            size="sm"
            className="h-6 text-xs"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-1 h-3 w-3" />
            )}
            Save
          </Button>
        )}
      </div>
      <EditableField
        label="Revenue"
        value={latest?.revenue ?? null}
        onChange={(v) => handleChange("financials.historical.revenue", v)}
        type="number"
      />
      <EditableField
        label="EBITDA"
        value={latest?.ebitda_adjusted ?? latest?.ebitda_reported ?? null}
        onChange={(v) => handleChange("financials.historical.ebitda", v)}
        type="number"
      />
      <EditableField
        label="Deal Value"
        value={cim.deal?.asking_price}
        onChange={(v) => handleChange("deal.asking_price", v)}
      />
      <EditableField
        label="Multiple"
        value={cim.deal?.implied_multiple}
        onChange={(v) => handleChange("deal.implied_multiple", v)}
      />
      <EditableField
        label="Company"
        value={cim.company?.name}
        onChange={(v) => handleChange("company.name", v)}
      />
    </div>
  );
}

export function RawDataPanel({
  extractedData,
  classification,
  memoId,
  onDataUpdate,
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

      {memoId && onDataUpdate && (
        <KeyFieldsEditor
          extractedData={extractedData}
          onSave={onDataUpdate}
        />
      )}

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
