"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, ChevronDown, ChevronUp, Edit2, Check, Download } from "lucide-react";
import {
  computeLBO,
  computeDCF,
  type LBOInputs,
  type LBOOutputs,
  type DCFInputs,
  type DCFOutputs,
  type FinancialModelData,
} from "@/lib/financial-models";

interface FinancialModelsProps {
  modelData: FinancialModelData;
  memoId: string;
}

function formatCurrency(val: number): string {
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(1)}B`;
  if (Math.abs(val) >= 1) return `$${val.toFixed(1)}M`;
  return `$${(val * 1000).toFixed(0)}K`;
}

function formatPercent(val: number): string {
  return `${(val * 100).toFixed(1)}%`;
}

function formatMultiple(val: number): string {
  return `${val.toFixed(1)}x`;
}

// ── Editable input field ──

function EditableField({
  label,
  value,
  onChange,
  format = "number",
  editing,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  format?: "number" | "percent" | "multiple" | "currency" | "years";
  editing: boolean;
}) {
  const displayValue = useMemo(() => {
    switch (format) {
      case "percent": return formatPercent(value);
      case "multiple": return formatMultiple(value);
      case "currency": return formatCurrency(value);
      case "years": return `${value} years`;
      default: return value.toFixed(2);
    }
  }, [value, format]);

  if (!editing) {
    return (
      <div className="flex justify-between py-1 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{displayValue}</span>
      </div>
    );
  }

  const inputValue = format === "percent" ? (value * 100).toFixed(1) : value.toFixed(2);

  return (
    <div className="flex items-center justify-between py-1 text-sm gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          step="any"
          className="w-20 rounded border border-border bg-background px-2 py-0.5 text-right font-mono text-sm"
          defaultValue={inputValue}
          onBlur={(e) => {
            const raw = parseFloat(e.target.value);
            if (isNaN(raw)) return;
            onChange(format === "percent" ? raw / 100 : raw);
          }}
        />
        {format === "percent" && <span className="text-xs text-muted-foreground">%</span>}
        {format === "multiple" && <span className="text-xs text-muted-foreground">x</span>}
      </div>
    </div>
  );
}

// ── LBO Model Panel ──

function LBOPanel({ initialInputs, initialOutputs, memoId }: { initialInputs: LBOInputs; initialOutputs: LBOOutputs; memoId: string }) {
  const [inputs, setInputs] = useState(initialInputs);
  const [outputs, setOutputs] = useState(initialOutputs);
  const [editing, setEditing] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const updateInput = useCallback((key: keyof LBOInputs, value: number) => {
    setInputs((prev) => {
      const updated = { ...prev, [key]: value };
      setOutputs(computeLBO(updated));
      return updated;
    });
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            LBO Returns Analysis
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(`/api/export/excel?memo_id=${memoId}&model_type=lbo`, "_blank")}
              title="Download Excel"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="ml-1 text-xs">Excel</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(!editing)}
            >
              {editing ? <Check className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
              <span className="ml-1 text-xs">{editing ? "Done" : "Edit"}</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Key outputs */}
        <div className="grid grid-cols-2 gap-4 mb-4 sm:grid-cols-4">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-2xl font-bold text-primary">{formatMultiple(outputs.moic)}</div>
            <div className="text-xs text-muted-foreground">MOIC</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-2xl font-bold text-primary">{formatPercent(outputs.irr)}</div>
            <div className="text-xs text-muted-foreground">IRR</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-2xl font-bold">{formatCurrency(outputs.entryEV)}</div>
            <div className="text-xs text-muted-foreground">Entry EV</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-2xl font-bold">{formatCurrency(outputs.exitEV)}</div>
            <div className="text-xs text-muted-foreground">Exit EV</div>
          </div>
        </div>

        {/* Assumptions */}
        <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entry</h4>
            <EditableField label="Entry Multiple" value={inputs.entryEVMultiple} onChange={(v) => updateInput("entryEVMultiple", v)} format="multiple" editing={editing} />
            <EditableField label="LTM EBITDA" value={inputs.ltmEBITDA} onChange={(v) => updateInput("ltmEBITDA", v)} format="currency" editing={editing} />
            <EditableField label="Leverage" value={inputs.leverageMultiple} onChange={(v) => updateInput("leverageMultiple", v)} format="multiple" editing={editing} />
            <EditableField label="Interest Rate" value={inputs.interestRate} onChange={(v) => updateInput("interestRate", v)} format="percent" editing={editing} />
          </div>
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operating</h4>
            <EditableField label="Revenue Growth" value={inputs.revenueGrowthRate} onChange={(v) => updateInput("revenueGrowthRate", v)} format="percent" editing={editing} />
            <EditableField label="EBITDA Margin" value={inputs.ebitdaMargin} onChange={(v) => updateInput("ebitdaMargin", v)} format="percent" editing={editing} />
            <EditableField label="Exit Multiple" value={inputs.exitMultiple} onChange={(v) => updateInput("exitMultiple", v)} format="multiple" editing={editing} />
            <EditableField label="Hold Period" value={inputs.holdPeriod} onChange={(v) => updateInput("holdPeriod", v)} format="years" editing={editing} />
          </div>
        </div>

        {/* Debt schedule toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full text-xs text-muted-foreground"
          onClick={() => setShowSchedule(!showSchedule)}
        >
          {showSchedule ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
          {showSchedule ? "Hide" : "Show"} Debt Schedule
        </Button>

        {showSchedule && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-1 text-left">Year</th>
                  <th className="py-1 text-right">Revenue</th>
                  <th className="py-1 text-right">EBITDA</th>
                  <th className="py-1 text-right">FCF</th>
                  <th className="py-1 text-right">Debt</th>
                  <th className="py-1 text-right">Leverage</th>
                </tr>
              </thead>
              <tbody>
                {outputs.debtSchedule.map((row) => (
                  <tr key={row.year} className="border-b border-border/50">
                    <td className="py-1">{row.year}</td>
                    <td className="py-1 text-right font-mono">{formatCurrency(row.revenue)}</td>
                    <td className="py-1 text-right font-mono">{formatCurrency(row.ebitda)}</td>
                    <td className="py-1 text-right font-mono">{formatCurrency(row.fcf)}</td>
                    <td className="py-1 text-right font-mono">{formatCurrency(row.endingDebt)}</td>
                    <td className="py-1 text-right font-mono">{formatMultiple(row.leverageRatio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── DCF Model Panel ──

function DCFPanel({ initialInputs, initialOutputs, memoId }: { initialInputs: DCFInputs; initialOutputs: DCFOutputs; memoId: string }) {
  const [inputs, setInputs] = useState(initialInputs);
  const [outputs, setOutputs] = useState(initialOutputs);
  const [editing, setEditing] = useState(false);
  const [showProjections, setShowProjections] = useState(false);

  const updateInput = useCallback((key: keyof DCFInputs, value: number) => {
    setInputs((prev) => {
      const updated = { ...prev, [key]: value };
      setOutputs(computeDCF(updated));
      return updated;
    });
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            DCF Valuation
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(`/api/export/excel?memo_id=${memoId}&model_type=dcf`, "_blank")}
              title="Download Excel"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="ml-1 text-xs">Excel</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(!editing)}
            >
              {editing ? <Check className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
              <span className="ml-1 text-xs">{editing ? "Done" : "Edit"}</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Key outputs */}
        <div className="grid grid-cols-2 gap-4 mb-4 sm:grid-cols-4">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-2xl font-bold text-primary">{formatCurrency(outputs.enterpriseValue)}</div>
            <div className="text-xs text-muted-foreground">Enterprise Value</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-2xl font-bold text-primary">{formatCurrency(outputs.equityValue)}</div>
            <div className="text-xs text-muted-foreground">Equity Value</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-2xl font-bold">{formatPercent(outputs.terminalValuePctOfEV)}</div>
            <div className="text-xs text-muted-foreground">TV % of EV</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-2xl font-bold">{formatMultiple(outputs.impliedExitMultiple)}</div>
            <div className="text-xs text-muted-foreground">Implied Exit Multiple</div>
          </div>
        </div>

        {/* Assumptions */}
        <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key Assumptions</h4>
            <EditableField label="WACC" value={inputs.wacc} onChange={(v) => updateInput("wacc", v)} format="percent" editing={editing} />
            <EditableField label="Terminal Growth" value={inputs.terminalGrowthRate} onChange={(v) => updateInput("terminalGrowthRate", v)} format="percent" editing={editing} />
            <EditableField label="EBITDA Margin" value={inputs.ebitdaMargin} onChange={(v) => updateInput("ebitdaMargin", v)} format="percent" editing={editing} />
            <EditableField label="Tax Rate" value={inputs.taxRate} onChange={(v) => updateInput("taxRate", v)} format="percent" editing={editing} />
          </div>
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Capital</h4>
            <EditableField label="Capex % Rev" value={inputs.capexPctRevenue} onChange={(v) => updateInput("capexPctRevenue", v)} format="percent" editing={editing} />
            <EditableField label="D&A % Rev" value={inputs.daPercOfRevenue} onChange={(v) => updateInput("daPercOfRevenue", v)} format="percent" editing={editing} />
            <EditableField label="NWC % Rev Chg" value={inputs.nwcPctRevenue} onChange={(v) => updateInput("nwcPctRevenue", v)} format="percent" editing={editing} />
            <EditableField label="Net Debt" value={inputs.netDebt} onChange={(v) => updateInput("netDebt", v)} format="currency" editing={editing} />
          </div>
        </div>

        {/* Projections toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full text-xs text-muted-foreground"
          onClick={() => setShowProjections(!showProjections)}
        >
          {showProjections ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
          {showProjections ? "Hide" : "Show"} FCF Projections
        </Button>

        {showProjections && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-1 text-left">Year</th>
                  <th className="py-1 text-right">Revenue</th>
                  <th className="py-1 text-right">Growth</th>
                  <th className="py-1 text-right">EBITDA</th>
                  <th className="py-1 text-right">FCF</th>
                  <th className="py-1 text-right">PV(FCF)</th>
                </tr>
              </thead>
              <tbody>
                {outputs.projections.map((row) => (
                  <tr key={row.year} className="border-b border-border/50">
                    <td className="py-1">{row.year}</td>
                    <td className="py-1 text-right font-mono">{formatCurrency(row.revenue)}</td>
                    <td className="py-1 text-right font-mono">{formatPercent(row.revenueGrowth)}</td>
                    <td className="py-1 text-right font-mono">{formatCurrency(row.ebitda)}</td>
                    <td className="py-1 text-right font-mono">{formatCurrency(row.fcf)}</td>
                    <td className="py-1 text-right font-mono">{formatCurrency(row.pvFCF)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 font-medium">
                  <td className="py-1" colSpan={4}>Terminal Value</td>
                  <td className="py-1 text-right font-mono">{formatCurrency(outputs.terminalValue)}</td>
                  <td className="py-1 text-right font-mono">{formatCurrency(outputs.pvOfTerminalValue)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ──

export function FinancialModels({ modelData, memoId }: FinancialModelsProps) {
  if (!modelData.lbo && !modelData.dcf) return null;

  const [activeTab, setActiveTab] = useState<"lbo" | "dcf">(
    modelData.lbo ? "lbo" : "dcf"
  );

  return (
    <div>
      {/* Tab selector */}
      {modelData.lbo && modelData.dcf && (
        <div className="mb-3 flex gap-1">
          <button
            onClick={() => setActiveTab("lbo")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "lbo"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            LBO Returns
          </button>
          <button
            onClick={() => setActiveTab("dcf")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "dcf"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            DCF Valuation
          </button>
        </div>
      )}

      {activeTab === "lbo" && modelData.lbo && (
        <LBOPanel initialInputs={modelData.lbo.inputs} initialOutputs={modelData.lbo.outputs} memoId={memoId} />
      )}
      {activeTab === "dcf" && modelData.dcf && (
        <DCFPanel initialInputs={modelData.dcf.inputs} initialOutputs={modelData.dcf.outputs} memoId={memoId} />
      )}
    </div>
  );
}
