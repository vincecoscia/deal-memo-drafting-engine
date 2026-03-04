"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { InvestmentScorecard as ScorecardType } from "@/types";

interface InvestmentScorecardProps {
  memoId: string;
}

const RECOMMENDATION_LABELS: Record<string, { label: string; color: string }> = {
  strong_pass: { label: "Strong Pass", color: "text-green-600" },
  pass: { label: "Pass", color: "text-blue-600" },
  conditional_pass: { label: "Conditional Pass", color: "text-amber-600" },
  fail: { label: "Fail", color: "text-red-600" },
};

const DATA_QUALITY_COLORS: Record<string, string> = {
  strong: "bg-green-100 text-green-700",
  moderate: "bg-amber-100 text-amber-700",
  weak: "bg-red-100 text-red-700",
};

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 5) * 100;
  const color =
    score >= 4 ? "bg-green-500" : score >= 3 ? "bg-blue-500" : score >= 2 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-medium w-6 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

export function InvestmentScorecard({ memoId }: InvestmentScorecardProps) {
  const [scorecard, setScorecard] = useState<ScorecardType | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo_id: memoId }),
      });
      if (!response.ok) throw new Error("Scoring failed");
      const data = await response.json();
      setScorecard(data);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setLoading(false);
    }
  }, [memoId]);

  if (!scorecard) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="h-4 w-4" />
            Investment Criteria Screening
          </div>
          <Button size="sm" variant="outline" onClick={handleScore} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Target className="mr-1 h-3.5 w-3.5" />
            )}
            {loading ? "Scoring..." : "Run Screening"}
          </Button>
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  const rec = RECOMMENDATION_LABELS[scorecard.recommendation] ?? {
    label: scorecard.recommendation,
    color: "text-muted-foreground",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Investment Screening</span>
            <span className={`text-sm font-bold ${rec.color}`}>{rec.label}</span>
            <span className="text-xs font-mono text-muted-foreground">
              ({scorecard.overall_score.toFixed(1)}/5.0)
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {expanded && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">{scorecard.summary}</p>

            <div className="space-y-3">
              {scorecard.criteria.map((c) => (
                <div key={c.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{c.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${DATA_QUALITY_COLORS[c.data_quality] ?? ""}`}>
                      {c.data_quality}
                    </span>
                  </div>
                  <ScoreBar score={c.score} />
                  <p className="text-xs text-muted-foreground">{c.rationale}</p>
                </div>
              ))}
            </div>

            <Button size="sm" variant="ghost" onClick={handleScore} disabled={loading}>
              {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Re-score
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
