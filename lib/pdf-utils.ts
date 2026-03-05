import { PDFDocument } from "pdf-lib";

export async function getPdfPageCount(pdfBase64: string): Promise<number> {
  const buffer = Buffer.from(pdfBase64, "base64");
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return pdfDoc.getPageCount();
}

export interface PdfChunk {
  base64: string;
  startPage: number;
  endPage: number;
}

export async function splitPdfByPageRanges(
  pdfBase64: string,
  chunkSize: number = 95
): Promise<PdfChunk[]> {
  const buffer = Buffer.from(pdfBase64, "base64");
  const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const chunks: PdfChunk[] = [];

  for (let start = 0; start < totalPages; start += chunkSize) {
    const end = Math.min(start + chunkSize, totalPages);
    const newDoc = await PDFDocument.create();
    const pageIndices = Array.from({ length: end - start }, (_, i) => start + i);
    const pages = await newDoc.copyPages(srcDoc, pageIndices);
    pages.forEach((page) => newDoc.addPage(page));
    const bytes = await newDoc.save();
    chunks.push({
      base64: Buffer.from(bytes).toString("base64"),
      startPage: start + 1,
      endPage: end,
    });
  }

  return chunks;
}
