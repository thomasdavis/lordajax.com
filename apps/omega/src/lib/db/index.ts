import { PrismaAdapter } from './prisma-adapter';
import type { DatabaseAdapter } from './types';

export * from './types';
export { prisma } from '@/lib/prisma';

// Factory function to get the appropriate adapter
export function getDatabaseAdapter(): DatabaseAdapter {
  // You can switch adapters based on environment variables
  const adapterType = process.env.DB_ADAPTER || 'prisma';
  
  switch (adapterType) {
    case 'prisma':
      return new PrismaAdapter();
    // Add more adapters here as needed
    // case 'mongodb':
    //   return new MongoAdapter();
    // case 'postgres':
    //   return new PostgresAdapter();
    default:
      return new PrismaAdapter();
  }
}

// Export singleton instance
export const db = getDatabaseAdapter();