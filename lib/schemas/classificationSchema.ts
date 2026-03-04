export const CLASSIFICATION_SCHEMA = {
  type: "object" ,
  properties: {
    document_type: {
      type: "string" ,
      enum: ["cim", "term_sheet", "financial_statement"],
      description:
        "The type of financial document: CIM, term sheet, or financial statement.",
    },
    confidence: {
      type: "number" ,
      minimum: 0,
      maximum: 1,
      description: "Confidence score between 0 and 1.",
    },
    reasoning: {
      type: "string" ,
      description: "Brief explanation for the classification decision.",
    },
  },
  required: ["document_type", "confidence", "reasoning"] ,
};
