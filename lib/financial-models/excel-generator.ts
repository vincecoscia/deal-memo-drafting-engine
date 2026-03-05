import ExcelJS from "exceljs";
import type { LBOInputs, LBOOutputs } from "./lbo";
import type { DCFInputs, DCFOutputs } from "./dcf";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F2937" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
};
const CURRENCY_FORMAT = '$#,##0.0';
const PERCENT_FORMAT = '0.0%';
const MULTIPLE_FORMAT = '0.0"x"';

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: "center" };
  });
}

export async function generateLBOExcel(
  inputs: LBOInputs,
  outputs: LBOOutputs
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // ── Assumptions sheet ──
  const assumptions = wb.addWorksheet("Assumptions");
  assumptions.columns = [
    { header: "Assumption", key: "label", width: 30 },
    { header: "Value", key: "value", width: 18 },
  ];
  styleHeaderRow(assumptions.getRow(1));

  const assumptionRows = [
    { label: "Entry EV/EBITDA Multiple", value: inputs.entryEVMultiple, format: MULTIPLE_FORMAT },
    { label: "LTM EBITDA ($M)", value: inputs.ltmEBITDA, format: CURRENCY_FORMAT },
    { label: "LTM Revenue ($M)", value: inputs.ltmRevenue, format: CURRENCY_FORMAT },
    { label: "Revenue Growth Rate", value: inputs.revenueGrowthRate, format: PERCENT_FORMAT },
    { label: "EBITDA Margin", value: inputs.ebitdaMargin, format: PERCENT_FORMAT },
    { label: "Leverage Multiple (Debt/EBITDA)", value: inputs.leverageMultiple, format: MULTIPLE_FORMAT },
    { label: "Interest Rate", value: inputs.interestRate, format: PERCENT_FORMAT },
    { label: "Exit EV/EBITDA Multiple", value: inputs.exitMultiple, format: MULTIPLE_FORMAT },
    { label: "Hold Period (Years)", value: inputs.holdPeriod, format: "0" },
    { label: "Capex % of Revenue", value: inputs.capexPctRevenue, format: PERCENT_FORMAT },
    { label: "Tax Rate", value: inputs.taxRate, format: PERCENT_FORMAT },
    { label: "Debt Paydown % of FCF", value: inputs.debtPaydownPctFCF, format: PERCENT_FORMAT },
    { label: "NWC % of Revenue", value: inputs.workingCapitalPctRevenue, format: PERCENT_FORMAT },
  ];

  for (const r of assumptionRows) {
    const row = assumptions.addRow({ label: r.label, value: r.value });
    row.getCell("value").numFmt = r.format;
  }

  // ── Returns Summary sheet ──
  const summary = wb.addWorksheet("Returns Summary");
  summary.columns = [
    { header: "Metric", key: "metric", width: 25 },
    { header: "Value", key: "value", width: 18 },
  ];
  styleHeaderRow(summary.getRow(1));

  const summaryRows = [
    { metric: "Entry Enterprise Value", value: outputs.entryEV, format: CURRENCY_FORMAT },
    { metric: "Entry Equity", value: outputs.entryEquity, format: CURRENCY_FORMAT },
    { metric: "Entry Debt", value: outputs.entryDebt, format: CURRENCY_FORMAT },
    { metric: "Exit Enterprise Value", value: outputs.exitEV, format: CURRENCY_FORMAT },
    { metric: "Exit Equity", value: outputs.exitEquity, format: CURRENCY_FORMAT },
    { metric: "Total Debt Paydown", value: outputs.totalDebtPaydown, format: CURRENCY_FORMAT },
    { metric: "MOIC", value: outputs.moic, format: MULTIPLE_FORMAT },
    { metric: "IRR", value: outputs.irr, format: PERCENT_FORMAT },
    { metric: "Exit Leverage", value: outputs.exitLeverage, format: MULTIPLE_FORMAT },
  ];

  for (const r of summaryRows) {
    const row = summary.addRow({ metric: r.metric, value: r.value });
    row.getCell("value").numFmt = r.format;
  }

  // ── Debt Schedule sheet ──
  const schedule = wb.addWorksheet("Debt Schedule");
  schedule.columns = [
    { header: "Year", key: "year", width: 8 },
    { header: "Revenue ($M)", key: "revenue", width: 15 },
    { header: "EBITDA ($M)", key: "ebitda", width: 15 },
    { header: "FCF ($M)", key: "fcf", width: 15 },
    { header: "Beg. Debt ($M)", key: "beginDebt", width: 15 },
    { header: "Interest ($M)", key: "interest", width: 15 },
    { header: "Repayment ($M)", key: "repayment", width: 15 },
    { header: "End. Debt ($M)", key: "endDebt", width: 15 },
    { header: "Leverage", key: "leverage", width: 12 },
  ];
  styleHeaderRow(schedule.getRow(1));

  for (const yr of outputs.debtSchedule) {
    const row = schedule.addRow({
      year: yr.year,
      revenue: yr.revenue,
      ebitda: yr.ebitda,
      fcf: yr.fcf,
      beginDebt: yr.beginningDebt,
      interest: yr.interestExpense,
      repayment: yr.optionalRepayment,
      endDebt: yr.endingDebt,
      leverage: yr.leverageRatio,
    });
    ["revenue", "ebitda", "fcf", "beginDebt", "interest", "repayment", "endDebt"].forEach(
      (key) => { row.getCell(key).numFmt = CURRENCY_FORMAT; }
    );
    row.getCell("leverage").numFmt = MULTIPLE_FORMAT;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generateDCFExcel(
  inputs: DCFInputs,
  outputs: DCFOutputs
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // ── Assumptions sheet ──
  const assumptions = wb.addWorksheet("Assumptions");
  assumptions.columns = [
    { header: "Assumption", key: "label", width: 30 },
    { header: "Value", key: "value", width: 18 },
  ];
  styleHeaderRow(assumptions.getRow(1));

  const assumptionRows = [
    { label: "LTM Revenue ($M)", value: inputs.ltmRevenue, format: CURRENCY_FORMAT },
    { label: "EBITDA Margin", value: inputs.ebitdaMargin, format: PERCENT_FORMAT },
    { label: "WACC", value: inputs.wacc, format: PERCENT_FORMAT },
    { label: "Terminal Growth Rate", value: inputs.terminalGrowthRate, format: PERCENT_FORMAT },
    { label: "Tax Rate", value: inputs.taxRate, format: PERCENT_FORMAT },
    { label: "Capex % of Revenue", value: inputs.capexPctRevenue, format: PERCENT_FORMAT },
    { label: "D&A % of Revenue", value: inputs.daPercOfRevenue, format: PERCENT_FORMAT },
    { label: "NWC % of Revenue Change", value: inputs.nwcPctRevenue, format: PERCENT_FORMAT },
    { label: "Net Debt ($M)", value: inputs.netDebt, format: CURRENCY_FORMAT },
    { label: "Projection Years", value: inputs.projectionYears, format: "0" },
  ];

  for (const r of assumptionRows) {
    const row = assumptions.addRow({ label: r.label, value: r.value });
    row.getCell("value").numFmt = r.format;
  }

  // ── Valuation Summary sheet ──
  const summary = wb.addWorksheet("Valuation Summary");
  summary.columns = [
    { header: "Metric", key: "metric", width: 30 },
    { header: "Value", key: "value", width: 18 },
  ];
  styleHeaderRow(summary.getRow(1));

  const summaryRows = [
    { metric: "PV of FCFs", value: outputs.pvOfFCFs, format: CURRENCY_FORMAT },
    { metric: "Terminal Value", value: outputs.terminalValue, format: CURRENCY_FORMAT },
    { metric: "PV of Terminal Value", value: outputs.pvOfTerminalValue, format: CURRENCY_FORMAT },
    { metric: "Enterprise Value", value: outputs.enterpriseValue, format: CURRENCY_FORMAT },
    { metric: "Less: Net Debt", value: inputs.netDebt, format: CURRENCY_FORMAT },
    { metric: "Equity Value", value: outputs.equityValue, format: CURRENCY_FORMAT },
    { metric: "Terminal Value % of EV", value: outputs.terminalValuePctOfEV, format: PERCENT_FORMAT },
    { metric: "Implied Exit Multiple", value: outputs.impliedExitMultiple, format: MULTIPLE_FORMAT },
  ];

  for (const r of summaryRows) {
    const row = summary.addRow({ metric: r.metric, value: r.value });
    row.getCell("value").numFmt = r.format;
  }

  // ── FCF Projections sheet ──
  const projections = wb.addWorksheet("FCF Projections");
  projections.columns = [
    { header: "Year", key: "year", width: 8 },
    { header: "Revenue ($M)", key: "revenue", width: 15 },
    { header: "Growth", key: "growth", width: 10 },
    { header: "EBITDA ($M)", key: "ebitda", width: 15 },
    { header: "D&A ($M)", key: "da", width: 12 },
    { header: "EBIT ($M)", key: "ebit", width: 12 },
    { header: "Taxes ($M)", key: "taxes", width: 12 },
    { header: "NOPAT ($M)", key: "nopat", width: 12 },
    { header: "Capex ($M)", key: "capex", width: 12 },
    { header: "NWC Chg ($M)", key: "nwc", width: 12 },
    { header: "FCF ($M)", key: "fcf", width: 12 },
    { header: "Disc. Factor", key: "df", width: 12 },
    { header: "PV(FCF) ($M)", key: "pvfcf", width: 12 },
  ];
  styleHeaderRow(projections.getRow(1));

  for (const yr of outputs.projections) {
    const row = projections.addRow({
      year: yr.year,
      revenue: yr.revenue,
      growth: yr.revenueGrowth,
      ebitda: yr.ebitda,
      da: yr.depreciation,
      ebit: yr.ebit,
      taxes: yr.taxes,
      nopat: yr.nopat,
      capex: yr.capex,
      nwc: yr.nwcChange,
      fcf: yr.fcf,
      df: yr.discountFactor,
      pvfcf: yr.pvFCF,
    });
    ["revenue", "ebitda", "da", "ebit", "taxes", "nopat", "capex", "nwc", "fcf", "pvfcf"].forEach(
      (key) => { row.getCell(key).numFmt = CURRENCY_FORMAT; }
    );
    row.getCell("growth").numFmt = PERCENT_FORMAT;
    row.getCell("df").numFmt = "0.000";
  }

  // Terminal value row
  const tvRow = projections.addRow({
    year: "TV",
    fcf: outputs.terminalValue,
    pvfcf: outputs.pvOfTerminalValue,
  });
  tvRow.font = { bold: true };
  tvRow.getCell("fcf").numFmt = CURRENCY_FORMAT;
  tvRow.getCell("pvfcf").numFmt = CURRENCY_FORMAT;

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
