export const CLASSIFICATION_SCHEMA = {
  type: "object",
  properties: {
    document_type: {
      type: "string",
      enum: ["cim", "term_sheet", "financial_statement"],
      description:
        "The type of financial document: CIM, term sheet, or financial statement.",
    },
    deal_sub_type: {
      type: "string",
      enum: ["lbo", "growth_equity", "venture", "unknown"],
      description:
        "The deal sub-type: LBO/buyout (leveraged acquisition, management buyout, platform acquisition), growth equity (minority or majority investment in growing company), venture (early-stage investment), or unknown if not determinable.",
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Confidence score between 0 and 1.",
    },
    reasoning: {
      type: "string",
      description: "Brief explanation for the classification decision.",
    },
  },
  required: ["document_type", "deal_sub_type", "confidence", "reasoning"],
};
