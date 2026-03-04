import type {
  MemoSection,
  DealMemoData,
  CIMData,
  TermSheetData,
  FinancialData,
  ExtractedData,
  DocumentType,
} from "@/types";

const SECTION_TITLES: Record<string, string> = {
  executive_summary: "Executive Summary",
  transaction_overview: "Transaction Overview",
  company_overview: "Company Overview",
  products_and_services: "Products & Services",
  customer_and_supplier_analysis: "Customer & Supplier Analysis",
  operations: "Operations",
  management_team: "Management Team",
  market_and_competitive_position: "Market & Competitive Position",
  financial_overview: "Financial Overview",
  investment_highlights: "Investment Highlights",
  key_risks: "Key Risks & Mitigants",
  value_creation_strategy: "Value Creation Strategy",
  valuation_context: "Preliminary Valuation Context",
  deal_structure_and_financing: "Deal Structure & Financing",
  exit_strategy: "Exit Strategy",
  due_diligence_status: "Due Diligence Status",
  next_steps: "Recommended Next Steps",
};

export function parseMemoText(rawText: string): MemoSection[] {
  const sections: MemoSection[] = [];
  const sectionRegex = /## SECTION:\s*(\w+)\s*\n([\s\S]*?)(?=## SECTION:|$)/g;

  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(rawText)) !== null) {
    const id = match[1];
    let content = match[2].trim();

    // Extract confidence score
    let confidence = 0.7; // default
    const confidenceMatch = content.match(/\[CONFIDENCE:\s*([\d.]+)\]/);
    if (confidenceMatch) {
      confidence = parseFloat(confidenceMatch[1]);
      content = content.replace(/\[CONFIDENCE:\s*[\d.]+\]/, "").trim();
    }

    sections.push({
      id,
      title: SECTION_TITLES[id] ?? id,
      content,
      confidence_score: confidence,
    });
  }

  return sections;
}

function isCIM(data: ExtractedData): data is CIMData {
  return "company" in data && "financials" in data;
}

function isTermSheet(data: ExtractedData): data is TermSheetData {
  return "economic_terms" in data && "red_flags" in data;
}

function isFinancial(data: ExtractedData): data is FinancialData {
  return "income_statement" in data && "computed_metrics" in data;
}

function extractMetrics(
  data: ExtractedData,
  documentType: DocumentType
): DealMemoData["metrics"] {
  const metrics: DealMemoData["metrics"] = {
    company_name: null,
    deal_value: null,
    revenue: null,
    ebitda: null,
    ebitda_margin: null,
    revenue_growth: null,
    industry: null,
    employee_count: null,
    industry_metrics: null,
  };

  if (documentType === "cim" && isCIM(data)) {
    metrics.company_name = data.company.name;
    metrics.industry = data.company.industry;
    metrics.employee_count = data.company.employees?.toString() ?? null;
    metrics.deal_value = data.deal.asking_price;

    const latest = data.financials.historical
      .filter((h) => !h.is_projected)
      .sort((a, b) => b.period.localeCompare(a.period))[0];

    if (latest) {
      metrics.revenue = latest.revenue ? `$${latest.revenue}M` : null;
      metrics.ebitda = (latest.ebitda_adjusted ?? latest.ebitda_reported)
        ? `$${latest.ebitda_adjusted ?? latest.ebitda_reported}M`
        : null;
      metrics.ebitda_margin = latest.ebitda_margin_pct
        ? `${latest.ebitda_margin_pct}%`
        : null;
      metrics.revenue_growth = latest.revenue_growth_pct
        ? `${latest.revenue_growth_pct}%`
        : null;
    }

    // Surface industry-specific metrics
    if (
      data.industry_specific_metrics?.metrics &&
      data.industry_specific_metrics.metrics.length > 0
    ) {
      metrics.industry_metrics = data.industry_specific_metrics.metrics;
    }
  } else if (documentType === "term_sheet" && isTermSheet(data)) {
    metrics.deal_value = data.economic_terms.purchase_price;
  } else if (documentType === "financial_statement" && isFinancial(data)) {
    metrics.company_name = data.company_name;

    const latest = data.income_statement
      .filter((p) => !p.is_projected)
      .sort((a, b) => b.period.localeCompare(a.period))[0];

    if (latest) {
      metrics.revenue = latest.revenue ? `$${latest.revenue}M` : null;
      metrics.ebitda = (latest.ebitda_adjusted ?? latest.ebitda)
        ? `$${latest.ebitda_adjusted ?? latest.ebitda}M`
        : null;
      metrics.ebitda_margin = latest.ebitda_margin_pct
        ? `${latest.ebitda_margin_pct}%`
        : null;
      metrics.revenue_growth = latest.revenue_growth_pct
        ? `${latest.revenue_growth_pct}%`
        : null;
    }
  }

  return metrics;
}

function extractRiskFlags(
  data: ExtractedData,
  documentType: DocumentType
): DealMemoData["risk_flags"] {
  if (documentType === "cim" && isCIM(data)) {
    return data.risks.map((r) => ({
      description: r.risk,
      severity: r.severity,
      mitigant: r.mitigant,
    }));
  }

  if (documentType === "term_sheet" && isTermSheet(data)) {
    return data.red_flags.map((r) => ({
      description: r.issue,
      severity: r.severity,
      mitigant: r.explanation,
    }));
  }

  if (documentType === "financial_statement" && isFinancial(data)) {
    return data.quality_of_earnings_flags.map((f) => ({
      description: f,
      severity: "medium" as const,
      mitigant: null,
    }));
  }

  return [];
}

export function buildMemoData(
  rawMemoText: string,
  extractedData: ExtractedData,
  documentType: DocumentType
): DealMemoData {
  const sections = parseMemoText(rawMemoText);
  const metrics = extractMetrics(extractedData, documentType);
  const risk_flags = extractRiskFlags(extractedData, documentType);

  return { metrics, sections, risk_flags };
}

export function parseSingleSection(rawText: string): MemoSection | null {
  const sections = parseMemoText(rawText);
  return sections[0] ?? null;
}
