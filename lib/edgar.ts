/**
 * SEC EDGAR full-text search client.
 * Uses the EFTS (EDGAR Full-Text Search) API — no API key required.
 * Rate limit: max 10 req/s; we add User-Agent per SEC fair-access policy.
 */

const USER_AGENT = "BraythosApp/1.0 (support@braythos.com)";

export interface EdgarSearchResult {
  accessionNo: string;
  cik: string;
  companyName: string;
  formType: string;
  filedAt: string;
  documentUrl: string;
  description: string;
}

export interface EdgarSearchResponse {
  results: EdgarSearchResult[];
  totalHits: number;
  query: string;
}

/**
 * Search EDGAR filings using the full-text search API.
 */
export async function searchEdgar(
  query: string,
  formType?: string,
  dateFrom?: string,
  dateTo?: string,
  maxResults = 10
): Promise<EdgarSearchResponse> {
  const params = new URLSearchParams();
  params.set("q", `"${query}"`);
  if (formType) params.set("forms", formType);
  if (dateFrom || dateTo) params.set("dateRange", "custom");
  if (dateFrom) params.set("startdt", dateFrom);
  if (dateTo) params.set("enddt", dateTo);

  const res = await fetch(
    `https://efts.sec.gov/LATEST/search-index?${params.toString()}`,
    {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    }
  );

  if (!res.ok) {
    throw new Error(`EDGAR search failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return parseSearchResponse(data, query, maxResults);
}

function parseSearchResponse(
  data: {
    hits?: {
      total?: { value?: number };
      hits?: Array<{
        _id?: string;
        _source?: {
          entity_name?: string;
          file_num?: string;
          form_type?: string;
          file_date?: string;
          display_names?: string[];
          display_date_filed?: string;
          entity_id?: string;
          file_description?: string;
        };
      }>;
    };
  },
  query: string,
  maxResults: number
): EdgarSearchResponse {
  const hits = data.hits?.hits ?? [];
  const totalHits = data.hits?.total?.value ?? 0;

  const results: EdgarSearchResult[] = hits.slice(0, maxResults).map((hit) => {
    const src = hit._source ?? {};
    const accessionFormatted = hit._id ?? "";
    const accessionNo = accessionFormatted.replace(/-/g, "");
    const cik = src.entity_id ?? "";

    // Build document URL
    const documentUrl = accessionFormatted
      ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNo}/${accessionFormatted}-index.htm`
      : "";

    return {
      accessionNo: accessionFormatted,
      cik,
      companyName: src.entity_name ?? src.display_names?.[0] ?? "Unknown",
      formType: src.form_type ?? "",
      filedAt: src.file_date ?? src.display_date_filed ?? "",
      documentUrl,
      description: src.file_description ?? `${src.form_type ?? "Filing"} for ${src.entity_name ?? "Unknown"}`,
    };
  });

  return { results, totalHits, query };
}

/**
 * Fetch the content of an EDGAR filing (HTML) and return as text.
 */
export async function fetchFilingContent(documentUrl: string): Promise<string> {
  // First, get the filing index page
  const res = await fetch(documentUrl, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch filing: ${res.status}`);
  }

  const html = await res.text();

  // Try to find the primary document link in the index page
  const primaryDocMatch = html.match(
    /href="([^"]+\.htm[l]?)"[^>]*>(?:(?!\.xml|R\d+\.htm)[^<]*)<\/a>/i
  );

  if (!primaryDocMatch) {
    return stripHtmlToText(html);
  }

  // Resolve relative URL
  const baseUrl = documentUrl.replace(/\/[^/]*$/, "/");
  const docUrl = primaryDocMatch[1].startsWith("http")
    ? primaryDocMatch[1]
    : baseUrl + primaryDocMatch[1];

  const docRes = await fetch(docUrl, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!docRes.ok) {
    return stripHtmlToText(html);
  }

  const docHtml = await docRes.text();
  return stripHtmlToText(docHtml);
}

/**
 * Strip HTML tags and extract readable text content.
 */
function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, "\t")
    .replace(/<\/th>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#?\w+;/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Filing types relevant to PE deal analysis */
export const FILING_TYPES = [
  { value: "", label: "All Types" },
  { value: "8-K", label: "8-K (Current Reports / Deal Announcements)" },
  { value: "DEFM14A", label: "DEFM14A (Merger Proxy Statements)" },
  { value: "SC TO-T", label: "SC TO-T (Tender Offer Statements)" },
  { value: "10-K", label: "10-K (Annual Reports)" },
  { value: "10-Q", label: "10-Q (Quarterly Reports)" },
  { value: "S-1", label: "S-1 (Registration Statements)" },
] as const;
