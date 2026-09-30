import { describe, expect, it } from "vitest";
import { STORE_NAMES } from "./localDb";
import { erpModules, modulePath } from "./moduleCatalog";
import { sectionDefinitions } from "./accountingFieldDefinitions";

describe("ERP module catalog integrity", () => {
  it("maps every catalog store to a supported local store and CRUD definition", () => {
    const sections = erpModules.flatMap(module => module.sections);
    const stores = sections.map(section => section.store).filter((store): store is keyof typeof sectionDefinitions => Boolean(store));
    expect(stores.length).toBeGreaterThanOrEqual(50);
    expect(new Set(stores).size).toBeGreaterThanOrEqual(50);
    for (const store of stores) {
      expect(STORE_NAMES).toContain(store);
      expect(sectionDefinitions[store]).toBeDefined();
      expect(sectionDefinitions[store].fields.length).toBeGreaterThan(0);
    }
  });

  it("gives every catalog section a navigable local path or report path", () => {
    for (const section of erpModules.flatMap(module => module.sections)) {
      expect(modulePath(section)).toMatch(/^\//);
    }
  });
});
