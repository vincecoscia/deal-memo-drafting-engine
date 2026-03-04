"use client";

import { Badge } from "@/components/ui/badge";

interface ConfidenceIndicatorProps {
  score: number;
}

export function ConfidenceIndicator({ score }: ConfidenceIndicatorProps) {
  const pct = Math.round(score * 100);

  if (score >= 0.85) {
    return (
      <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-xs">
        High ({pct}%)
      </Badge>
    );
  }

  if (score >= 0.65) {
    return (
      <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning text-xs">
        Medium ({pct}%)
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-xs">
      Low ({pct}%)
    </Badge>
  );
}
