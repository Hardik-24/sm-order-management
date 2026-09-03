const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.systemSetting.updateMany({ data: { value: 'false' } }).then(() => console.log('Reset DB flags to false')).catch(console.error).finally(() => prisma.$disconnect());
