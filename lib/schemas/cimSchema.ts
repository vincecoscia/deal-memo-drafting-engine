export const CIM_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    company: {
      type: "object",
      properties: {
        name: { type: ["string", "null"] },
        description: { type: ["string", "null"] },
        headquarters: { type: ["string", "null"] },
        founded: { type: ["string", "null"] },
        employees: { type: ["number", "null"] },
        ownership: { type: ["string", "null"] },
        industry: { type: ["string", "null"] },
        sub_industry: { type: ["string", "null"] },
      },
      required: [
        "name",
        "description",
        "headquarters",
        "founded",
        "employees",
        "ownership",
        "industry",
        "sub_industry",
      ],
    },
    deal: {
      type: "object",
      properties: {
        type: { type: ["string", "null"] },
        asking_price: { type: ["string", "null"] },
        implied_multiple: { type: ["string", "null"] },
        advisor: { type: ["string", "null"] },
        process_type: { type: ["string", "null"] },
      },
      required: [
        "type",
        "asking_price",
        "implied_multiple",
        "advisor",
        "process_type",
      ],
    },
    financials: {
      type: "object",
      properties: {
        currency: { type: "string" },
        fiscal_year_end: { type: ["string", "null"] },
        historical: {
          type: "array",
          items: {
            type: "object",
            properties: {
              period: { type: "string" },
              is_projected: { type: "boolean" },
              revenue: { type: ["number", "null"] },
              revenue_growth_pct: { type: ["number", "null"] },
              gross_profit: { type: ["number", "null"] },
              gross_margin_pct: { type: ["number", "null"] },
              ebitda_reported: { type: ["number", "null"] },
              ebitda_adjusted: { type: ["number", "null"] },
              ebitda_margin_pct: { type: ["number", "null"] },
              ebit: { type: ["number", "null"] },
              net_income: { type: ["number", "null"] },
              capex: { type: ["number", "null"] },
              fcf: { type: ["number", "null"] },
              total_debt: { type: ["number", "null"] },
              cash: { type: ["number", "null"] },
            },
            required: ["period", "is_projected", "revenue"],
          },
        },
        ebitda_adjustments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              amount: { type: "number" },
            },
            required: ["description", "amount"],
          },
        },
        revenue_segments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              segment_name: { type: "string" },
              revenue: { type: ["number", "null"] },
              pct_of_total: { type: ["number", "null"] },
            },
            required: ["segment_name"],
          },
        },
      },
      required: ["currency", "historical"],
    },
    customers: {
      type: "object",
      properties: {
        total_customers: { type: ["number", "null"] },
        top_customer_concentration_pct: { type: ["number", "null"] },
        top_10_concentration_pct: { type: ["number", "null"] },
        customer_list: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              pct_of_revenue: { type: ["number", "null"] },
              relationship_years: { type: ["number", "null"] },
            },
            required: ["name"],
          },
        },
        recurring_revenue_pct: { type: ["number", "null"] },
        contract_structure: { type: ["string", "null"] },
        avg_contract_length: { type: ["string", "null"] },
        retention_rate: { type: ["number", "null"] },
      },
      required: ["total_customers"],
    },
    management: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          title: { type: "string" },
          tenure_years: { type: ["number", "null"] },
          background: { type: ["string", "null"] },
        },
        required: ["name", "title"],
      },
    },
    market: {
      type: "object",
      properties: {
        tam: { type: ["string", "null"] },
        sam: { type: ["string", "null"] },
        market_growth_rate: { type: ["string", "null"] },
        key_trends: { type: "array", items: { type: "string" } },
        competitors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: ["string", "null"] },
              relative_size: { type: ["string", "null"] },
            },
            required: ["name"],
          },
        },
      },
      required: ["key_trends", "competitors"],
    },
    growth_opportunities: {
      type: "array",
      items: { type: "string" },
    },
    risks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          risk: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          mitigant: { type: ["string", "null"] },
        },
        required: ["risk", "severity"],
      },
    },
    industry_specific_metrics: {
      type: "object",
      properties: {
        metrics: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              value: { type: "string" },
              context: { type: ["string", "null"] },
            },
            required: ["name", "value"],
          },
        },
      },
      required: ["metrics"],
    },
    data_gaps: {
      type: "array",
      items: { type: "string" },
    },
    source_pages: {
      type: "object",
      properties: {
        executive_summary: { type: ["string", "null"] },
        financials: { type: ["string", "null"] },
        customer_data: { type: ["string", "null"] },
        market_data: { type: ["string", "null"] },
        management: { type: ["string", "null"] },
      },
      required: [
        "executive_summary",
        "financials",
        "customer_data",
        "market_data",
        "management",
      ],
    },
    citations: {
      type: ["object", "null"],
      description: "Per-data-point page citations for analyst verification",
      properties: {
        revenue_figures: {
          type: "array",
          items: {
            type: "object",
            properties: {
              period: { type: "string" },
              page: { type: "string", description: "e.g. 'p.42' or 'pp.42-43'" },
              section: { type: "string", description: "Section heading where found" },
            },
            required: ["period", "page", "section"],
          },
        },
        ebitda_figures: {
          type: "array",
          items: {
            type: "object",
            properties: {
              period: { type: "string" },
              page: { type: "string" },
              section: { type: "string" },
            },
            required: ["period", "page", "section"],
          },
        },
        customer_concentration: {
          type: ["object", "null"],
          properties: {
            page: { type: "string" },
            section: { type: "string" },
          },
          required: ["page", "section"],
        },
        tam_sam: {
          type: ["object", "null"],
          properties: {
            page: { type: "string" },
            section: { type: "string" },
          },
          required: ["page", "section"],
        },
        management: {
          type: ["object", "null"],
          properties: {
            page: { type: "string" },
            section: { type: "string" },
          },
          required: ["page", "section"],
        },
        asking_price: {
          type: ["object", "null"],
          properties: {
            page: { type: "string" },
            section: { type: "string" },
          },
          required: ["page", "section"],
        },
      },
      required: ["revenue_figures", "ebitda_figures"],
    },
  },
  required: [
    "company",
    "deal",
    "financials",
    "customers",
    "management",
    "market",
    "growth_opportunities",
    "risks",
    "data_gaps",
    "source_pages",
    "citations",
  ],
};
