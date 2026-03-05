import type { ExtractedData } from "@/types";

const LLAMAPARSE_API_URL = "https://api.cloud.llamaindex.ai/api/parsing";

export interface LlamaParseResult {
  markdown: string;
  tables: string[];
}

/**
 * Check if LlamaParse is available (API key configured).
 */
export function isLlamaParseAvailable(): boolean {
  return !!process.env.LLAMAPARSE_API_KEY;
}

/**
 * Assess whether the extracted financial data quality is poor enough
 * to warrant a LlamaParse re-extraction attempt.
 *
 * Heuristic: if >50% of financial periods have null revenue AND null EBITDA,
 * the table extraction likely failed.
 */
export function assessTableQuality(
  extractedData: ExtractedData,
  documentType: string
): boolean {
  // Only relevant for CIMs and financial statements
  if (documentType === "term_sheet") return true;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const data = extractedData as any;

  // Check CIM financials
  if (data.financials?.historical) {
    const periods = data.financials.historical as Array<{
      revenue: number | null;
      ebitda_reported: number | null;
      ebitda_adjusted: number | null;
    }>;
    if (periods.length === 0) return false;

    const emptyCount = periods.filter(
      (p) => p.revenue == null && p.ebitda_reported == null && p.ebitda_adjusted == null
    ).length;

    const threshold = parseFloat(process.env.TABLE_QUALITY_THRESHOLD ?? "0.5");
    return emptyCount / periods.length < threshold;
  }

  // Check financial statement data
  if (data.income_statement) {
    const periods = data.income_statement as Array<{
      revenue: number | null;
      ebitda: number | null;
    }>;
    if (periods.length === 0) return false;

    const emptyCount = periods.filter(
      (p) => p.revenue == null && p.ebitda == null
    ).length;

    const threshold = parseFloat(process.env.TABLE_QUALITY_THRESHOLD ?? "0.5");
    return emptyCount / periods.length < threshold;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return true; // No financial data to check — quality unknown, skip fallback
}

/**
 * Parse a PDF using LlamaParse API to extract structured table data.
 * Returns markdown representation with tables preserved.
 */
export async function parseWithLlamaParse(
  pdfBase64: string,
  fileName: string
): Promise<LlamaParseResult> {
  const apiKey = process.env.LLAMAPARSE_API_KEY;
  if (!apiKey) {
    throw new Error("LLAMAPARSE_API_KEY is not configured");
  }

  // Upload the file
  const buffer = Buffer.from(pdfBase64, "base64");
  const blob = new Blob([buffer], { type: "application/pdf" });
  const formData = new FormData();
  formData.append("file", blob, fileName);
  formData.append("result_type", "markdown");
  formData.append("auto_mode", "true");

  const uploadResponse = await fetch(`${LLAMAPARSE_API_URL}/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error(`LlamaParse upload failed: ${uploadResponse.statusText}`);
  }

  const { id: jobId } = (await uploadResponse.json()) as { id: string };

  // Poll for completion
  const maxAttempts = 60;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const statusResponse = await fetch(`${LLAMAPARSE_API_URL}/job/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!statusResponse.ok) continue;

    const status = (await statusResponse.json()) as { status: string };
    if (status.status === "SUCCESS") {
      // Fetch the result
      const resultResponse = await fetch(
        `${LLAMAPARSE_API_URL}/job/${jobId}/result/markdown`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );

      if (!resultResponse.ok) {
        throw new Error(`LlamaParse result fetch failed: ${resultResponse.statusText}`);
      }

      const result = (await resultResponse.json()) as {
        markdown: string;
      };

      // Extract tables from the markdown
      const tableRegex = /\|[^\n]+\|\n\|[-| :]+\|\n(?:\|[^\n]+\|\n)*/g;
      const tables = result.markdown.match(tableRegex) || [];

      return {
        markdown: result.markdown,
        tables,
      };
    }

    if (status.status === "ERROR") {
      throw new Error("LlamaParse processing failed");
    }
  }

  throw new Error("LlamaParse processing timed out");
}
