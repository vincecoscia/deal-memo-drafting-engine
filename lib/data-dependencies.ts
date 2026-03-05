// Maps memo section IDs to the extracted data fields they depend on.
// When any of these fields change, the section should be marked stale.

export const SECTION_DEPENDENCIES: Record<string, string[]> = {
  executive_summary: [
    "company.name",
    "company.description",
    "deal.asking_price",
    "deal.implied_multiple",
    "financials.historical",
  ],
  transaction_overview: [
    "deal.type",
    "deal.asking_price",
    "deal.implied_multiple",
    "deal.advisor",
    "deal.process_type",
  ],
  company_overview: [
    "company.name",
    "company.description",
    "company.headquarters",
    "company.founded",
    "company.employees",
    "company.ownership",
  ],
  products_and_services: [
    "company.description",
    "financials.revenue_segments",
  ],
  customer_and_supplier_analysis: [
    "customers.total_customers",
    "customers.top_customer_concentration_pct",
    "customers.customer_list",
    "customers.recurring_revenue_pct",
    "customers.retention_rate",
  ],
  management_team: [
    "management",
  ],
  market_and_competitive_position: [
    "market.tam",
    "market.sam",
    "market.market_growth_rate",
    "market.competitors",
    "market.key_trends",
  ],
  financial_overview: [
    "financials.historical",
    "financials.ebitda_adjustments",
    "financials.revenue_segments",
    "industry_specific_metrics",
  ],
  investment_highlights: [
    "financials.historical",
    "market.tam",
    "customers.recurring_revenue_pct",
    "growth_opportunities",
  ],
  key_risks: [
    "risks",
    "customers.top_customer_concentration_pct",
  ],
  value_creation_strategy: [
    "growth_opportunities",
    "financials.historical",
    "market.key_trends",
  ],
  valuation_context: [
    "deal.asking_price",
    "deal.implied_multiple",
    "financials.historical",
  ],
  deal_structure_and_financing: [
    "deal.asking_price",
    "deal.implied_multiple",
    "deal.type",
  ],
};

/**
 * Given a set of changed field paths, return the section IDs that are affected.
 */
export function getStaleSections(changedPaths: string[]): string[] {
  const stale: Set<string> = new Set();

  for (const [sectionId, deps] of Object.entries(SECTION_DEPENDENCIES)) {
    for (const dep of deps) {
      if (changedPaths.some((path) => path.startsWith(dep) || dep.startsWith(path))) {
        stale.add(sectionId);
        break;
      }
    }
  }

  return Array.from(stale);
}
