import { tool } from 'ai';
import { z } from 'zod';

export const datetimeTool = tool({
  description: 'Get current date, time, or perform date calculations',
  inputSchema: z.object({
    operation: z.enum(['current', 'add', 'subtract', 'format', 'parse']).describe('Operation to perform'),
    date: z.string().optional().describe('ISO date string for operations'),
    amount: z.number().optional().describe('Amount to add/subtract'),
    unit: z.enum(['years', 'months', 'days', 'hours', 'minutes', 'seconds']).optional().describe('Unit for add/subtract'),
    format: z.string().optional().describe('Format string for formatting operation'),
    timezone: z.string().optional().describe('Timezone (e.g., "America/New_York")'),
  }),
  execute: async ({ operation, date, amount, unit, format, timezone }) => {
    try {
      const now = new Date();
      let targetDate = date ? new Date(date) : now;
      
      switch (operation) {
        case 'current':
          return {
            iso: now.toISOString(),
            unix: now.getTime(),
            formatted: now.toLocaleString(),
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          };
          
        case 'add':
        case 'subtract':
          if (!amount || !unit) {
            throw new Error('Amount and unit required for add/subtract operations');
          }
          
          const multiplier = operation === 'add' ? 1 : -1;
          const ms = amount * multiplier;
          
          switch (unit) {
            case 'seconds':
              targetDate.setSeconds(targetDate.getSeconds() + ms);
              break;
            case 'minutes':
              targetDate.setMinutes(targetDate.getMinutes() + ms);
              break;
            case 'hours':
              targetDate.setHours(targetDate.getHours() + ms);
              break;
            case 'days':
              targetDate.setDate(targetDate.getDate() + ms);
              break;
            case 'months':
              targetDate.setMonth(targetDate.getMonth() + ms);
              break;
            case 'years':
              targetDate.setFullYear(targetDate.getFullYear() + ms);
              break;
          }
          
          return {
            original: date || now.toISOString(),
            result: targetDate.toISOString(),
            operation: `${operation} ${amount} ${unit}`,
            formatted: targetDate.toLocaleString(),
          };
          
        case 'format':
          const options: Intl.DateTimeFormatOptions = {};
          if (timezone) {
            options.timeZone = timezone;
          }
          
          return {
            iso: targetDate.toISOString(),
            formatted: targetDate.toLocaleString(undefined, options),
            date: targetDate.toLocaleDateString(undefined, options),
            time: targetDate.toLocaleTimeString(undefined, options),
            timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          };
          
        case 'parse':
          if (!date) {
            throw new Error('Date string required for parse operation');
          }
          
          return {
            iso: targetDate.toISOString(),
            unix: targetDate.getTime(),
            year: targetDate.getFullYear(),
            month: targetDate.getMonth() + 1,
            day: targetDate.getDate(),
            hour: targetDate.getHours(),
            minute: targetDate.getMinutes(),
            second: targetDate.getSeconds(),
            dayOfWeek: targetDate.getDay(),
            formatted: targetDate.toLocaleString(),
          };
          
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      };
    }
  },
});