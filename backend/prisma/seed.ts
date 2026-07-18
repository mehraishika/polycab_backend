import { PrismaPg } from '@prisma/adapter-pg';
import { loadEnvConfig } from '@next/env';
import bcrypt from 'bcryptjs';

import { PrismaClient } from '../src/server/db/generated/prisma/client';

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const account = 'superadmin';

  const existing = await prisma.user.findUnique({
    where: { account },
  });

  if (existing) {
    console.log('Super admin already exists');
    return;
  }

  const passwordHash = await bcrypt.hash('Admin@12345', 12);

  await prisma.user.create({
    data: {
      account,
      email: 'admin@example.com',
      passwordHash,
      portal: 'service',
      role: 'service_super_admin',
      status: 'active',
      timezone: 'Asia/Kolkata',
    },
  });

  console.log('Super admin created');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });