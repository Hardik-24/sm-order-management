const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
  .then(console.log)
  .finally(() => prisma.$disconnect());
