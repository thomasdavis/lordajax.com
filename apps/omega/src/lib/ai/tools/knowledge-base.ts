import { tool } from 'ai';
import { z } from 'zod';

// In-memory knowledge base (in production, this would use a vector database)
const knowledgeBase = new Map<string, any>();

export const knowledgeBaseTool = tool({
  description: 'Store and retrieve information from a knowledge base',
  inputSchema: z.object({
    operation: z.enum(['store', 'retrieve', 'search', 'delete', 'list']).describe('Operation to perform'),
    key: z.string().optional().describe('Key for the information'),
    value: z.any().optional().describe('Value to store'),
    query: z.string().optional().describe('Search query for finding information'),
    category: z.string().optional().describe('Category for organizing information'),
  }),
  execute: async ({ operation, key, value, query, category }) => {
    try {
      switch (operation) {
        case 'store':
          if (!key || value === undefined) {
            throw new Error('Key and value required for store operation');
          }
          
          const entry = {
            key,
            value,
            category,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          knowledgeBase.set(key, entry);
          
          return {
            success: true,
            operation: 'store',
            key,
            message: `Stored information under key: ${key}`,
            entry,
          };
          
        case 'retrieve':
          if (!key) {
            throw new Error('Key required for retrieve operation');
          }
          
          const retrieved = knowledgeBase.get(key);
          
          if (!retrieved) {
            return {
              success: false,
              operation: 'retrieve',
              key,
              message: `No information found for key: ${key}`,
            };
          }
          
          return {
            success: true,
            operation: 'retrieve',
            key,
            data: retrieved,
          };
          
        case 'search':
          if (!query) {
            throw new Error('Query required for search operation');
          }
          
          const results: any[] = [];
          const lowerQuery = query.toLowerCase();
          
          for (const [k, v] of knowledgeBase.entries()) {
            if (
              k.toLowerCase().includes(lowerQuery) ||
              JSON.stringify(v.value).toLowerCase().includes(lowerQuery) ||
              (v.category && v.category.toLowerCase().includes(lowerQuery))
            ) {
              results.push({ key: k, ...v });
            }
          }
          
          return {
            success: true,
            operation: 'search',
            query,
            count: results.length,
            results,
          };
          
        case 'delete':
          if (!key) {
            throw new Error('Key required for delete operation');
          }
          
          const existed = knowledgeBase.has(key);
          knowledgeBase.delete(key);
          
          return {
            success: existed,
            operation: 'delete',
            key,
            message: existed 
              ? `Deleted information for key: ${key}`
              : `No information found for key: ${key}`,
          };
          
        case 'list':
          const entries: any[] = [];
          
          for (const [k, v] of knowledgeBase.entries()) {
            if (!category || v.category === category) {
              entries.push({ key: k, ...v });
            }
          }
          
          return {
            success: true,
            operation: 'list',
            category,
            count: entries.length,
            entries: entries.map(e => ({
              key: e.key,
              category: e.category,
              createdAt: e.createdAt,
              preview: typeof e.value === 'string' 
                ? e.value.substring(0, 100) 
                : JSON.stringify(e.value).substring(0, 100),
            })),
          };
          
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      };
    }
  },
});