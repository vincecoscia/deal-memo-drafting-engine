export interface SampleDocument {
  id: string;
  name: string;
  fileName: string;
  description: string;
  documentType: "cim" | "term_sheet" | "financial_statement";
}

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    id: "sample-cim",
    name: "Acme Surfing Corp CIM",
    fileName: "sample-cim.pdf",
    description:
      "Mid-market consumer products company — $30M revenue, full financials",
    documentType: "cim",
  },
  {
    id: "sample-term-sheet",
    name: "Sample PE Term Sheet",
    fileName: "sample-term-sheet.pdf",
    description: "LBO term sheet with governance, earn-out, and rollover terms",
    documentType: "term_sheet",
  },
  {
    id: "sample-financials",
    name: "Sample Financial Statements",
    fileName: "sample-financials.pdf",
    description:
      "3-year historical income statement, balance sheet, and cash flow",
    documentType: "financial_statement",
  },
];
