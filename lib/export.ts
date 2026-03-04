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
} from "docx";
import type { DealMemoData } from "@/types";

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

  // Key Metrics Table
  const metricEntries = Object.entries(memo.metrics).filter(
    ([, v]) => v !== null
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

  // Memo Sections
  for (const section of memo.sections) {
    children.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 100 },
      })
    );

    const paragraphs = section.content.split("\n\n").filter(Boolean);
    for (const para of paragraphs) {
      const trimmed = para.trim();

      // Handle bullet points
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const bullets = trimmed.split("\n").filter(Boolean);
        for (const bullet of bullets) {
          const text = bullet.replace(/^[-*]\s+/, "");
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              children: [new TextRun({ text, size: 20 })],
              spacing: { after: 50 },
            })
          );
        }
      } else {
        // Handle bold text markers
        const runs: TextRun[] = [];
        const parts = trimmed.split(/(\*\*.*?\*\*)/g);
        for (const part of parts) {
          if (part.startsWith("**") && part.endsWith("**")) {
            runs.push(
              new TextRun({
                text: part.slice(2, -2),
                bold: true,
                size: 20,
              })
            );
          } else {
            runs.push(new TextRun({ text: part, size: 20 }));
          }
        }
        children.push(
          new Paragraph({ children: runs, spacing: { after: 100 } })
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
