export interface LBOInputs {
  entryEVMultiple: number;        // EV/EBITDA at entry
  ltmEBITDA: number;              // LTM EBITDA ($M)
  revenueGrowthRate: number;      // Annual revenue growth (decimal)
  ebitdaMargin: number;           // EBITDA margin (decimal)
  ltmRevenue: number;             // LTM Revenue ($M)
  leverageMultiple: number;       // Total Debt / EBITDA at entry
  interestRate: number;           // Weighted average interest rate (decimal)
  exitMultiple: number;           // EV/EBITDA at exit
  holdPeriod: number;             // Years (typically 3-7)
  capexPctRevenue: number;        // Capex as % of revenue (decimal)
  taxRate: number;                // Corporate tax rate (decimal)
  debtPaydownPctFCF: number;     // % of FCF used for debt paydown (decimal)
  workingCapitalPctRevenue: number; // NWC as % of revenue (decimal)
}

export interface DebtScheduleYear {
  year: number;
  beginningDebt: number;
  interestExpense: number;
  mandatoryRepayment: number;
  optionalRepayment: number;
  endingDebt: number;
  revenue: number;
  ebitda: number;
  fcf: number;
  leverageRatio: number;
}

export interface LBOOutputs {
  entryEV: number;
  entryEquity: number;
  entryDebt: number;
  exitEV: number;
  exitEquity: number;
  moic: number;
  irr: number;
  debtSchedule: DebtScheduleYear[];
  totalDebtPaydown: number;
  exitLeverage: number;
}

export function computeLBO(inputs: LBOInputs): LBOOutputs {
  const {
    entryEVMultiple,
    ltmEBITDA,
    revenueGrowthRate,
    ebitdaMargin,
    ltmRevenue,
    leverageMultiple,
    interestRate,
    exitMultiple,
    holdPeriod,
    capexPctRevenue,
    taxRate,
    debtPaydownPctFCF,
    workingCapitalPctRevenue,
  } = inputs;

  // Entry calculations
  const entryEV = entryEVMultiple * ltmEBITDA;
  const entryDebt = leverageMultiple * ltmEBITDA;
  const entryEquity = entryEV - entryDebt;

  // Build year-by-year projections
  const debtSchedule: DebtScheduleYear[] = [];
  let currentDebt = entryDebt;
  let currentRevenue = ltmRevenue;
  let prevRevenue = ltmRevenue;

  for (let year = 1; year <= holdPeriod; year++) {
    currentRevenue = prevRevenue * (1 + revenueGrowthRate);
    const ebitda = currentRevenue * ebitdaMargin;
    const interest = currentDebt * interestRate;
    const capex = currentRevenue * capexPctRevenue;
    const nwcChange = (currentRevenue - prevRevenue) * workingCapitalPctRevenue;
    const ebt = ebitda - interest - capex;
    const taxes = Math.max(0, ebt * taxRate);
    const fcf = ebitda - interest - taxes - capex - nwcChange;

    const mandatoryRepayment = 0; // Simplified — no mandatory amortization
    const optionalRepayment = Math.min(
      Math.max(0, fcf * debtPaydownPctFCF),
      currentDebt
    );
    const totalRepayment = mandatoryRepayment + optionalRepayment;

    debtSchedule.push({
      year,
      beginningDebt: currentDebt,
      interestExpense: interest,
      mandatoryRepayment,
      optionalRepayment,
      endingDebt: currentDebt - totalRepayment,
      revenue: currentRevenue,
      ebitda,
      fcf,
      leverageRatio: (currentDebt - totalRepayment) / ebitda,
    });

    currentDebt -= totalRepayment;
    prevRevenue = currentRevenue;
  }

  // Exit calculations
  const exitEBITDA = debtSchedule[debtSchedule.length - 1].ebitda;
  const exitEV = exitMultiple * exitEBITDA;
  const exitDebt = debtSchedule[debtSchedule.length - 1].endingDebt;
  const exitEquity = exitEV - exitDebt;
  const totalDebtPaydown = entryDebt - exitDebt;

  // Returns
  const moic = exitEquity / entryEquity;
  const irr = Math.pow(moic, 1 / holdPeriod) - 1;

  return {
    entryEV,
    entryEquity,
    entryDebt,
    exitEV,
    exitEquity,
    moic,
    irr,
    debtSchedule,
    totalDebtPaydown,
    exitLeverage: exitDebt / exitEBITDA,
  };
}

export function getDefaultLBOInputs(
  ltmRevenue: number | null,
  ltmEBITDA: number | null,
  entryMultiple: number | null,
  ebitdaMargin: number | null,
  revenueGrowth: number | null,
): LBOInputs {
  const ebitda = ltmEBITDA ?? (ltmRevenue ? ltmRevenue * 0.2 : 10);
  const revenue = ltmRevenue ?? ebitda / 0.2;

  return {
    entryEVMultiple: entryMultiple ?? 8,
    ltmEBITDA: ebitda,
    revenueGrowthRate: revenueGrowth ?? 0.05,
    ebitdaMargin: ebitdaMargin ?? (ebitda / revenue),
    ltmRevenue: revenue,
    leverageMultiple: 4.0,
    interestRate: 0.065,
    exitMultiple: entryMultiple ?? 8,
    holdPeriod: 5,
    capexPctRevenue: 0.03,
    taxRate: 0.25,
    debtPaydownPctFCF: 0.75,
    workingCapitalPctRevenue: 0.10,
  };
}
