import { tool } from 'ai';
import { z } from 'zod';

export const calculatorTool = tool({
  description: 'Perform mathematical calculations',
  inputSchema: z.object({
    expression: z.string().describe('Mathematical expression to evaluate (e.g., "2 + 2", "sin(45)", "sqrt(16)")'),
  }),
  execute: async ({ expression }) => {
    console.log('[Calculator Tool] Executing:', expression);
    try {
      // Create a safe math context
      const mathContext = {
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        sqrt: Math.sqrt,
        pow: Math.pow,
        abs: Math.abs,
        round: Math.round,
        floor: Math.floor,
        ceil: Math.ceil,
        min: Math.min,
        max: Math.max,
        PI: Math.PI,
        E: Math.E,
      };
      
      // Sanitize the expression
      const sanitized = expression.replace(/[^0-9+\-*/().,\s]/g, (match) => {
        if (match in mathContext) return match;
        throw new Error(`Invalid character: ${match}`);
      });
      
      // Create a function that evaluates the expression
      const evaluate = new Function(...Object.keys(mathContext), `return ${sanitized}`);
      const result = evaluate(...Object.values(mathContext));
      
      return {
        result,
        expression,
        formatted: `${expression} = ${result}`,
      };
    } catch (error) {
      return {
        error: `Failed to calculate: ${error instanceof Error ? error.message : 'Unknown error'}`,
        expression,
      };
    }
  },
});