import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { localList } from "./localDb";
import { importWorkbookFile } from "./workbookImport";

describe("local workbook import", () => {
  it("imports a selected xlsx file without network access", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["كود", "البيان", "القيمة"], ["INV-LOCAL", "فاتورة محلية", 120]]), "تحليل المبيعات");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const file = new File([bytes], "local-accounting.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const result = await importWorkbookFile(file);
    expect(result.sheets).toBe(1);
    expect(result.rawImported).toBe(2);
    expect((await localList("rawWorkbookRows")).some(row => row.sheet === "تحليل المبيعات")).toBe(true);
  });
});
