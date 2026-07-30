import { prisma } from "@/lib/prisma";

export function getBusinessSettings() {
  return prisma.businessSettings.findUnique({ where: { id: "default" } });
}
