"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { DealMemoData } from "@/types";
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  Users,
  Building2,
  Target,
  Activity,
} from "lucide-react";

interface MetricsDashboardProps {
  metrics: DealMemoData["metrics"];
}

const METRIC_CONFIG: {
  key: keyof Omit<DealMemoData["metrics"], "industry_metrics">;
  label: string;
  icon: React.ElementType;
}[] = [
  { key: "company_name", label: "Company", icon: Building2 },
  { key: "deal_value", label: "Deal Value", icon: Target },
  { key: "revenue", label: "Revenue (LTM)", icon: DollarSign },
  { key: "ebitda", label: "EBITDA", icon: BarChart3 },
  { key: "ebitda_margin", label: "EBITDA Margin", icon: BarChart3 },
  { key: "revenue_growth", label: "Revenue Growth", icon: TrendingUp },
  { key: "industry", label: "Industry", icon: Building2 },
  { key: "employee_count", label: "Employees", icon: Users },
];

export function MetricsDashboard({ metrics }: MetricsDashboardProps) {
  const available = METRIC_CONFIG.filter((m) => metrics[m.key] !== null);
  if (available.length === 0 && !metrics.industry_metrics?.length) return null;

  return (
    <div className="space-y-4">
      {available.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {available.map(({ key, label, icon: Icon }) => (
            <Card key={key} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium uppercase tracking-wider">
                    {label}
                  </span>
                </div>
                <p
                  className={`font-semibold ${key === "company_name" ? "text-lg text-primary" : "text-xl text-foreground"}`}
                >
                  {metrics[key]}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Industry-Specific KPIs */}
      {metrics.industry_metrics && metrics.industry_metrics.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Industry KPIs
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {metrics.industry_metrics.map((metric) => (
              <Card key={metric.name} className="overflow-hidden border-dashed">
                <CardContent className="p-4">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {metric.name}
                  </span>
                  <p className="text-xl font-semibold text-foreground mt-1">
                    {metric.value}
                  </p>
                  {metric.context && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {metric.context}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
