import { UserRole } from "@prisma/client";
import { hashPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !email.includes("@")) {
    throw new Error("Укажите корректный ADMIN_EMAIL");
  }
  if (!password || password.length < 12) {
    throw new Error("ADMIN_PASSWORD должен содержать не менее 12 символов");
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { email },
    update: { role: UserRole.ADMIN, passwordHash },
    create: { email, passwordHash, role: UserRole.ADMIN }
  });

  console.log(`Учётная запись администратора готова: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
