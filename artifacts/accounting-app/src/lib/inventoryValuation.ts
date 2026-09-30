export type InventoryMovement = {
  [key: string]: unknown;
  productCode?: unknown;
  product?: unknown;
  direction?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  costPrice?: unknown;
  date?: unknown;
};

export type InventoryValuation = {
  method: "FIFO" | "AVERAGE";
  product: string;
  endingQuantity: number;
  endingValue: number;
  costOfGoodsSold: number;
  layers: Array<{ quantity: number; unitCost: number }>;
};

const finite = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const isInbound = (movement: InventoryMovement) => String(movement.direction ?? "").includes("وارد") || String(movement.direction ?? "").includes("استلام");

export function calculateInventoryValuation(movements: InventoryMovement[], method: "FIFO" | "AVERAGE" = "AVERAGE"): InventoryValuation {
  const ordered = [...movements].sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
  const product = String(ordered[0]?.productCode ?? ordered[0]?.product ?? "");
  const layers: Array<{ quantity: number; unitCost: number }> = [];
  let costOfGoodsSold = 0;
  for (const movement of ordered) {
    const quantity = Math.max(0, finite(movement.quantity));
    const unitCost = Math.max(0, finite(movement.costPrice) || finite(movement.unitPrice));
    if (!quantity) continue;
    if (isInbound(movement)) {
      layers.push({ quantity, unitCost });
      continue;
    }
    let remaining = quantity;
    if (method === "FIFO") {
      while (remaining > 0 && layers.length) {
        const layer = layers[0];
        const used = Math.min(remaining, layer.quantity);
        costOfGoodsSold += used * layer.unitCost;
        layer.quantity -= used;
        remaining -= used;
        if (layer.quantity <= 0) layers.shift();
      }
    } else {
      const availableQuantity = layers.reduce((sum, layer) => sum + layer.quantity, 0);
      const availableValue = layers.reduce((sum, layer) => sum + layer.quantity * layer.unitCost, 0);
      const averageCost = availableQuantity > 0 ? availableValue / availableQuantity : unitCost;
      costOfGoodsSold += Math.min(quantity, availableQuantity) * averageCost;
      remaining = Math.max(0, quantity - availableQuantity);
      if (availableQuantity > 0) {
        let toRemove = Math.min(quantity, availableQuantity);
        for (const layer of layers) {
          const used = Math.min(toRemove, layer.quantity);
          layer.quantity -= used;
          toRemove -= used;
          if (toRemove <= 0) break;
        }
        while (layers[0]?.quantity <= 0) layers.shift();
      }
    }
    if (remaining > 0 && unitCost > 0) costOfGoodsSold += remaining * unitCost;
  }
  const endingQuantity = layers.reduce((sum, layer) => sum + layer.quantity, 0);
  const endingValue = layers.reduce((sum, layer) => sum + layer.quantity * layer.unitCost, 0);
  return { method, product, endingQuantity, endingValue, costOfGoodsSold, layers };
}