import { describe, expect, it } from "vitest";
import { deriveComputedFields } from "./accountingComputedFields";

describe("accounting computed fields", () => {
  it("derives tax amount", () => expect(deriveComputedFields("taxReturns", { taxBase: "1000", rate: "14" }).taxAmount).toBe("140"));
  it("derives production total and unit cost", () => expect(deriveComputedFields("productionCosts", { rawMaterials: "100", directLabor: "50", indirectCosts: "30", unitsProduced: "9" })).toMatchObject({ totalCost: "180", unitCost: "20" }));
  it("derives order total and inventory difference", () => {
    expect(deriveComputedFields("salesOrders", { quantity: "4", unitPrice: "25" }).total).toBe("100");
    expect(deriveComputedFields("physicalInventory", { bookQuantity: "10", actualQuantity: "7" }).difference).toBe("-3");
  });
  it("derives budget and cash flow values", () => {
    expect(deriveComputedFields("budgets", { planned: "200", actual: "150" })).toMatchObject({ difference: "-50", achievementRate: "75" });
    expect(deriveComputedFields("cashFlows", { operating: "100", investing: "-20", financing: "50" }).netCashFlow).toBe("130");
    expect(deriveComputedFields("energyConsumption", { cost: "1000", productionUnits: "200" }).costPerProductionUnit).toBe("5");
  });
});
