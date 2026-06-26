import { PrismaClient , Prisma} from '../generated/client';
import { PrismaPg } from "@prisma/adapter-pg";


const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });


const prismaOptions: Prisma.PrismaClientOptions = {
  adapter: adapter, 
};

const prisma = new PrismaClient(prismaOptions);

export {prisma}