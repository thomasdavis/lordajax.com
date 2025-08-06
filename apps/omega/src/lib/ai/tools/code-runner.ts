import { tool } from 'ai';
import { z } from 'zod';

export const codeRunnerTool = tool({
  description: 'Execute JavaScript code in a sandboxed environment',
  inputSchema: z.object({
    code: z.string().describe('JavaScript code to execute'),
    language: z.enum(['javascript', 'typescript']).default('javascript').describe('Programming language'),
  }),
  execute: async ({ code, language }) => {
    try {
      // Create a sandboxed context with limited globals
      const sandbox = {
        console: {
          log: (...args: any[]) => args.map(a => String(a)).join(' '),
          error: (...args: any[]) => `ERROR: ${args.map(a => String(a)).join(' ')}`,
          warn: (...args: any[]) => `WARN: ${args.map(a => String(a)).join(' ')}`,
        },
        Math,
        Date,
        JSON,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Map,
        Set,
        Promise,
      };
      
      // Capture console output
      const output: string[] = [];
      const customConsole = {
        log: (...args: any[]) => {
          output.push(args.map(a => String(a)).join(' '));
          return undefined;
        },
        error: (...args: any[]) => {
          output.push(`ERROR: ${args.map(a => String(a)).join(' ')}`);
          return undefined;
        },
        warn: (...args: any[]) => {
          output.push(`WARN: ${args.map(a => String(a)).join(' ')}`);
          return undefined;
        },
      };
      
      // Replace console in the sandbox
      const executionSandbox = { ...sandbox, console: customConsole };
      
      // Create function with sandboxed context
      const func = new Function(...Object.keys(executionSandbox), code);
      
      // Execute with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Code execution timeout')), 5000)
      );
      
      const executionPromise = Promise.resolve(
        func(...Object.values(executionSandbox))
      );
      
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      return {
        success: true,
        result: result !== undefined ? String(result) : undefined,
        output: output.length > 0 ? output : undefined,
        language,
        executedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        language,
      };
    }
  },
});