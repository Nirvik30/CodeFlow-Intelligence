import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Attach WebSocket support for Neon serverless
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;

// Type augmentation for the global object (TypeScript)
declare global {
  // Use PrismaClient with Neon adapter, so type hasn't changed
  var prisma: PrismaClient | undefined;
}

// Adapter instance for Neon
const adapter = new PrismaNeon({ connectionString });

// Create/reuse Prisma Client singleton
export const prisma = globalThis.prisma ?? new PrismaClient({ adapter });

// Store instance in global in dev
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

// (Optional) Helper functions, as in your sample
export async function disconnectPrisma() {
  await prisma.$disconnect();
}

export async function testDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
    return { success: true, message: 'Database connected successfully' };
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return {
      success: false,
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
