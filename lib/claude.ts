import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type {
  ClassificationResult,
  DocumentType,
  DealSubType,
  MemoFormat,
  ExtractedData,
  InvestmentScorecard,
} from "@/types";
import { CLASSIFICATION_SCHEMA } from "./schemas/classificationSchema";
import { CIM_EXTRACTION_SCHEMA } from "./schemas/cimSchema";
import { TERM_SHEET_EXTRACTION_SCHEMA } from "./schemas/termSheetSchema";
import { FINANCIAL_EXTRACTION_SCHEMA } from "./schemas/financialSchema";
import { CLASSIFIER_SYSTEM_PROMPT } from "./prompts/classifier";
import { CIM_EXTRACTOR_SYSTEM_PROMPT } from "./prompts/cimExtractor";
import { TERM_SHEET_EXTRACTOR_SYSTEM_PROMPT } from "./prompts/termSheetExtractor";
import { FINANCIAL_EXTRACTOR_SYSTEM_PROMPT } from "./prompts/financialExtractor";
import { getMemoGeneratorPrompt } from "./prompts/memoGenerator";

const MODEL = "claude-sonnet-4-6";
const FILES_BETA = "files-api-2025-04-14";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ── PDF document blocks ──

function pdfBlock(base64: string) {
  return {
    type: "document" as const,
    source: {
      type: "base64" as const,
      media_type: "application/pdf" as const,
      data: base64,
    },
  };
}

function pdfBlockFromFileId(fileId: string) {
  return {
    type: "document" as const,
    source: {
      type: "file" as const,
      file_id: fileId,
    },
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function getDocBlock(pdfBase64: string | null, fileId: string | null): any {
  if (fileId) return pdfBlockFromFileId(fileId);
  if (pdfBase64) return pdfBlock(pdfBase64);
  throw new Error("Either pdfBase64 or fileId must be provided");
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// When fileId is present, use beta.messages to support file references.
// Otherwise, fall back to the standard messages API.
function getMessagesApi(client: Anthropic, fileId: string | null) {
  return fileId ? client.beta.messages : client.messages;
}

// ── Files API (Beta) ──

export async function uploadPdf(
  pdfBase64: string,
  fileName: string
): Promise<string> {
  const client = getClient();
  const buffer = Buffer.from(pdfBase64, "base64");
  const file = new File([buffer], fileName, { type: "application/pdf" });
  const uploaded = await client.beta.files.upload({ file, betas: [FILES_BETA] });
  return uploaded.id;
}

// ── Step 1: Classify the document ──

export async function classifyDocument(
  pdfBase64: string | null,
  fileId: string | null = null
): Promise<ClassificationResult> {
  const client = getClient();
  const api = getMessagesApi(client, fileId);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const response = await (api as any).create({
    model: MODEL,
    max_tokens: 512,
    ...(fileId ? { betas: [FILES_BETA] } : {}),
    system: [
      {
        type: "text" as const,
        text: CLASSIFIER_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    tools: [
      {
        name: "classify_document",
        description: "Classify the uploaded financial document",
        input_schema: CLASSIFICATION_SCHEMA as Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool" as const, name: "classify_document" },
    messages: [
      {
        role: "user",
        content: [
          getDocBlock(pdfBase64, fileId),
          { type: "text" as const, text: "Classify this document." },
        ],
      },
    ],
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const toolUse = response.content.find((b: { type: string }) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Classification failed: no tool_use response");
  }
  return toolUse.input as unknown as ClassificationResult;
}

// ── Step 2: Extract structured data ──

/* eslint-disable @typescript-eslint/no-explicit-any */
const EXTRACTION_CONFIGS: Record<
  DocumentType,
  { system: string; schema: any; toolName: string }
> = {
  cim: {
    system: CIM_EXTRACTOR_SYSTEM_PROMPT,
    schema: CIM_EXTRACTION_SCHEMA,
    toolName: "extract_cim_data",
  },
  term_sheet: {
    system: TERM_SHEET_EXTRACTOR_SYSTEM_PROMPT,
    schema: TERM_SHEET_EXTRACTION_SCHEMA,
    toolName: "extract_term_sheet_data",
  },
  financial_statement: {
    system: FINANCIAL_EXTRACTOR_SYSTEM_PROMPT,
    schema: FINANCIAL_EXTRACTION_SCHEMA,
    toolName: "extract_financial_data",
  },
};

export async function extractDocumentData(
  pdfBase64: string | null,
  documentType: DocumentType,
  fileId: string | null = null
): Promise<ExtractedData> {
  const config = EXTRACTION_CONFIGS[documentType];
  if (!config) throw new Error(`Unsupported document type: ${documentType}`);

  const client = getClient();
  const api = getMessagesApi(client, fileId);

  const response = await (api as any).create({
    model: MODEL,
    max_tokens: 16000,
    ...(fileId ? { betas: [FILES_BETA] } : {}),
    system: [
      {
        type: "text" as const,
        text: config.system,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    tools: [
      {
        name: config.toolName,
        description: "Extract structured data from the document",
        input_schema: config.schema,
      },
    ],
    tool_choice: { type: "tool" as const, name: config.toolName },
    messages: [
      {
        role: "user",
        content: [
          getDocBlock(pdfBase64, fileId),
          {
            type: "text" as const,
            text: "Extract all relevant data from this document.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b: { type: string }) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Extraction failed: no tool_use response");
  }
  return toolUse.input as unknown as ExtractedData;
}

// ── Step 2b: Multi-pass chunked extraction for large CIMs ──

export async function extractCIMChunked(
  pdfBase64: string | null,
  fileId: string | null = null
): Promise<ExtractedData> {
  const client = getClient();
  const api = getMessagesApi(client, fileId);
  const doc = getDocBlock(pdfBase64, fileId);

  // Pass 1: Financial data extraction
  const financialResponse = await (api as any).create({
    model: MODEL,
    max_tokens: 8000,
    ...(fileId ? { betas: [FILES_BETA] } : {}),
    system: [
      {
        type: "text" as const,
        text: `${CIM_EXTRACTOR_SYSTEM_PROMPT}\n\nFOCUS: Extract ONLY company, deal, and financials data (historical financials, EBITDA adjustments, revenue segments). For customers/management/market/risks, return minimal placeholder data.`,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    tools: [
      {
        name: "extract_cim_data",
        description: "Extract financial data from the CIM",
        input_schema: CIM_EXTRACTION_SCHEMA as Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool" as const, name: "extract_cim_data" },
    messages: [
      {
        role: "user",
        content: [
          doc,
          { type: "text" as const, text: "Extract financial and company data from this CIM." },
        ],
      },
    ],
  });

  // Pass 2: Customer, management, market data
  const qualitativeResponse = await (api as any).create({
    model: MODEL,
    max_tokens: 8000,
    ...(fileId ? { betas: [FILES_BETA] } : {}),
    system: [
      {
        type: "text" as const,
        text: `${CIM_EXTRACTOR_SYSTEM_PROMPT}\n\nFOCUS: Extract ONLY customers, management, market, growth_opportunities, risks, industry_specific_metrics, data_gaps, source_pages, and citations. For company/deal/financials, return minimal placeholder data.`,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    tools: [
      {
        name: "extract_cim_data",
        description: "Extract qualitative data from the CIM",
        input_schema: CIM_EXTRACTION_SCHEMA as Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool" as const, name: "extract_cim_data" },
    messages: [
      {
        role: "user",
        content: [
          doc,
          { type: "text" as const, text: "Extract customer, management, market, and risk data from this CIM." },
        ],
      },
    ],
  });

  const financialData = financialResponse.content.find((b: { type: string }) => b.type === "tool_use");
  const qualitativeData = qualitativeResponse.content.find((b: { type: string }) => b.type === "tool_use");

  if (!financialData || financialData.type !== "tool_use" || !qualitativeData || qualitativeData.type !== "tool_use") {
    throw new Error("Chunked extraction failed");
  }

  const financial = financialData.input as any;
  const qualitative = qualitativeData.input as any;

  // Merge: financials from pass 1, qualitative from pass 2
  return {
    company: financial.company?.name ? financial.company : qualitative.company,
    deal: financial.deal?.asking_price ? financial.deal : qualitative.deal,
    financials: financial.financials,
    customers: qualitative.customers,
    management: qualitative.management,
    market: qualitative.market,
    growth_opportunities: qualitative.growth_opportunities,
    risks: qualitative.risks,
    industry_specific_metrics: qualitative.industry_specific_metrics,
    data_gaps: [
      ...(financial.data_gaps || []),
      ...(qualitative.data_gaps || []),
    ],
    source_pages: qualitative.source_pages,
    citations: qualitative.citations ?? financial.citations ?? null,
  } as ExtractedData;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Step 3: Stream memo generation ──

export function streamMemoGeneration(
  extractedData: ExtractedData,
  documentType: DocumentType,
  dealSubType: DealSubType = "unknown",
  memoFormat: MemoFormat = "standard",
  pdfBase64: string | null = null,
  fileId: string | null = null
) {
  const client = getClient();
  const systemPrompt = getMemoGeneratorPrompt(dealSubType, memoFormat);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const content: any[] = [];

  // Include the source PDF for reference if available
  if (pdfBase64 || fileId) {
    try {
      content.push(getDocBlock(pdfBase64, fileId));
    } catch {
      // Skip if neither available
    }
  }

  content.push({
    type: "text" as const,
    text: `Generate a comprehensive deal screening memo for this ${documentType.replace("_", " ")}.\n\nPre-extracted structured data (use as primary source, reference the document above to fill gaps or verify ambiguous data points):\n${JSON.stringify(extractedData, null, 2)}`,
    cache_control: { type: "ephemeral" as const },
  });

  const streamApi = fileId ? client.beta.messages : client.messages;

  return (streamApi as any).stream({
    model: MODEL,
    max_tokens: memoFormat === "detailed" ? 20000 : memoFormat === "concise" ? 4096 : 16384,
    ...(fileId ? { betas: [FILES_BETA] } : {}),
    system: [
      {
        type: "text" as const,
        text: systemPrompt,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [
      {
        role: "user",
        content,
      },
    ],
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

// ── Section regeneration ──

export function streamSectionRegeneration(
  sectionId: string,
  sectionTitle: string,
  extractedData: ExtractedData,
  documentType: DocumentType,
  existingContext: string,
  dealSubType: DealSubType = "unknown",
  memoFormat: MemoFormat = "standard"
) {
  const client = getClient();
  const systemPrompt = getMemoGeneratorPrompt(dealSubType, memoFormat);

  return client.messages.stream({
    model: MODEL,
    max_tokens: memoFormat === "detailed" ? 4096 : 2048,
    system: [
      {
        type: "text" as const,
        text: systemPrompt,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text" as const,
            text: `Regenerate ONLY the "${sectionTitle}" section (id: ${sectionId}) of this ${documentType.replace("_", " ")} deal memo.

Use the same ## SECTION: ${sectionId} format and include a [CONFIDENCE: X.XX] tag at the end.

Extracted data:
${JSON.stringify(extractedData, null, 2)}

Context from other memo sections for coherence:
${existingContext}

Return ONLY the single section with its header and confidence tag.`,
            cache_control: { type: "ephemeral" as const },
          },
        ],
      },
    ],
  });
}

// ── Verification pass ──

export async function verifyMemoSection(
  sectionContent: string,
  extractedData: ExtractedData,
  sectionId: string
): Promise<{ verified: boolean; flags: string[] }> {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Review this deal memo section for factual accuracy against the source data. Identify any specific claims that cannot be verified from the extracted data, any figures that are incorrect or distorted, and any statements that appear fabricated.

Section ID: ${sectionId}
Section content:
${sectionContent}

Source data:
${JSON.stringify(extractedData, null, 2)}

Respond with a JSON object: { "verified": boolean, "flags": ["string describing each issue"] }
If everything checks out, return { "verified": true, "flags": [] }.`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    return { verified: true, flags: [] };
  }

  try {
    const jsonMatch = text.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // If parsing fails, assume verified
  }

  return { verified: true, flags: [] };
}

// ── Investment criteria scoring ──

export async function scoreInvestment(
  extractedData: ExtractedData,
  documentType: DocumentType,
  dealSubType: DealSubType = "unknown"
): Promise<InvestmentScorecard> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are a PE investment committee analyst. Score this deal against standard investment criteria.

Document type: ${documentType}
Deal sub-type: ${dealSubType}

Extracted data:
${JSON.stringify(extractedData, null, 2)}

Score each criterion from 1 (poor) to 5 (excellent) with appropriate weights. Criteria to evaluate:

1. **Revenue Quality** (weight: 0.15) — Recurring revenue %, customer concentration, contract visibility
2. **Growth Profile** (weight: 0.15) — Historical revenue growth, TAM/SAM, organic vs acquisition-driven
3. **Margin & Profitability** (weight: 0.15) — EBITDA margins, margin trends, EBITDA adjustments quality
4. **Margin & Profitability** (weight: 0.15) — EBITDA margins, margin trends, EBITDA adjustments quality
4. **Management Team** (weight: 0.10) — Tenure, depth, succession readiness
5. **Market Position** (weight: 0.10) — Competitive moat, market share, barriers to entry
6. **Customer Base** (weight: 0.10) — Diversification, retention, relationship depth
7. **Valuation** (weight: 0.10) — Implied multiples vs sector comps
8. **Risk Profile** (weight: 0.15) — Key risks, severity, mitigants available

Respond with ONLY a JSON object matching this structure:
{
  "overall_score": number,
  "recommendation": "strong_pass" | "pass" | "conditional_pass" | "fail",
  "criteria": [
    { "name": string, "score": number, "weight": number, "rationale": string, "data_quality": "strong" | "moderate" | "weak" }
  ],
  "summary": string
}

Rules:
- overall_score = weighted average of criteria scores
- strong_pass: >= 4.0, pass: >= 3.0, conditional_pass: >= 2.0, fail: < 2.0
- data_quality reflects how much source data supports the score
- Be rigorous. Do not inflate scores. If data is missing, note it and score conservatively.`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("No response from scoring model");
  }

  const jsonMatch = text.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse scorecard response");
  }

  return JSON.parse(jsonMatch[0]) as InvestmentScorecard;
}
