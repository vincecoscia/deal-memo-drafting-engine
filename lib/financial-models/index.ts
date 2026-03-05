import type { ExtractedData, DocumentType, DealSubType, CIMData, FinancialData } from "@/types";
import { computeLBO, getDefaultLBOInputs, type LBOInputs, type LBOOutputs } from "./lbo";
import { computeDCF, getDefaultDCFInputs, type DCFInputs, type DCFOutputs } from "./dcf";

export type { LBOInputs, LBOOutputs, DCFInputs, DCFOutputs };
export { computeLBO, computeDCF };

export interface FinancialModelData {
  lbo?: {
    inputs: LBOInputs;
    outputs: LBOOutputs;
  };
  dcf?: {
    inputs: DCFInputs;
    outputs: DCFOutputs;
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function buildFinancialModels(
  extractedData: ExtractedData,
  documentType: DocumentType,
  dealSubType: DealSubType
): FinancialModelData {
  const result: FinancialModelData = {};

  // Extract key financial metrics
  let ltmRevenue: number | null = null;
  let ltmEBITDA: number | null = null;
  let ebitdaMargin: number | null = null;
  let revenueGrowth: number | null = null;
  let netDebt: number | null = null;
  let entryMultiple: number | null = null;

  if (documentType === "cim") {
    const cim = extractedData as CIMData;
    const historical = cim.financials?.historical ?? [];

    // Get most recent historical (non-projected) period
    const recent = [...historical]
      .filter((p) => !p.is_projected)
      .pop();

    if (recent) {
      ltmRevenue = recent.revenue;
      ltmEBITDA = recent.ebitda_adjusted ?? recent.ebitda_reported;
      ebitdaMargin = recent.ebitda_margin_pct ? recent.ebitda_margin_pct / 100 : null;
      revenueGrowth = recent.revenue_growth_pct ? recent.revenue_growth_pct / 100 : null;
      netDebt = recent.total_debt != null && recent.cash != null
        ? recent.total_debt - recent.cash
        : null;
    }

    // Entry multiple from deal terms
    if (cim.deal?.implied_multiple) {
      const parsed = parseFloat(cim.deal.implied_multiple.replace(/[x×]/i, ""));
      if (!isNaN(parsed)) entryMultiple = parsed;
    }
  } else if (documentType === "financial_statement") {
    const fin = extractedData as FinancialData;
    const recent = [...(fin.income_statement ?? [])].filter((p) => !p.is_projected).pop();

    if (recent) {
      ltmRevenue = recent.revenue;
      ltmEBITDA = recent.ebitda_adjusted ?? recent.ebitda;
      ebitdaMargin = recent.ebitda_margin_pct ? recent.ebitda_margin_pct / 100 : null;
      revenueGrowth = recent.revenue_growth_pct ? recent.revenue_growth_pct / 100 : null;
    }

    const recentBS = [...(fin.balance_sheet ?? [])].pop();
    if (recentBS) {
      netDebt = recentBS.total_debt != null && recentBS.cash != null
        ? recentBS.total_debt - recentBS.cash
        : null;
    }
  }

  // Build LBO model when applicable
  const hasMinLBOData = ltmEBITDA != null && ltmEBITDA > 0;
  const isLBODeal = dealSubType === "lbo" || entryMultiple != null;

  if (hasMinLBOData && (isLBODeal || documentType === "cim")) {
    const lboInputs = getDefaultLBOInputs(
      ltmRevenue,
      ltmEBITDA,
      entryMultiple,
      ebitdaMargin,
      revenueGrowth
    );
    result.lbo = {
      inputs: lboInputs,
      outputs: computeLBO(lboInputs),
    };
  }

  // Build DCF model when FCF data or revenue data exists
  const hasMinDCFData = ltmRevenue != null && ltmRevenue > 0;

  if (hasMinDCFData) {
    const dcfInputs = getDefaultDCFInputs(
      ltmRevenue,
      ltmEBITDA,
      revenueGrowth,
      netDebt
    );
    result.dcf = {
      inputs: dcfInputs,
      outputs: computeDCF(dcfInputs),
    };
  }

  return result;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
