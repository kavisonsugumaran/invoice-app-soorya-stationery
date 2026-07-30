import { prisma } from "@/lib/prisma";

/** Wipes all tables in dependency order — same order as prisma/seed.ts. */
export async function resetDb() {
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.businessSettings.deleteMany();
  await prisma.user.deleteMany();
}
