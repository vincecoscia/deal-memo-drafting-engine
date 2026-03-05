"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Grid3x3 } from "lucide-react";
import type { FinancialModelData } from "@/lib/financial-models";
import { generateLBOSensitivity, generateDCFSensitivity, type SensitivityGrid } from "@/lib/financial-models/sensitivity";

interface SensitivityTablesProps {
  modelData: FinancialModelData;
}

function formatCellValue(value: number, metric: string): string {
  if (metric === "IRR") return `${(value * 100).toFixed(1)}%`;
  if (metric === "MOIC") return `${value.toFixed(2)}x`;
  if (metric.includes("$")) {
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}B`;
    return `$${value.toFixed(0)}M`;
  }
  return value.toFixed(2);
}

function getCellColor(value: number, metric: string): string {
  if (metric === "IRR") {
    if (value >= 0.25) return "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200";
    if (value >= 0.20) return "bg-green-50 dark:bg-green-900/50 text-green-700 dark:text-green-300";
    if (value >= 0.15) return "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200";
    if (value >= 0.10) return "bg-orange-50 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200";
    return "bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200";
  }
  if (metric === "MOIC") {
    if (value >= 3.0) return "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200";
    if (value >= 2.5) return "bg-green-50 dark:bg-green-900/50 text-green-700 dark:text-green-300";
    if (value >= 2.0) return "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200";
    if (value >= 1.5) return "bg-orange-50 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200";
    return "bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200";
  }
  // EV — higher is better (more neutral colors)
  return "";
}

function formatAxisValue(value: number, label: string): string {
  if (label.includes("Multiple")) return `${value.toFixed(1)}x`;
  if (label === "WACC" || label.includes("Growth")) return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(2);
}

function SensitivityTable({ grid }: { grid: SensitivityGrid }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">{grid.metric}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-1.5 text-left text-muted-foreground border border-border bg-muted/30">
                {grid.rowLabel} \ {grid.colLabel}
              </th>
              {grid.colValues.map((cv, i) => (
                <th key={i} className="p-1.5 text-center font-mono border border-border bg-muted/30">
                  {formatAxisValue(cv, grid.colLabel)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rowValues.map((rv, ri) => (
              <tr key={ri}>
                <td className="p-1.5 font-mono font-medium border border-border bg-muted/30">
                  {formatAxisValue(rv, grid.rowLabel)}
                </td>
                {grid.colValues.map((_, ci) => {
                  const val = grid.data[ri][ci];
                  return (
                    <td
                      key={ci}
                      className={`p-1.5 text-center font-mono border border-border ${getCellColor(val, grid.metric)}`}
                    >
                      {formatCellValue(val, grid.metric)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SensitivityTables({ modelData }: SensitivityTablesProps) {
  const lboSensitivity = useMemo(
    () => modelData.lbo ? generateLBOSensitivity(modelData.lbo.inputs) : null,
    [modelData.lbo]
  );

  const dcfSensitivity = useMemo(
    () => modelData.dcf ? generateDCFSensitivity(modelData.dcf.inputs) : null,
    [modelData.dcf]
  );

  if (!lboSensitivity && !dcfSensitivity) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Grid3x3 className="h-4 w-4" />
          Sensitivity Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {lboSensitivity && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              LBO Returns — Entry vs Exit Multiple
            </h3>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <SensitivityTable grid={lboSensitivity.irr} />
              <SensitivityTable grid={lboSensitivity.moic} />
            </div>
          </div>
        )}
        {dcfSensitivity && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              DCF Valuation — WACC vs Terminal Growth
            </h3>
            <SensitivityTable grid={dcfSensitivity} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
