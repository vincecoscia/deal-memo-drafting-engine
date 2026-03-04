import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  TableLayoutType,
} from "docx";
import type { DealMemoData } from "@/types";

const LIGHT_GRAY_SHADING = {
  type: ShadingType.CLEAR,
  color: "auto",
  fill: "F2F4F7",
};

const TABLE_BORDER = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: "D0D5DD",
};

const TABLE_BORDERS = {
  top: TABLE_BORDER,
  bottom: TABLE_BORDER,
  left: TABLE_BORDER,
  right: TABLE_BORDER,
  insideHorizontal: TABLE_BORDER,
  insideVertical: TABLE_BORDER,
};

function parseMarkdownTable(block: string): { headers: string[]; rows: string[][] } | null {
  const lines = block.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return null;

  // Check that at least the first two lines look like a table
  if (!lines[0].includes("|") || !lines[1].includes("|")) return null;

  // Second line should be the separator (e.g. |---|---|)
  const separatorLine = lines[1].trim();
  if (!/^[\s|:-]+$/.test(separatorLine)) return null;

  const parseCells = (line: string) =>
    line.split("|").map((c) => c.trim()).filter((c) => c !== "");

  const headers = parseCells(lines[0]);
  const rows = lines.slice(2).map(parseCells);

  return { headers, rows };
}

function buildDocxTable(headers: string[], rows: string[][]): Table {
  const colCount = headers.length;
  const colWidth = Math.floor(100 / colCount);

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (h) =>
        new TableCell({
          shading: LIGHT_GRAY_SHADING,
          width: { size: colWidth, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: buildBoldRuns(h, 18, true),
              spacing: { before: 40, after: 40 },
            }),
          ],
        })
    ),
  });

  const dataRows = rows.map(
    (cells, rowIdx) =>
      new TableRow({
        children: Array.from({ length: colCount }, (_, i) =>
          new TableCell({
            shading: rowIdx % 2 === 1 ? { type: ShadingType.CLEAR, color: "auto", fill: "FAFBFC" } : undefined,
            width: { size: colWidth, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: buildBoldRuns(cells[i] ?? "", 18, false),
                spacing: { before: 20, after: 20 },
              }),
            ],
          })
        ),
      })
  );

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: TABLE_BORDERS,
  });
}

function buildBoldRuns(text: string, size: number, bold: boolean): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*.*?\*\*)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size }));
    } else {
      runs.push(new TextRun({ text: part, bold, size }));
    }
  }
  return runs;
}

function splitContentBlocks(content: string): string[] {
  const lines = content.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let inTable = false;

  for (const line of lines) {
    const isTableLine = line.trim().startsWith("|") || /^\s*[\s|:-]+$/.test(line.trim());

    if (isTableLine) {
      if (!inTable && current.length > 0) {
        blocks.push(current.join("\n"));
        current = [];
      }
      inTable = true;
      current.push(line);
    } else {
      if (inTable) {
        blocks.push(current.join("\n"));
        current = [];
        inTable = false;
      }
      if (line.trim() === "") {
        if (current.length > 0) {
          blocks.push(current.join("\n"));
          current = [];
        }
      } else {
        current.push(line);
      }
    }
  }

  if (current.length > 0) {
    blocks.push(current.join("\n"));
  }

  return blocks;
}

export async function generateDocx(
  memo: DealMemoData,
  documentName: string
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Deal Screening Memo: ${memo.metrics.company_name ?? "Unknown Company"}`,
          bold: true,
          size: 32,
          color: "1B2A4A",
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Subtitle
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Source: ${documentName} | Generated: ${new Date().toLocaleDateString()}`,
          size: 20,
          color: "666666",
          italics: true,
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Key Metrics Table (exclude industry_metrics array — handled separately)
  const metricEntries = Object.entries(memo.metrics).filter(
    ([k, v]) => v !== null && k !== "industry_metrics"
  );
  if (metricEntries.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Key Metrics",
            bold: true,
            size: 24,
            color: "1B2A4A",
          }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );

    const labels: Record<string, string> = {
      company_name: "Company",
      deal_value: "Deal Value",
      revenue: "Revenue",
      ebitda: "EBITDA",
      ebitda_margin: "EBITDA Margin",
      revenue_growth: "Revenue Growth",
      industry: "Industry",
      employee_count: "Employees",
    };

    const rows = metricEntries.map(
      ([key, val]) =>
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: labels[key] ?? key,
                      bold: true,
                      size: 20,
                    }),
                  ],
                }),
              ],
              width: { size: 30, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: String(val), size: 20 })],
                }),
              ],
              width: { size: 70, type: WidthType.PERCENTAGE },
            }),
          ],
        })
    );

    children.push(
      new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );

    children.push(new Paragraph({ spacing: { after: 300 } }));
  }

  // Industry-Specific KPIs
  if (memo.metrics.industry_metrics && memo.metrics.industry_metrics.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Industry KPIs",
            bold: true,
            size: 24,
            color: "1B2A4A",
          }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );

    const kpiRows = memo.metrics.industry_metrics.map(
      (m) =>
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: m.name, bold: true, size: 20 })],
                }),
              ],
              width: { size: 30, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: m.value, size: 20 })],
                }),
              ],
              width: { size: 30, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: m.context ?? "",
                      size: 18,
                      color: "666666",
                      italics: true,
                    }),
                  ],
                }),
              ],
              width: { size: 40, type: WidthType.PERCENTAGE },
            }),
          ],
        })
    );

    children.push(
      new Table({
        rows: kpiRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );

    children.push(new Paragraph({ spacing: { after: 300 } }));
  }

  // Memo Sections
  for (const section of memo.sections) {
    children.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 100 },
      })
    );

    // Split content into blocks, preserving table blocks (consecutive lines with |)
    const blocks = splitContentBlocks(section.content);

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      // Try parsing as a markdown table
      const tableData = parseMarkdownTable(trimmed);
      if (tableData && tableData.headers.length > 0) {
        children.push(buildDocxTable(tableData.headers, tableData.rows));
        children.push(new Paragraph({ spacing: { after: 100 } }));
        continue;
      }

      // Handle bullet points
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const bullets = trimmed.split("\n").filter(Boolean);
        for (const bullet of bullets) {
          const text = bullet.replace(/^[-*]\s+/, "");
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              children: buildBoldRuns(text, 20, false),
              spacing: { after: 50 },
            })
          );
        }
      } else {
        children.push(
          new Paragraph({
            children: buildBoldRuns(trimmed, 20, false),
            spacing: { after: 100 },
          })
        );
      }
    }
  }

  // Risk Flags
  if (memo.risk_flags.length > 0) {
    children.push(
      new Paragraph({
        text: "Risk Flags",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 100 },
      })
    );

    for (const risk of memo.risk_flags) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun({
              text: `[${risk.severity.toUpperCase()}] `,
              bold: true,
              size: 20,
              color:
                risk.severity === "high"
                  ? "C93B3B"
                  : risk.severity === "medium"
                    ? "D4760A"
                    : "2E75B6",
            }),
            new TextRun({ text: risk.description, size: 20 }),
            ...(risk.mitigant
              ? [
                  new TextRun({
                    text: ` — Mitigant: ${risk.mitigant}`,
                    size: 20,
                    italics: true,
                    color: "666666",
                  }),
                ]
              : []),
          ],
          spacing: { after: 50 },
        })
      );
    }
  }

  // Footer
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "This memo was generated by Deal Memo Engine. All data should be verified against source documents.",
          size: 16,
          italics: true,
          color: "999999",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
    })
  );

  const doc = new Document({
    sections: [{ children }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
