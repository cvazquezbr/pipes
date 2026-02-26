import { describe, it, expect, vi } from "vitest";
import { compressPDF } from "./pdfCompression";
import { PDFDocument } from "pdf-lib";

// Mock pdf-lib
vi.mock("pdf-lib", () => ({
  PDFDocument: {
    load: vi.fn().mockResolvedValue({
      save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    }),
  },
}));

describe("pdfCompression", () => {
  it("should compress a PDF file", async () => {
    const mockFile = new File(["dummy content"], "test.pdf", { type: "application/pdf" });

    const result = await compressPDF(mockFile);

    expect(result).toHaveProperty("blob");
    expect(result).toHaveProperty("originalSize");
    expect(result).toHaveProperty("compressedSize");
    expect(result).toHaveProperty("reductionPercentage");
    expect(PDFDocument.load).toHaveBeenCalled();
  });
});
