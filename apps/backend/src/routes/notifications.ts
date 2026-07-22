import { Router } from "express";
import { notFound } from "../http/errors.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: "desc" },
        take: 50
      }),
      prisma.notification.count({
        where: { userId: req.user!.id, readAt: null }
      })
    ]);
    res.json({ notifications, unreadCount });
  })
);

notificationsRouter.patch(
  "/notifications/:notificationId/read",
  asyncHandler(async (req, res) => {
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.notificationId, userId: req.user!.id }
    });
    if (!notification) throw notFound("Уведомление не найдено");
    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: notification.readAt ?? new Date() }
    });
    res.json({ notification: updated });
  })
);

notificationsRouter.post(
  "/notifications/read-all",
  asyncHandler(async (req, res) => {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() }
    });
    res.json({ updated: result.count });
  })
);
