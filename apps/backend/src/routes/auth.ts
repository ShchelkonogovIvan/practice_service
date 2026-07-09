import { Router } from "express";
import { Prisma, UserRole } from "@prisma/client";
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
    const passwordValue = body.password;

    if (!email.includes("@")) {
      throw badRequest("Некорректный email");
    }

    if (typeof passwordValue !== "string" || passwordValue.length < 8) {
      throw badRequest("Пароль слишком короткий");
    }

    const user = await prisma.user
      .create({
        data: {
          email,
          passwordHash: await hashPassword(passwordValue)
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw badRequest("Этот email уже используется");
        }

        throw error;
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
      throw unauthorized("Неверный email или пароль");
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

