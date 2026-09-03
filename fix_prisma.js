
const fs = require('fs');
let code = fs.readFileSync('prisma/schema.prisma', 'utf8');
code = code.replace(
  'unitPrice      Decimal @db.Decimal(10, 2)',
  \unitPrice      Decimal @db.Decimal(10, 2)
  discount       Decimal @default(0) @db.Decimal(10, 2)
  taxRate        Decimal @default(0) @db.Decimal(10, 2)
  taxAmount      Decimal @default(0) @db.Decimal(10, 2)
  totalPrice     Decimal @default(0) @db.Decimal(10, 2)\
);
fs.writeFileSync('prisma/schema.prisma', code);

