"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import type { CIMData } from "@/types";

interface FinancialChartsProps {
  financials: CIMData["financials"];
}

export function FinancialCharts({ financials }: FinancialChartsProps) {
  const historical = financials.historical
    .filter((h) => !h.is_projected)
    .sort((a, b) => a.period.localeCompare(b.period));

  if (historical.length < 2) return null;

  const revenueData = historical
    .filter((h) => h.revenue !== null)
    .map((h) => ({
      period: h.period,
      Revenue: h.revenue,
      "Revenue Growth": h.revenue_growth_pct,
    }));

  const ebitdaData = historical
    .filter((h) => (h.ebitda_adjusted ?? h.ebitda_reported) !== null)
    .map((h) => ({
      period: h.period,
      EBITDA: h.ebitda_adjusted ?? h.ebitda_reported,
      "EBITDA Margin": h.ebitda_margin_pct,
    }));

  if (revenueData.length < 2 && ebitdaData.length < 2) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 print:hidden">
      {revenueData.length >= 2 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              Revenue Trend ($M)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="Revenue"
                  fill="oklch(0.623 0.214 259.815)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {ebitdaData.length >= 2 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              EBITDA Trend ($M) & Margin (%)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={ebitdaData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} unit="%" />
                <Tooltip />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="EBITDA"
                  fill="oklch(0.723 0.191 149.579)"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="EBITDA Margin"
                  stroke="oklch(0.705 0.213 47.604)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
