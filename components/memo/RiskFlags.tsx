"use client";

import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type { DealMemoData } from "@/types";

interface RiskFlagsProps {
  risks: DealMemoData["risk_flags"];
}

const SEVERITY_STYLES: Record<string, string> = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-warning/30 bg-warning/10 text-warning",
  low: "border-accent/30 bg-accent/10 text-accent",
};

export function RiskFlags({ risks }: RiskFlagsProps) {
  if (risks.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-primary">
        <AlertTriangle className="h-5 w-5" />
        Risk Flags ({risks.length})
      </h2>
      <div className="space-y-3">
        {risks.map((risk, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/30 p-3"
          >
            <Badge
              variant="outline"
              className={`shrink-0 text-xs ${SEVERITY_STYLES[risk.severity] ?? ""}`}
            >
              {risk.severity.toUpperCase()}
            </Badge>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {risk.description}
              </p>
              {risk.mitigant && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Mitigant: {risk.mitigant}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
