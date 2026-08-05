import { PrismaClient, type InvoiceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_ADMIN_USERNAME = "admin";
const SEED_ADMIN_PASSWORD = "ChangeMe123!";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

const ITEMS_POOL = [
  { name: "Consulting Session", price: 5000 },
  { name: "Web Design", price: 15000 },
  { name: "Logo Design", price: 8000 },
  { name: "Hosting (Monthly)", price: 2500 },
  { name: "Domain Registration", price: 3500 },
  { name: "SEO Audit", price: 6000 },
  { name: "Social Media Package", price: 12000 },
  { name: "Business Card Printing", price: 1800 },
  { name: "Flyer Printing", price: 2200 },
  { name: "Photography Session", price: 9000 },
  { name: "Video Editing", price: 7000 },
  { name: "Maintenance Retainer", price: 4000 },
] as const;

const CUSTOMERS = [
  { name: "Kamal Perera", phone: "0771234567", address: "12 Kandy Road, Colombo 07", taxId: "134567891-2000" },
  { name: "Nimali Fernando", phone: "0712345678", address: "45 Galle Road, Colombo 04", taxId: null },
  { name: "Suresh Bandara", phone: "0765554433", address: "8 Negombo Road, Wattala", taxId: "134567892-3000" },
  { name: "Anusha Jayasinghe", phone: "0778889900", address: "23 High Level Road, Nugegoda", taxId: null },
  { name: "Ruwan Silva", phone: "0701112233", address: "6 Union Place, Colombo 02", taxId: "134567893-4000" },
  { name: "Dilani Wickramasinghe", phone: "0754443322", address: "19 Baseline Road, Colombo 09", taxId: null },
  { name: "Chamara Rathnayake", phone: "0769998877", address: "31 Main Street, Kandy", taxId: null },
  { name: "Priyanka de Silva", phone: "0723334455", address: "14 Temple Road, Mount Lavinia", taxId: "134567894-5000" },
] as const;

const PAYMENT_MODES = ["Cash", "Card", "Bank Transfer", "Cheque"] as const;
const PLACES_OF_SUPPLY = ["Colombo", "Kandy", "Galle", "Negombo", "Kurunegala"] as const;
const ADDITIONAL_NOTES = [
  "",
  "",
  "",
  "Please handle with care.",
  "Urgent delivery requested.",
  "Deliver during business hours only.",
] as const;

async function main() {
  console.log("Clearing existing data...");
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.businessSettings.deleteMany();
  await prisma.user.deleteMany();

  console.log("Seeding bootstrap admin account...");
  const admin = await prisma.user.create({
    data: {
      username: SEED_ADMIN_USERNAME,
      name: "Admin",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(SEED_ADMIN_PASSWORD, 10),
    },
  });

  console.log("Seeding business settings...");
  await prisma.businessSettings.create({
    data: {
      id: "default",
      businessName: "SOORYA STATIONERS",
      address: "No. 05, 02nd Rohini Lane, Malwatta Road, Colombo 11.",
      phone: "+94 11 2437926, +94 11 5693018",
      whatsapp: "+94 76 3338906",
      email: "sooryato19@gmail.com",
      taxId: "0000000",
      defaultTax: 10,
      invoiceUnitCode: "SRY",
    },
  });

  console.log("Seeding customers...");
  const customers = await Promise.all(
    CUSTOMERS.map((c) => prisma.customer.create({ data: c }))
  );

  console.log("Seeding product catalog...");
  const products = await Promise.all(
    ITEMS_POOL.map((item, i) =>
      prisma.product.create({
        data: { reference: `P-${String(i + 1).padStart(4, "0")}`, name: item.name, price: item.price },
      })
    )
  );
  const productByName = new Map(products.map((p) => [p.name, p]));

  // Rough month-over-month growth so the revenue trend chart shows a clear curve.
  const monthPlan = [
    { monthOffset: 5, count: 4 }, // Feb
    { monthOffset: 4, count: 6 }, // Mar
    { monthOffset: 3, count: 8 }, // Apr
    { monthOffset: 2, count: 10 }, // May
    { monthOffset: 1, count: 13 }, // Jun
    { monthOffset: 0, count: 15 }, // Jul (partial, up to today)
  ];

  const today = new Date();
  const dates: Date[] = [];

  for (const { monthOffset, count } of monthPlan) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
    const daysInMonth =
      monthOffset === 0
        ? today.getDate()
        : new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();

    for (let i = 0; i < count; i++) {
      const day = randomInt(1, daysInMonth);
      const hour = randomInt(9, 18);
      const minute = randomInt(0, 59);
      dates.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day, hour, minute));
    }
  }

  dates.sort((a, b) => a.getTime() - b.getTime());

  console.log(`Seeding ${dates.length} invoices...`);
  // Gazette 2481/22 format: YYMMM_QQQQ_XXXXX, counter resets each month.
  const MONTH_ABBR = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];
  const monthCounters = new Map<string, number>();

  for (const date of dates) {
    const yearMonthPrefix = `${String(date.getFullYear()).slice(-2)}${MONTH_ABBR[date.getMonth()]}_SRY_`;
    const seq = (monthCounters.get(yearMonthPrefix) ?? 0) + 1;
    monthCounters.set(yearMonthPrefix, seq);
    const invoiceNo = `${yearMonthPrefix}${String(seq).padStart(5, "0")}`;

    const itemCount = randomInt(1, 4);
    const items = Array.from({ length: itemCount }, () => {
      const base = pick(ITEMS_POOL);
      const product = productByName.get(base.name)!;
      const quantity = randomInt(1, 3);
      return {
        reference: product.reference,
        name: base.name,
        price: base.price,
        quantity,
        lineTotal: round2(base.price * quantity),
        productId: product.id,
      };
    });

    const subtotal = round2(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
    const taxEnabled = Math.random() < 0.55;
    const taxPercent = taxEnabled ? 10 : 0;
    const taxAmount = round2(taxEnabled ? subtotal * (taxPercent / 100) : 0);
    const total = round2(subtotal + taxAmount);

    const daysAgo = (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    const paidChance = daysAgo > 14 ? 0.85 : 0.4;
    const status: InvoiceStatus = Math.random() < paidChance ? "PAID" : "UNPAID";

    const hasCustomer = Math.random() < 0.9;
    const customer = hasCustomer ? pick(customers) : null;

    const dateOfDelivery =
      Math.random() < 0.8
        ? new Date(date.getTime() + randomInt(0, 3) * 24 * 60 * 60 * 1000)
        : null;

    await prisma.invoice.create({
      data: {
        invoiceNo,
        date,
        createdAt: date,
        dateOfDelivery,
        placeOfSupply: pick(PLACES_OF_SUPPLY),
        modeOfPayment: pick(PAYMENT_MODES),
        additionalInfo: pick(ADDITIONAL_NOTES) || null,
        status,
        customerId: customer?.id,
        createdByUserId: admin.id,
        taxEnabled,
        taxPercent,
        subtotal,
        taxAmount,
        total,
        items: { create: items },
      },
    });
  }

  console.log(
    `Done. Seeded ${dates.length} invoices across ${customers.length} customers and ${products.length} products.`
  );
  console.log(
    `Bootstrap admin login -> username: "${SEED_ADMIN_USERNAME}"  password: "${SEED_ADMIN_PASSWORD}" (change this after first login).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
