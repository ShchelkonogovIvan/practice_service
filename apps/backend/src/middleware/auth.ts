import { UserRole } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { unauthorized, forbidden } from "../http/errors.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

    if (!token) {
      throw unauthorized();
    }

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true }
    });

    if (!user) {
      throw unauthorized();
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(unauthorized());
  }

  if (req.user.role !== UserRole.ADMIN) {
    return next(forbidden("Admin access required"));
  }

  return next();
}

