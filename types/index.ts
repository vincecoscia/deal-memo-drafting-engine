// ── Document Classification ──

export type DocumentType = "cim" | "term_sheet" | "financial_statement";

export interface ClassificationResult {
  document_type: DocumentType;
  deal_sub_type: DealSubType;
  confidence: number;
  reasoning: string;
}

// ── CIM Extraction ──

export interface CIMData {
  company: {
    name: string | null;
    description: string | null;
    headquarters: string | null;
    founded: string | null;
    employees: number | null;
    ownership: string | null;
    industry: string | null;
    sub_industry: string | null;
  };
  deal: {
    type: string | null;
    asking_price: string | null;
    implied_multiple: string | null;
    advisor: string | null;
    process_type: string | null;
  };
  financials: {
    currency: string;
    fiscal_year_end: string | null;
    historical: Array<{
      period: string;
      is_projected: boolean;
      revenue: number | null;
      revenue_growth_pct: number | null;
      gross_profit: number | null;
      gross_margin_pct: number | null;
      ebitda_reported: number | null;
      ebitda_adjusted: number | null;
      ebitda_margin_pct: number | null;
      ebit: number | null;
      net_income: number | null;
      capex: number | null;
      fcf: number | null;
      total_debt: number | null;
      cash: number | null;
    }>;
    ebitda_adjustments: Array<{
      description: string;
      amount: number;
    }>;
    revenue_segments: Array<{
      segment_name: string;
      revenue: number | null;
      pct_of_total: number | null;
    }>;
  };
  customers: {
    total_customers: number | null;
    top_customer_concentration_pct: number | null;
    top_10_concentration_pct: number | null;
    customer_list: Array<{
      name: string;
      pct_of_revenue: number | null;
      relationship_years: number | null;
    }>;
    recurring_revenue_pct: number | null;
    contract_structure: string | null;
    avg_contract_length: string | null;
    retention_rate: number | null;
  };
  management: Array<{
    name: string;
    title: string;
    tenure_years: number | null;
    background: string | null;
  }>;
  market: {
    tam: string | null;
    sam: string | null;
    market_growth_rate: string | null;
    key_trends: string[];
    competitors: Array<{
      name: string;
      description: string | null;
      relative_size: string | null;
    }>;
  };
  growth_opportunities: string[];
  risks: Array<{
    risk: string;
    severity: "high" | "medium" | "low";
    mitigant: string | null;
  }>;
  industry_specific_metrics: {
    metrics: Array<{
      name: string;
      value: string;
      context: string | null;
    }>;
  };
  data_gaps: string[];
  source_pages: {
    executive_summary: string | null;
    financials: string | null;
    customer_data: string | null;
    market_data: string | null;
    management: string | null;
  };
  citations: CitationMap | null;
}

// ── Term Sheet Extraction ──

export interface TermSheetData {
  economic_terms: {
    purchase_price: string | null;
    valuation_methodology: string | null;
    ev_ebitda_multiple: number | null;
    form_of_consideration: string | null;
    seller_notes: string | null;
    earnout_description: string | null;
    rollover_equity_pct: number | null;
    working_capital_target: string | null;
  };
  governance: {
    board_composition: string | null;
    voting_rights: string | null;
    protective_provisions: string[];
    information_rights: string | null;
  };
  management_terms: {
    management_incentive_plan: string | null;
    employment_agreements: string | null;
    non_compete_terms: string | null;
    change_of_control: string | null;
  };
  investor_protections: {
    liquidation_preference: string | null;
    anti_dilution: string | null;
    drag_along: string | null;
    tag_along: string | null;
    registration_rights: string | null;
  };
  deal_process: {
    exclusivity_period: string | null;
    due_diligence_timeline: string | null;
    conditions_to_closing: string[];
    break_up_fee: string | null;
    escrow_terms: string | null;
    indemnification_cap: string | null;
  };
  red_flags: Array<{
    issue: string;
    severity: "high" | "medium" | "low";
    explanation: string;
  }>;
  key_terms_summary: Array<{
    term: string;
    value: string;
  }>;
}

// ── Financial Statement Extraction ──

export interface FinancialData {
  company_name: string | null;
  currency: string;
  periods: string[];
  income_statement: Array<{
    period: string;
    is_projected: boolean;
    revenue: number | null;
    cogs: number | null;
    gross_profit: number | null;
    gross_margin_pct: number | null;
    sga: number | null;
    rd: number | null;
    ebitda: number | null;
    ebitda_adjusted: number | null;
    ebitda_margin_pct: number | null;
    ebit: number | null;
    interest_expense: number | null;
    net_income: number | null;
    revenue_growth_pct: number | null;
  }>;
  balance_sheet: Array<{
    period: string;
    total_assets: number | null;
    total_liabilities: number | null;
    total_equity: number | null;
    cash: number | null;
    net_working_capital: number | null;
    total_debt: number | null;
    accounts_receivable: number | null;
    inventory: number | null;
    accounts_payable: number | null;
  }>;
  cash_flow: Array<{
    period: string;
    operating_cash_flow: number | null;
    capex: number | null;
    free_cash_flow: number | null;
    acquisitions: number | null;
    debt_issuance: number | null;
    dividends: number | null;
  }>;
  computed_metrics: {
    revenue_cagr: number | null;
    avg_ebitda_margin: number | null;
    fcf_conversion: number | null;
    net_leverage: number | null;
    capex_pct_revenue: number | null;
    dso: number | null;
    dpo: number | null;
    dio: number | null;
  };
  quality_of_earnings_flags: string[];
}

// ── Union type for all extracted data ──

export type ExtractedData = CIMData | TermSheetData | FinancialData;

// ── Deal Memo ──

export interface Citation {
  page: string;
  section: string;
}

export interface CitationMap {
  revenue_figures: Array<{ period: string; page: string; section: string }>;
  ebitda_figures: Array<{ period: string; page: string; section: string }>;
  customer_concentration: Citation | null;
  tam_sam: Citation | null;
  management: Citation | null;
  asking_price: Citation | null;
}

export interface MemoSection {
  id: string;
  title: string;
  content: string;
  confidence_score: number;
  verification_flags?: string[];
}

export interface IndustryMetric {
  name: string;
  value: string;
  context: string | null;
}

export type DealSubType = "lbo" | "growth_equity" | "venture" | "unknown";

export type MemoFormat = "concise" | "standard" | "detailed";

export interface DealMemoData {
  metrics: {
    company_name: string | null;
    deal_value: string | null;
    revenue: string | null;
    ebitda: string | null;
    ebitda_margin: string | null;
    revenue_growth: string | null;
    industry: string | null;
    employee_count: string | null;
    industry_metrics: IndustryMetric[] | null;
  };
  sections: MemoSection[];
  risk_flags: Array<{
    description: string;
    severity: "high" | "medium" | "low";
    mitigant: string | null;
  }>;
}

// ── SSE Events ──

export type SSEEvent =
  | { type: "stage"; stage: "classifying" | "extracting" | "generating" | "complete" }
  | { type: "classification"; result: ClassificationResult }
  | { type: "extraction"; data: ExtractedData }
  | { type: "memo_chunk"; text: string }
  | {
      type: "memo_complete";
      memo_id: string;
      memo: DealMemoData;
    }
  | { type: "error"; message: string };

// ── Investment Criteria Scoring ──

export interface InvestmentCriterion {
  name: string;
  score: number; // 1-5
  weight: number; // 0-1
  rationale: string;
  data_quality: "strong" | "moderate" | "weak";
}

export interface InvestmentScorecard {
  overall_score: number; // weighted average 1-5
  recommendation: "strong_pass" | "pass" | "conditional_pass" | "fail";
  criteria: InvestmentCriterion[];
  summary: string;
}

// ── API Request/Response ──

export interface RegenerateRequest {
  memo_id: string;
  section_id: string;
}

export interface MemoListItem {
  id: string;
  documentName: string;
  documentType: string;
  createdAt: string;
}
