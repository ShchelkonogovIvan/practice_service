import dotenv from "dotenv";

dotenv.config({ path: new URL("../../../.env", import.meta.url) });

async function main() {
  const [{ UserRole }, { hashPassword }, { prisma }] = await Promise.all([
    import("@prisma/client"),
    import("../src/lib/password.js"),
    import("../src/lib/prisma.js")
  ]);
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "admin12345";

  await prisma.user.upsert({
    where: { email },
    update: { role: UserRole.ADMIN },
    create: {
      email,
      passwordHash: await hashPassword(password),
      role: UserRole.ADMIN
    }
  });

  console.log(`Seeded admin user: ${email}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
