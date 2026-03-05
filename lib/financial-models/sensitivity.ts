import { computeLBO, type LBOInputs } from "./lbo";
import { computeDCF, type DCFInputs } from "./dcf";

export interface SensitivityGrid {
  rowLabel: string;
  colLabel: string;
  rowValues: number[];
  colValues: number[];
  data: number[][]; // [row][col]
  metric: string;
}

export function generateLBOSensitivity(
  baseInputs: LBOInputs
): { irr: SensitivityGrid; moic: SensitivityGrid } {
  const baseEntry = baseInputs.entryEVMultiple;
  const baseExit = baseInputs.exitMultiple;

  // 5x5 grid: entry multiple vs exit multiple
  const entryMultiples = [
    baseEntry - 2,
    baseEntry - 1,
    baseEntry,
    baseEntry + 1,
    baseEntry + 2,
  ].map((v) => Math.max(3, v));

  const exitMultiples = [
    baseExit - 2,
    baseExit - 1,
    baseExit,
    baseExit + 1,
    baseExit + 2,
  ].map((v) => Math.max(3, v));

  const irrData: number[][] = [];
  const moicData: number[][] = [];

  for (const entry of entryMultiples) {
    const irrRow: number[] = [];
    const moicRow: number[] = [];

    for (const exit of exitMultiples) {
      const result = computeLBO({
        ...baseInputs,
        entryEVMultiple: entry,
        exitMultiple: exit,
      });
      irrRow.push(result.irr);
      moicRow.push(result.moic);
    }

    irrData.push(irrRow);
    moicData.push(moicRow);
  }

  return {
    irr: {
      rowLabel: "Entry Multiple",
      colLabel: "Exit Multiple",
      rowValues: entryMultiples,
      colValues: exitMultiples,
      data: irrData,
      metric: "IRR",
    },
    moic: {
      rowLabel: "Entry Multiple",
      colLabel: "Exit Multiple",
      rowValues: entryMultiples,
      colValues: exitMultiples,
      data: moicData,
      metric: "MOIC",
    },
  };
}

export function generateDCFSensitivity(
  baseInputs: DCFInputs
): SensitivityGrid {
  const baseWACC = baseInputs.wacc;
  const baseTG = baseInputs.terminalGrowthRate;

  // 5x5 grid: WACC vs terminal growth
  const waccValues = [
    baseWACC - 0.02,
    baseWACC - 0.01,
    baseWACC,
    baseWACC + 0.01,
    baseWACC + 0.02,
  ].map((v) => Math.max(0.05, v));

  const tgValues = [
    baseTG - 0.01,
    baseTG - 0.005,
    baseTG,
    baseTG + 0.005,
    baseTG + 0.01,
  ].map((v) => Math.max(0.005, Math.min(v, baseWACC - 0.01)));

  const evData: number[][] = [];

  for (const wacc of waccValues) {
    const row: number[] = [];
    for (const tg of tgValues) {
      const result = computeDCF({
        ...baseInputs,
        wacc,
        terminalGrowthRate: tg,
      });
      row.push(result.enterpriseValue);
    }
    evData.push(row);
  }

  return {
    rowLabel: "WACC",
    colLabel: "Terminal Growth",
    rowValues: waccValues,
    colValues: tgValues,
    data: evData,
    metric: "Enterprise Value ($M)",
  };
}
