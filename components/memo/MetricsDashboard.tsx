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
} from "lucide-react";

interface MetricsDashboardProps {
  metrics: DealMemoData["metrics"];
}

const METRIC_CONFIG: {
  key: keyof DealMemoData["metrics"];
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
  if (available.length === 0) return null;

  return (
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
  );
}
