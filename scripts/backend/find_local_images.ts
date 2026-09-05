import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany();
  const media = await prisma.productMedia.findMany();
  
  console.log(`Total Products: ${products.length}`);
  console.log(`Total ProductMedia: ${media.length}`);
  
  if (products.length > 0) {
    console.log(`Sample product image URL: ${products[0].imageUrl}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
