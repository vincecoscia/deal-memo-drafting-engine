export const TERM_SHEET_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    economic_terms: {
      type: "object",
      properties: {
        purchase_price: { type: ["string", "null"] },
        valuation_methodology: { type: ["string", "null"] },
        ev_ebitda_multiple: { type: ["number", "null"] },
        form_of_consideration: { type: ["string", "null"] },
        seller_notes: { type: ["string", "null"] },
        earnout_description: { type: ["string", "null"] },
        rollover_equity_pct: { type: ["number", "null"] },
        working_capital_target: { type: ["string", "null"] },
      },
      required: [
        "purchase_price",
        "valuation_methodology",
        "form_of_consideration",
      ],
    },
    governance: {
      type: "object",
      properties: {
        board_composition: { type: ["string", "null"] },
        voting_rights: { type: ["string", "null"] },
        protective_provisions: {
          type: "array",
          items: { type: "string" },
        },
        information_rights: { type: ["string", "null"] },
      },
      required: ["protective_provisions"],
    },
    management_terms: {
      type: "object",
      properties: {
        management_incentive_plan: { type: ["string", "null"] },
        employment_agreements: { type: ["string", "null"] },
        non_compete_terms: { type: ["string", "null"] },
        change_of_control: { type: ["string", "null"] },
      },
    },
    investor_protections: {
      type: "object",
      properties: {
        liquidation_preference: { type: ["string", "null"] },
        anti_dilution: { type: ["string", "null"] },
        drag_along: { type: ["string", "null"] },
        tag_along: { type: ["string", "null"] },
        registration_rights: { type: ["string", "null"] },
      },
    },
    deal_process: {
      type: "object",
      properties: {
        exclusivity_period: { type: ["string", "null"] },
        due_diligence_timeline: { type: ["string", "null"] },
        conditions_to_closing: {
          type: "array",
          items: { type: "string" },
        },
        break_up_fee: { type: ["string", "null"] },
        escrow_terms: { type: ["string", "null"] },
        indemnification_cap: { type: ["string", "null"] },
      },
      required: ["conditions_to_closing"],
    },
    red_flags: {
      type: "array",
      items: {
        type: "object",
        properties: {
          issue: { type: "string" },
          severity: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
          explanation: { type: "string" },
        },
        required: ["issue", "severity", "explanation"],
      },
    },
    key_terms_summary: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
          value: { type: "string" },
        },
        required: ["term", "value"],
      },
    },
  },
  required: [
    "economic_terms",
    "governance",
    "deal_process",
    "red_flags",
    "key_terms_summary",
  ],
};
