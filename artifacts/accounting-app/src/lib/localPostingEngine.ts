import { localDelete, localList, localPut, type LocalRecord, type StoreName } from "./localDb";
import { calculateDepreciation, calculateExchangeDifference, calculatePayroll } from "./accountingCalculations";
import { calculateInventoryValuation } from "./inventoryValuation";

export type AccountingStore = StoreName;

const number = (value: unknown) => Number(value ?? 0) || 0;
const text = (value: unknown) => String(value ?? "").trim();
const cashStore = "cashTransactions" as AccountingStore;
const inventoryStore = "inventoryMovements" as AccountingStore;
const linksStore = "postingLinks" as AccountingStore;

type Posting = LocalRecord & {
  sourceStore: AccountingStore;
  sourceId: string;
  postingId: string;
  postingType: string;
  postingStatus: "مرحل" | "معكوس";
  linkedAccount?: string;
  reversalOf?: string;
};

function ownerOf(source: LocalRecord) {
  return source.ownerId ? { ownerId: source.ownerId } : {};
}

function postingId(source: LocalRecord, type: string) {
  return `${source.id}::${type}`;
}

function basePosting(sourceStore: AccountingStore, source: LocalRecord, type: string, extra: Record<string, unknown> = {}): Posting {
  const debit = number(extra.debit);
  const credit = number(extra.credit);
  const account = text(extra.account || extra.linkedAccount || "الحساب الرئيسي");
  const contraAccount = text(extra.contraAccount || "الحساب المقابل");
  const journalLines = debit || credit ? [
    { account, debit: debit || credit, credit: 0 },
    { account: contraAccount, debit: 0, credit: debit || credit },
  ] : undefined;
  return {
    id: postingId(source, type),
    updatedAt: new Date().toISOString(),
    sourceStore,
    sourceId: source.id,
    postingId: postingId(source, type),
    postingType: type,
    postingStatus: "مرحل",
    generated: true,
    sourceName: text(source.name || source.code || source.id),
    name: text(source.name || source.code || source.id),
    date: source.date || new Date().toISOString().slice(0, 10),
    ...ownerOf(source),
    relationRefs: source.relationRefs ?? [],
    ...(journalLines ? { journalLines, balanced: journalLines.reduce((sum, line) => sum + line.debit, 0) === journalLines.reduce((sum, line) => sum + line.credit, 0) } : {}),
    ...extra,
  };
}

function journalLines(lines: Array<{ account: string; debit?: number; credit?: number; description?: string }>) {
  return lines.map(line => ({
    account: line.account,
    debit: number(line.debit),
    credit: number(line.credit),
    ...(line.description ? { description: line.description } : {}),
  }));
}

function paymentDirection(method: string, sale: boolean) {
  if (method === "آجل" || method === "" || method === "غير محدد") return undefined;
  return sale ? "قبض" : "صرف";
}

function canPostSource(source: LocalRecord) {
  const status = text(source.status);
  if (!status) return true;
  return !["مسودة", "قيد المراجعة", "مطلوب", "مطلوبة", "معلق", "ملغي", "ملغى", "مرفوض"].includes(status);
}

function invoicePostings(sourceStore: AccountingStore, source: LocalRecord): Posting[] {
  const invoiceType = text(source.invoiceType);
  const isSale = invoiceType === "مبيعات" || invoiceType === "مرتجع مبيعات";
  const isReturn = invoiceType.startsWith("مرتجع");
  const sign = isReturn ? -1 : 1;
  const total = (number(source.total) || number(source.subtotal) + number(source.tax)) * sign;
  const paid = number(source.paid) * sign;
  const method = text(source.paymentMethod || (isSale ? source.collectionMethod : source.paymentMethod));
  const subtotal = Math.abs(number(source.subtotal) || Math.abs(total) - Math.abs(number(source.tax)));
  const tax = Math.abs(number(source.tax));
  const settlementAccount = method && method !== "آجل" ? method : (isSale ? "العملاء" : "الموردون");
  const journal = isReturn
    ? (isSale
      ? journalLines([
        { account: "مرتجعات المبيعات", debit: subtotal },
        ...(tax ? [{ account: "ضريبة المخرجات", debit: tax }] : []),
        { account: settlementAccount, credit: Math.abs(total) },
      ])
      : journalLines([
        { account: settlementAccount, debit: Math.abs(total) },
        { account: "مرتجعات المشتريات", credit: subtotal },
        ...(tax ? [{ account: "ضريبة المدخلات", credit: tax }] : []),
      ]))
    : (isSale
      ? journalLines([
        { account: settlementAccount, debit: Math.abs(total) },
        { account: "إيرادات المبيعات", credit: subtotal },
        ...(tax ? [{ account: "ضريبة المخرجات", credit: tax }] : []),
      ])
      : journalLines([
        { account: "المخزون أو المشتريات", debit: subtotal },
        ...(tax ? [{ account: "ضريبة المدخلات", debit: tax }] : []),
        { account: settlementAccount, credit: Math.abs(total) },
      ]));
  const result: Posting[] = [basePosting(sourceStore, source, "قيد", {
    debit: journal.reduce((sum, line) => sum + line.debit, 0),
    credit: journal.reduce((sum, line) => sum + line.credit, 0),
    journalLines: journal,
    account: journal[0]?.account,
    contraAccount: journal.at(-1)?.account,
    reference: source.code || source.id,
    invoiceType,
  })];
  if (paid !== 0 && paymentDirection(method, isSale)) result.push(basePosting(sourceStore, source, "حركة نقدية", { direction: paymentDirection(method, isSale), amount: Math.abs(paid), account: method, paymentMethod: method, cashFlowType: isSale ? "تشغيلي - تحصيل مبيعات" : "تشغيلي - سداد مشتريات" }));
  const items = text(source.items);
  const quantity = number(source.quantity) || (items ? 1 : 0);
  if (quantity > 0) result.push(basePosting(sourceStore, source, "حركة مخزون", { direction: isSale ? (isReturn ? "وارد" : "منصرف") : (isReturn ? "منصرف" : "وارد"), quantity: Math.abs(quantity), product: text(source.product || source.item || items), warehouse: text(source.warehouse), unitPrice: Math.abs(number(source.unitPrice) || number(source.subtotal) / quantity) }));
  const costPrice = Math.abs(number(source.costPrice) || number(source.purchasePrice));
  if (isSale && quantity > 0 && costPrice > 0) {
    const cost = Math.abs(quantity * costPrice);
    result.push(basePosting(sourceStore, source, "قيد تكلفة مبيعات", {
      debit: cost,
      credit: cost,
      costOfGoodsSold: cost,
      journalLines: journalLines(isReturn
        ? [{ account: "المخزون", debit: cost }, { account: "تكلفة المبيعات", credit: cost }]
        : [{ account: "تكلفة المبيعات", debit: cost }, { account: "المخزون", credit: cost }]),
    }));
  }
  if (number(source.tax) !== 0) result.push(basePosting(sourceStore, source, "ضريبة", { direction: isSale ? (isReturn ? "عكس مخرجات" : "مخرجات") : (isReturn ? "عكس مدخلات" : "مدخلات"), amount: Math.abs(number(source.tax)), taxBase: Math.abs(number(source.subtotal)), rate: source.taxRate }));
  if (isSale) result.push(basePosting(sourceStore, source, "إيراد", { amount: Math.abs(total), customer: source.party, netSales: total }));
  else result.push(basePosting(sourceStore, source, "تكلفة أو مشتريات", { amount: Math.abs(total), supplier: source.party }));
  return result;
}

function returnPostings(sourceStore: AccountingStore, source: LocalRecord): Posting[] {
  const isSalesReturn = sourceStore === "salesReturns";
  const amount = Math.abs(number(source.amount) || number(source.total));
  const quantity = Math.abs(number(source.quantity));
  const tax = Math.abs(number(source.tax));
  const subtotal = Math.max(0, amount - tax);
  const party = text(source.customer || source.supplier || (isSalesReturn ? "العملاء" : "الموردون"));
  const lines = isSalesReturn
    ? journalLines([
      { account: "مرتجعات المبيعات", debit: subtotal },
      ...(tax ? [{ account: "ضريبة المخرجات", debit: tax }] : []),
      { account: party, credit: amount },
    ])
    : journalLines([
      { account: party, debit: amount },
      { account: "مرتجعات المشتريات", credit: subtotal },
      ...(tax ? [{ account: "ضريبة المدخلات", credit: tax }] : []),
    ]);
  const result: Posting[] = [
    basePosting(sourceStore, source, "قيد مرتجع", {
      debit: lines.reduce((sum, line) => sum + line.debit, 0),
      credit: lines.reduce((sum, line) => sum + line.credit, 0),
      journalLines: lines,
      account: lines[0]?.account,
      contraAccount: lines.at(-1)?.account,
      amount,
      reference: source.invoiceCode || source.code || source.id,
      returnType: isSalesReturn ? "مرتجع مبيعات" : "مرتجع مشتريات",
    }),
  ];
  if (quantity > 0) result.push(basePosting(sourceStore, source, "حركة مخزون", {
    direction: isSalesReturn ? "وارد" : "منصرف",
    quantity,
    product: source.product,
    warehouse: source.warehouse,
  }));
  return result;
}

function sourcePostings(sourceStore: AccountingStore, source: LocalRecord): Posting[] {
  const amount = number(source.amount) || number(source.total) || number(source.totalCost) || number(source.netSalary) || number(source.value) || number(source.taxAmount) || number(source.contractValue) || number(source.principal) || number(source.investmentValue) || number(source.premium) || number(source.monthlyRent) || number(source.shippingCost) || number(source.receivingCost) || number(source.allowance) || Math.abs(number(source.exchangeDifference));
  if (sourceStore === "invoices") return invoicePostings(sourceStore, source);
  if (sourceStore === "salesReturns" || sourceStore === "purchaseReturns") return returnPostings(sourceStore, source);
  if (sourceStore === "expenses" && amount) return [
    basePosting(sourceStore, source, "حركة نقدية", { direction: "صرف", amount, account: source.paymentMethod || "خزينة", category: source.category, cashFlowType: "تشغيلي - مصروف" }),
    basePosting(sourceStore, source, "مصروف", { amount, category: source.category, costCenter: source.costCenter, tax: source.tax }),
    basePosting(sourceStore, source, "قيد", { debit: amount, credit: amount, account: source.category || "المصروفات", contraAccount: source.paymentMethod || "الخزينة" }),
  ];
  if (sourceStore === "revenues" && amount) return [
    basePosting(sourceStore, source, "حركة نقدية", { direction: "قبض", amount, account: source.collectionMethod || "خزينة", source: source.source, cashFlowType: "تشغيلي - إيراد" }),
    basePosting(sourceStore, source, "إيراد", { amount, source: source.source, costCenter: source.costCenter }),
    basePosting(sourceStore, source, "قيد", { debit: amount, credit: amount, account: source.collectionMethod || "الخزينة", contraAccount: source.source || "الإيرادات" }),
  ];
  if (sourceStore === "payroll" && amount) {
    const payroll = calculatePayroll(source);
    const gross = payroll.grossSalary || amount;
    const net = payroll.netSalary || Math.max(0, gross - number(source.deductions));
    const result: Posting[] = [
      basePosting(sourceStore, source, "حركة نقدية", { direction: "صرف", amount: net, account: source.paymentMethod || "خزينة", cashFlowType: "تشغيلي - رواتب", employee: source.name }),
      basePosting(sourceStore, source, "مصروف رواتب", { amount: gross, department: source.department, employee: source.name, deductions: payroll.totalDeductions }),
      basePosting(sourceStore, source, "قيد رواتب", {
        debit: gross,
        credit: gross,
        incomeTax: payroll.incomeTax,
        employeeSocialInsurance: payroll.employeeSocialInsurance,
        journalLines: journalLines([
          { account: "مصروف الرواتب", debit: gross },
          ...(payroll.incomeTax ? [{ account: "ضرائب كسب العمل", credit: payroll.incomeTax }] : []),
          ...(payroll.employeeSocialInsurance ? [{ account: "تأمينات اجتماعية مستحقة", credit: payroll.employeeSocialInsurance }] : []),
          { account: String(source.paymentMethod || "الخزينة"), credit: net },
          ...(gross - payroll.incomeTax - payroll.employeeSocialInsurance - net > 0 ? [{ account: "استقطاعات أخرى مستحقة", credit: gross - payroll.incomeTax - payroll.employeeSocialInsurance - net }] : []),
        ]),
      }),
    ];
    if (payroll.employerSocialInsurance > 0) result.push(basePosting(sourceStore, source, "قيد حصة صاحب العمل", { debit: payroll.employerSocialInsurance, credit: payroll.employerSocialInsurance, journalLines: journalLines([{ account: "مصروف تأمينات صاحب العمل", debit: payroll.employerSocialInsurance }, { account: "تأمينات اجتماعية مستحقة", credit: payroll.employerSocialInsurance }]) }));
    return result;
  }
  if (sourceStore === "fixedAssets" && amount) {
    const result = [
      basePosting(sourceStore, source, "حركة نقدية", { direction: "صرف", amount, account: source.paymentMethod || "بنك", cashFlowType: "استثماري - شراء أصل" }),
      basePosting(sourceStore, source, "قيد أصل", {
        debit: amount,
        credit: amount,
        account: source.name,
        contraAccount: source.paymentMethod || "البنك",
        journalLines: journalLines([
          { account: source.name ? String(source.name) : "الأصول الثابتة", debit: amount },
          { account: String(source.paymentMethod || "البنك"), credit: amount },
        ]),
      }),
    ];
    const calculatedDepreciation = calculateDepreciation(source);
    const depreciation = Math.min(Math.max(0, number(source.periodDepreciation) || calculatedDepreciation.depreciation), Math.max(0, number(source.value) - number(source.accumulatedDepreciation)));
    if (depreciation > 0 && ["معتمد", "مرحل"].includes(text(source.status))) {
      result.push(basePosting(sourceStore, source, "قيد إهلاك", {
        debit: depreciation,
        credit: depreciation,
        depreciationPeriod: source.period || source.date || new Date().toISOString().slice(0, 7),
        journalLines: journalLines([
          { account: "مصروف الإهلاك", debit: depreciation },
          { account: "مجمع الإهلاك", credit: depreciation },
        ]),
      }));
    }
    return result;
  }
  if (sourceStore === "currencies" && Math.abs(number(source.exchangeDifference)) > 0 && ["معتمد", "مرحل", "مقفل"].includes(text(source.status))) {
    const exchange = calculateExchangeDifference({ foreignAmount: source.foreignAmount, bookRate: source.bookRate || source.rate, closingRate: source.closingRate || source.rate });
    const gain = exchange.difference >= 0;
    const amount = Math.abs(exchange.difference);
    return [basePosting(sourceStore, source, "قيد فروق عملة", {
      debit: amount,
      credit: amount,
      amount,
      direction: exchange.direction,
      journalLines: journalLines(gain
        ? [{ account: "أرصدة العملات", debit: amount }, { account: "أرباح فروق عملة", credit: amount }]
        : [{ account: "خسائر فروق عملة", debit: amount }, { account: "أرصدة العملات", credit: amount }]),
    })];
  }
  if (sourceStore === "taxReturns" && amount && ["مسدد", "مدفوع", "معتمد"].includes(text(source.status))) return [basePosting(sourceStore, source, "حركة نقدية", { direction: "صرف", amount, account: source.paymentMethod || "بنك", cashFlowType: "تشغيلي - ضرائب" }), basePosting(sourceStore, source, "قيد ضريبة", { debit: amount, credit: amount, account: "التزامات ضريبية", contraAccount: source.paymentMethod || "البنك" })];
  if (sourceStore === "productionCosts" && amount) return [basePosting(sourceStore, source, "حركة مخزون", { direction: "منصرف", quantity: number(source.rawMaterials), product: "مواد خام", warehouse: source.warehouse }), basePosting(sourceStore, source, "قيد تكلفة إنتاج", { debit: amount, credit: amount, account: "تكلفة الإنتاج", contraAccount: "المخزون" })];
  if (sourceStore === "socialInsurance" && amount && ["مسدد", "مدفوع", "معتمد"].includes(text(source.status))) return [basePosting(sourceStore, source, "حركة نقدية", { direction: "صرف", amount, account: source.paymentMethod || "بنك", cashFlowType: "تشغيلي - تأمينات", employee: source.employee }), basePosting(sourceStore, source, "قيد تأمينات", { debit: amount, credit: amount, account: "مصروف التأمينات", contraAccount: source.paymentMethod || "البنك" })];
  if (sourceStore === "adjustments" && amount) return [basePosting(sourceStore, source, "قيد تسوية", { debit: amount, credit: amount, account: source.account || "حساب التسوية", reason: source.reason })];
  if (sourceStore === "purchaseOrders" && text(source.status) === "تم الاستلام" && amount) return [basePosting(sourceStore, source, "حركة مخزون", { direction: "وارد", quantity: number(source.quantity), product: source.products || source.name, warehouse: source.warehouse }), basePosting(sourceStore, source, "قيد مشتريات", { debit: amount, credit: amount, account: "المخزون", contraAccount: "الموردون" })];
  if (sourceStore === "salesOrders" && text(source.status) === "تم التسليم" && amount) return [basePosting(sourceStore, source, "حركة مخزون", { direction: "منصرف", quantity: number(source.quantity), product: source.products || source.name, warehouse: source.warehouse }), basePosting(sourceStore, source, "قيد مبيعات", { debit: amount, credit: amount, account: "العملاء", contraAccount: "المبيعات" })];
  if (sourceStore === "receivingReports" && number(source.receivedQuantity)) return [basePosting(sourceStore, source, "حركة مخزون", { direction: "وارد", quantity: number(source.receivedQuantity), product: source.receivedProducts, warehouse: source.warehouse }), basePosting(sourceStore, source, "قيد استلام", { debit: number(source.amount), credit: number(source.amount), account: "المخزون", contraAccount: "الموردون" })];
  if (sourceStore === "shippingReports" && number(source.shippedQuantity)) return [basePosting(sourceStore, source, "حركة مخزون", { direction: "منصرف", quantity: number(source.shippedQuantity), product: source.shippedProducts, warehouse: source.warehouse }), basePosting(sourceStore, source, "قيد شحن", { debit: number(source.amount), credit: number(source.amount), account: "تكلفة المبيعات", contraAccount: "المخزون" })];
  if (sourceStore === "paymentOrders" && amount && ["تم الصرف", "معتمد", "تم التنفيذ"].includes(text(source.status))) return [basePosting(sourceStore, source, "حركة نقدية", { direction: "صرف", amount, account: source.paymentMethod || "الخزينة", beneficiary: source.beneficiary, cashFlowType: "تشغيلي - أمر صرف" }), basePosting(sourceStore, source, "قيد أمر صرف", { debit: amount, credit: amount, account: source.debitAccount || "المصروفات", contraAccount: source.creditAccount || source.paymentMethod || "الخزينة" })];
  if (sourceStore === "collectionOrders" && amount && ["تم التحصيل", "معتمد", "تم التنفيذ"].includes(text(source.status))) return [basePosting(sourceStore, source, "حركة نقدية", { direction: "قبض", amount, account: source.paymentMethod || "الخزينة", party: source.collector, cashFlowType: "تشغيلي - أمر تحصيل" }), basePosting(sourceStore, source, "قيد أمر تحصيل", { debit: amount, credit: amount, account: source.debitAccount || source.paymentMethod || "الخزينة", contraAccount: source.creditAccount || "العملاء" })];
  if (sourceStore === "inventoryTransferOrders" && number(source.quantity) && ["تم التحويل", "معتمد", "تم التنفيذ"].includes(text(source.status))) return [basePosting(sourceStore, source, "حركة مخزون من", { direction: "منصرف تحويل", quantity: number(source.quantity), product: source.product, warehouse: source.fromWarehouse }), basePosting(sourceStore, source, "حركة مخزون إلى", { direction: "وارد تحويل", quantity: number(source.quantity), product: source.product, warehouse: source.toWarehouse })];
  if (sourceStore === "cashTransferOrders" && amount && ["تم التحويل", "معتمد", "تم التنفيذ"].includes(text(source.status))) return [basePosting(sourceStore, source, "حركة نقدية من", { direction: "صرف", amount, account: source.fromAccount, cashFlowType: "تحويل داخلي" }), basePosting(sourceStore, source, "حركة نقدية إلى", { direction: "قبض", amount, account: source.toAccount, cashFlowType: "تحويل داخلي" })];
  if (sourceStore === "advances" && amount && ["قائمة", "معتمد", "تم التنفيذ"].includes(text(source.status))) return [basePosting(sourceStore, source, "حركة نقدية", { direction: "صرف", amount, account: source.paymentMethod || "الخزينة", cashFlowType: "تشغيلي - سلفة", recipient: source.recipient }), basePosting(sourceStore, source, "قيد سلفة", { debit: amount, credit: amount, account: "سلف وعهد", contraAccount: source.paymentMethod || "الخزينة" })];
  if (sourceStore === "installments" && number(source.paidInstallments) > 0 && number(source.installmentValue) > 0) { const paid = number(source.paidInstallments) * number(source.installmentValue); return [basePosting(sourceStore, source, "حركة نقدية", { direction: "قبض", amount: paid, account: source.paymentMethod || "الخزينة", cashFlowType: "تشغيلي - قسط عميل", customer: source.customer }), basePosting(sourceStore, source, "قيد تقسيط", { debit: paid, credit: paid, account: source.paymentMethod || "الخزينة", contraAccount: "العملاء" })]; }
  if (sourceStore === "annualClosings" && ["معتمد", "تم التنفيذ"].includes(text(source.status))) return [basePosting(sourceStore, source, "قيد إقفال سنوي", { debit: number(source.expensesClosed), credit: number(source.revenueClosed), account: "ملخص الدخل", contraAccount: "الأرباح المحتجزة" })];
  if (sourceStore === "claims" && amount && text(source.status) === "تم الحل" && text(source.claimType) === "مورد") return [basePosting(sourceStore, source, "حركة نقدية", { direction: "صرف", amount, account: source.paymentMethod || "الخزينة", cashFlowType: "تشغيلي - مطالبة مورد" }), basePosting(sourceStore, source, "قيد مطالبة", { debit: amount, credit: amount, account: "مطالبات الموردين", contraAccount: source.paymentMethod || "الخزينة" })];
  if (["productionOrders", "maintenanceOrders", "travelOrders", "shippingOrders", "receivingOrders", "customsClearance", "leases", "loans", "investments", "insurancePolicies", "donations", "projects"].includes(sourceStore) && amount && ["تم التنفيذ", "تم الإنتاج", "تم الشحن", "تم الاستلام", "تم التخليص", "معتمد", "مسدد"].includes(text(source.status))) {
    const isInflow = sourceStore === "loans" || sourceStore === "investments" || sourceStore === "projects" && number(source.receivedPayments) > 0;
    return [basePosting(sourceStore, source, "حركة نقدية", { direction: isInflow ? "قبض" : "صرف", amount, account: source.paymentMethod || source.financier || "الخزينة", cashFlowType: `تشغيلي - ${sourceStore}` }), basePosting(sourceStore, source, "قيد أمر", { debit: amount, credit: amount, account: source.name || sourceStore, contraAccount: source.paymentMethod || source.financier || "الخزينة" })];
  }
  if (sourceStore === "productionOrders" && (number(source.consumedQuantity) || number(source.producedQuantity))) return [basePosting(sourceStore, source, "حركة مخزون إنتاج", { direction: "منصرف", quantity: number(source.consumedQuantity), product: source.rawMaterials, warehouse: source.warehouse }), basePosting(sourceStore, source, "حركة مخزون منتج", { direction: "وارد", quantity: number(source.producedQuantity), product: source.product, warehouse: source.warehouse })];
  if (sourceStore === "physicalInventory" && number(source.difference) !== 0) return [basePosting(sourceStore, source, "حركة مخزون", { direction: number(source.difference) > 0 ? "وارد تسوية" : "منصرف تسوية", quantity: Math.abs(number(source.difference)), product: source.product || source.name, warehouse: source.warehouse }), basePosting(sourceStore, source, "قيد تسوية", { debit: Math.abs(number(source.difference)), credit: Math.abs(number(source.difference)), account: "فروق الجرد", contraAccount: "المخزون" })];
  if ((sourceStore === "cheques" || sourceStore === "commercialPapers") && amount && ["محصل", "مسدد", "مسددة", "مقبوض", "تحصيل", "سداد"].includes(text(source.status))) return [basePosting(sourceStore, source, "حركة نقدية", { direction: sourceStore === "cheques" ? "قبض" : "صرف", amount, account: source.bank || "بنك", cashFlowType: "تشغيلي - أوراق تجارية" }), basePosting(sourceStore, source, "قيد أوراق تجارية", { debit: amount, credit: amount, account: "أوراق تجارية", contraAccount: source.bank || "البنك" })];
  return [];
}

async function writePosting(targetStore: AccountingStore, posting: Posting) {
  await localPut(targetStore, posting);
  await localPut(linksStore, { id: `${posting.sourceId}::${posting.postingType}::link`, updatedAt: new Date().toISOString(), sourceStore: posting.sourceStore, sourceId: posting.sourceId, postingId: posting.postingId, targetStore, targetId: posting.id, postingType: posting.postingType, ...(posting.ownerId ? { ownerId: posting.ownerId } : {}) });
}

async function recalculateBalances() {
  const [accounts, cashRows, products, inventoryRows] = await Promise.all([
    localList<LocalRecord>("cashAccounts"),
    localList<LocalRecord>(cashStore),
    localList<LocalRecord>("products"),
    localList<LocalRecord>(inventoryStore),
  ]);
  for (const account of accounts) {
    const accountName = text(account.name || account.code || account.bankName);
    const related = cashRows.filter(row => row.postingStatus !== "معكوس" && (text(row.account) === accountName || (text(row.account) === text(account.accountType) && text(account.accountType) !== "")));
    const balance = number(account.openingBalance) + related.reduce((sum, row) => sum + (row.direction === "قبض" ? number(row.amount) : -number(row.amount)), 0);
    await localPut("cashAccounts", { ...account, currentBalance: String(balance), balanceUpdatedAt: new Date().toISOString() });
  }
  for (const product of products) {
    const baseQuantity = product.baseQuantity === undefined ? number(product.quantity) : number(product.baseQuantity);
    const productName = text(product.name || product.code || product.id);
    const related = inventoryRows.filter(row => row.postingStatus !== "معكوس" && (text(row.product) === productName || text(row.product) === text(product.code)));
    const quantity = baseQuantity + related.reduce((sum, row) => sum + (String(row.direction).includes("وارد") ? number(row.quantity) : -number(row.quantity)), 0);
    await localPut("products", { ...product, baseQuantity: String(baseQuantity), quantity: String(quantity), balanceUpdatedAt: new Date().toISOString() });
  }
}

export async function reverseSourcePostings(sourceStore: AccountingStore, sourceId: string) {
  const links = await localList<LocalRecord>(linksStore);
  const related = links.filter(link => link.sourceStore === sourceStore && link.sourceId === sourceId);
  for (const link of related) {
    const target = await localList<LocalRecord>(link.targetStore as AccountingStore);
    const current = target.find(row => row.id === link.targetId);
    if (current) await localPut(link.targetStore as AccountingStore, { ...current, postingStatus: "معكوس", reversalOf: current.postingId, updatedAt: new Date().toISOString() });
    await localDelete(linksStore, link.id);
  }
  await recalculateBalances();
}

export async function syncSourcePostings(sourceStore: AccountingStore, source: LocalRecord) {
  if ([cashStore, inventoryStore, linksStore, "journalEntries", "auditLogs"].includes(sourceStore)) return [];
  await reverseSourcePostings(sourceStore, source.id);
  if (!canPostSource(source)) {
    await recalculateBalances();
    return [];
  }
  const postingsSource = await enrichInventoryCost(sourceStore, source);
  const postings = sourcePostings(sourceStore, postingsSource);
  for (const posting of postings) {
    if (Array.isArray(posting.journalLines) && posting.balanced !== true) throw new Error(`تعذر ترحيل ${source.id}: القيد ${posting.postingType} غير متوازن`);
    const targetStore = posting.postingType.startsWith("حركة نقدية") ? cashStore : posting.postingType.startsWith("حركة مخزون") ? inventoryStore : posting.postingType === "قيد" || posting.postingType.startsWith("قيد") ? "journalEntries" as AccountingStore : posting.postingType === "إيراد" ? "revenues" : posting.postingType === "مصروف" || posting.postingType === "مصروف رواتب" ? "expenses" : posting.postingType === "ضريبة" || posting.postingType === "قيد ضريبة" ? "taxReturns" : "reportSnapshots" as AccountingStore;
    await writePosting(targetStore, posting);
  }
  await recalculateBalances();
  return postings;
}

async function enrichInventoryCost(sourceStore: AccountingStore, source: LocalRecord) {
  if (sourceStore !== "invoices" || !["مبيعات", "مرتجع مبيعات"].includes(text(source.invoiceType)) || number(source.costPrice) > 0 || number(source.purchasePrice) > 0) return source;
  const products = await localList<LocalRecord>("products");
  const productCode = text(source.productCode || source.product);
  const product = products.find(row => (productCode && [row.code, row.productCode].some(value => text(value) === productCode)) || text(row.name) === text(source.product));
  if (!product) return source;
  const movements = await localList<LocalRecord>(inventoryStore);
  const productName = text(product.name || product.code);
  const related = movements.filter(row => text(row.product) === productName || text(row.productCode) === text(product.code));
  const method = text(product.inventoryValuationMethod) === "FIFO" ? "FIFO" : "AVERAGE";
  const valuation = related.length ? calculateInventoryValuation(related, method) : null;
  const averageCost = valuation && valuation.endingQuantity > 0 ? valuation.endingValue / valuation.endingQuantity : number(product.purchasePrice);
  return { ...source, costPrice: averageCost, inventoryValuationMethod: method };
}

export const buildSourcePostings = sourcePostings;
