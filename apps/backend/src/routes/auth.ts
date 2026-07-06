import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { badRequest, unauthorized } from "../http/errors.js";
import { signAccessToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { asObject, stringField } from "../utils/body.js";

export const authRouter = Router();

function publicUser(user: { id: string; email: string; role: UserRole; createdAt?: Date }) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = asObject(req.body);
    const email = stringField(body, "email").toLowerCase();
    const password = stringField(body, "password", 8);

    if (!email.includes("@")) {
      throw badRequest("Email is invalid");
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password)
      }
    });

    const token = signAccessToken({ sub: user.id, role: user.role });
    res.status(201).json({ user: publicUser(user), token });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = asObject(req.body);
    const email = stringField(body, "email").toLowerCase();
    const password = stringField(body, "password");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw unauthorized("Invalid email or password");
    }

    const token = signAccessToken({ sub: user.id, role: user.role });
    res.json({ user: publicUser(user), token });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

