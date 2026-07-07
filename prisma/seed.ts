import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

// Creates the initial ADMIN account from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD,
// but only if no admin exists yet. The seeded admin does not need to change its
// password on first login (mustChangePassword = false).
async function main() {
  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (existingAdmin) {
    console.log(`Admin already exists (${existingAdmin.email}); skipping seed.`);
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set to seed the admin account."
    );
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  // Upsert by email in case a non-admin user already owns this address.
  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", passwordHash, mustChangePassword: false },
    create: {
      email,
      name: "Admin",
      role: "ADMIN",
      passwordHash,
      mustChangePassword: false,
    },
  });

  console.log(`Seeded admin: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
