import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type {
  ClassificationResult,
  DocumentType,
  ExtractedData,
} from "@/types";
import { CLASSIFICATION_SCHEMA } from "./schemas/classificationSchema";
import { CIM_EXTRACTION_SCHEMA } from "./schemas/cimSchema";
import { TERM_SHEET_EXTRACTION_SCHEMA } from "./schemas/termSheetSchema";
import { FINANCIAL_EXTRACTION_SCHEMA } from "./schemas/financialSchema";
import { CLASSIFIER_SYSTEM_PROMPT } from "./prompts/classifier";
import { CIM_EXTRACTOR_SYSTEM_PROMPT } from "./prompts/cimExtractor";
import { TERM_SHEET_EXTRACTOR_SYSTEM_PROMPT } from "./prompts/termSheetExtractor";
import { FINANCIAL_EXTRACTOR_SYSTEM_PROMPT } from "./prompts/financialExtractor";
import { MEMO_GENERATOR_SYSTEM_PROMPT } from "./prompts/memoGenerator";

const MODEL = "claude-sonnet-4-5-20250929";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

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

// ── Step 1: Classify the document ──

export async function classifyDocument(
  pdfBase64: string
): Promise<ClassificationResult> {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: CLASSIFIER_SYSTEM_PROMPT,
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
          pdfBlock(pdfBase64),
          { type: "text" as const, text: "Classify this document." },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
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
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function extractDocumentData(
  pdfBase64: string,
  documentType: DocumentType
): Promise<ExtractedData> {
  const config = EXTRACTION_CONFIGS[documentType];
  if (!config) throw new Error(`Unsupported document type: ${documentType}`);

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: config.system,
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
          pdfBlock(pdfBase64),
          {
            type: "text" as const,
            text: "Extract all relevant data from this document.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Extraction failed: no tool_use response");
  }
  return toolUse.input as unknown as ExtractedData;
}

// ── Step 3: Stream memo generation ──

export function streamMemoGeneration(
  extractedData: ExtractedData,
  documentType: DocumentType
) {
  const client = getClient();
  return client.messages.stream({
    model: MODEL,
    max_tokens: 8192,
    system: MEMO_GENERATOR_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate a comprehensive deal screening memo for this ${documentType.replace("_", " ")}.\n\nExtracted data:\n${JSON.stringify(extractedData, null, 2)}`,
      },
    ],
  });
}

// ── Section regeneration ──

export function streamSectionRegeneration(
  sectionId: string,
  sectionTitle: string,
  extractedData: ExtractedData,
  documentType: DocumentType,
  existingContext: string
) {
  const client = getClient();
  return client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: MEMO_GENERATOR_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Regenerate ONLY the "${sectionTitle}" section (id: ${sectionId}) of this ${documentType.replace("_", " ")} deal memo.

Use the same ## SECTION: ${sectionId} format and include a [CONFIDENCE: X.XX] tag at the end.

Extracted data:
${JSON.stringify(extractedData, null, 2)}

Context from other memo sections for coherence:
${existingContext}

Return ONLY the single section with its header and confidence tag.`,
      },
    ],
  });
}
