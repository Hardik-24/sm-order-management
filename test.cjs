const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function test() {
  const searchTerm = "%royal%";
  const result = await prisma.$queryRaw`
    SELECT o.id, o."orderNumber", c.name, c.company
    FROM "Order" o
    LEFT JOIN "Customer" c ON o."customerId" = c.id
    WHERE o."orderNumber" LIKE ${searchTerm}
       OR c.name LIKE ${searchTerm}
       OR c.company LIKE ${searchTerm}
  `;
  console.log(result);
}
test();
