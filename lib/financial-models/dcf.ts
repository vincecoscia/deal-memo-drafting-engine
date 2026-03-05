export interface DCFInputs {
  projectionYears: number;        // Number of projection years (typically 5-10)
  ltmRevenue: number;             // LTM Revenue ($M)
  revenueGrowthRates: number[];   // Annual growth rates per year (decimal)
  ebitdaMargin: number;           // Steady-state EBITDA margin (decimal)
  taxRate: number;                // Corporate tax rate (decimal)
  capexPctRevenue: number;        // Capex as % of revenue (decimal)
  daPercOfRevenue: number;        // D&A as % of revenue (decimal)
  nwcPctRevenue: number;          // NWC change as % of revenue change (decimal)
  wacc: number;                   // Weighted average cost of capital (decimal)
  terminalGrowthRate: number;     // Terminal/perpetuity growth rate (decimal)
  netDebt: number;                // Current net debt ($M)
  sharesOutstanding: number;      // Shares outstanding (if applicable)
}

export interface DCFProjectionYear {
  year: number;
  revenue: number;
  revenueGrowth: number;
  ebitda: number;
  ebitdaMargin: number;
  depreciation: number;
  ebit: number;
  taxes: number;
  nopat: number;
  capex: number;
  nwcChange: number;
  fcf: number;
  discountFactor: number;
  pvFCF: number;
}

export interface DCFOutputs {
  projections: DCFProjectionYear[];
  pvOfFCFs: number;
  terminalValue: number;
  pvOfTerminalValue: number;
  enterpriseValue: number;
  equityValue: number;
  equityValuePerShare: number | null;
  terminalValuePctOfEV: number;
  impliedExitMultiple: number;
}

export function computeDCF(inputs: DCFInputs): DCFOutputs {
  const {
    projectionYears,
    ltmRevenue,
    revenueGrowthRates,
    ebitdaMargin,
    taxRate,
    capexPctRevenue,
    daPercOfRevenue,
    nwcPctRevenue,
    wacc,
    terminalGrowthRate,
    netDebt,
    sharesOutstanding,
  } = inputs;

  const projections: DCFProjectionYear[] = [];
  let prevRevenue = ltmRevenue;

  for (let i = 0; i < projectionYears; i++) {
    const year = i + 1;
    const growthRate = revenueGrowthRates[i] ?? revenueGrowthRates[revenueGrowthRates.length - 1] ?? 0.05;
    const revenue = prevRevenue * (1 + growthRate);
    const ebitda = revenue * ebitdaMargin;
    const depreciation = revenue * daPercOfRevenue;
    const ebit = ebitda - depreciation;
    const taxes = Math.max(0, ebit * taxRate);
    const nopat = ebit - taxes;
    const capex = revenue * capexPctRevenue;
    const nwcChange = (revenue - prevRevenue) * nwcPctRevenue;
    const fcf = nopat + depreciation - capex - nwcChange;
    const discountFactor = 1 / Math.pow(1 + wacc, year);
    const pvFCF = fcf * discountFactor;

    projections.push({
      year,
      revenue,
      revenueGrowth: growthRate,
      ebitda,
      ebitdaMargin,
      depreciation,
      ebit,
      taxes,
      nopat,
      capex,
      nwcChange,
      fcf,
      discountFactor,
      pvFCF,
    });

    prevRevenue = revenue;
  }

  // Terminal value (Gordon Growth Model)
  const terminalFCF = projections[projections.length - 1].fcf * (1 + terminalGrowthRate);
  const terminalValue = terminalFCF / (wacc - terminalGrowthRate);
  const pvOfTerminalValue = terminalValue / Math.pow(1 + wacc, projectionYears);

  // Sum of PV of FCFs
  const pvOfFCFs = projections.reduce((sum, p) => sum + p.pvFCF, 0);

  // Enterprise and equity value
  const enterpriseValue = pvOfFCFs + pvOfTerminalValue;
  const equityValue = enterpriseValue - netDebt;
  const equityValuePerShare = sharesOutstanding > 0 ? equityValue / sharesOutstanding : null;

  // Implied metrics
  const terminalEBITDA = projections[projections.length - 1].ebitda * (1 + terminalGrowthRate);
  const impliedExitMultiple = terminalValue / terminalEBITDA;
  const terminalValuePctOfEV = pvOfTerminalValue / enterpriseValue;

  return {
    projections,
    pvOfFCFs,
    terminalValue,
    pvOfTerminalValue,
    enterpriseValue,
    equityValue,
    equityValuePerShare,
    terminalValuePctOfEV,
    impliedExitMultiple,
  };
}

export function getDefaultDCFInputs(
  ltmRevenue: number | null,
  ltmEBITDA: number | null,
  revenueGrowth: number | null,
  netDebt: number | null,
): DCFInputs {
  const revenue = ltmRevenue ?? 50;
  const ebitda = ltmEBITDA ?? revenue * 0.2;
  const margin = ebitda / revenue;
  const baseGrowth = revenueGrowth ?? 0.05;

  // Declining growth rates over projection period
  const growthRates = Array.from({ length: 5 }, (_, i) =>
    baseGrowth * Math.pow(0.9, i)
  );

  return {
    projectionYears: 5,
    ltmRevenue: revenue,
    revenueGrowthRates: growthRates,
    ebitdaMargin: margin,
    taxRate: 0.25,
    capexPctRevenue: 0.03,
    daPercOfRevenue: 0.02,
    nwcPctRevenue: 0.10,
    wacc: 0.10,
    terminalGrowthRate: 0.025,
    netDebt: netDebt ?? 0,
    sharesOutstanding: 0,
  };
}
