import type { NotificationContent } from "./notification-content.js";
import { prisma } from "./prisma.js";

export function createUserNotification(userId: string, content: NotificationContent) {
  return prisma.notification.create({
    data: { userId, ...content }
  });
}

export function createUserNotifications(userIds: string[], content: NotificationContent) {
  const uniqueUserIds = [...new Set(userIds)];
  if (uniqueUserIds.length === 0) return Promise.resolve({ count: 0 });
  return prisma.notification.createMany({
    data: uniqueUserIds.map((userId) => ({ userId, ...content }))
  });
}

export async function createAdminNotifications(content: NotificationContent) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true }
  });
  return createUserNotifications(admins.map((admin) => admin.id), content);
}
