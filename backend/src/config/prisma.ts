import { PrismaClient , Prisma} from '../../prisma/generated/client';
import { PrismaPg } from "@prisma/adapter-pg";

// // Standard singleton pattern for Prisma in a long-running Node process:
// // avoids exhausting the Postgres connection pool from repeated client
// // instantiation (e.g. under ts-node-dev hot reload).
// declare global {
//   // eslint-disable-next-line no-var
//   var __prisma: PrismaClient | undefined;
// }

// export const prisma =
//   global.__prisma ??
//   new PrismaClient({
//     log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
//   });

// if (process.env.NODE_ENV !== 'production') {
//   global.__prisma = prisma;
// }

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });


const prismaOptions: Prisma.PrismaClientOptions = {
  adapter: adapter, 
};

const prisma = new PrismaClient(prismaOptions);

export {prisma}