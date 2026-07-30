import { prisma } from "@/lib/prisma";

export function getAllUsers() {
  return prisma.user.findMany({
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export function findUserByUsername(username: string, excludeId?: string) {
  return prisma.user.findFirst({
    where: { username, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
}
