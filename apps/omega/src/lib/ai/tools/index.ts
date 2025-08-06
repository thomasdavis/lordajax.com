export { calculatorTool } from './calculator';
export { weatherTool } from './weather';
export { codeRunnerTool } from './code-runner';
export { datetimeTool } from './datetime';
export { knowledgeBaseTool } from './knowledge-base';

import { calculatorTool } from './calculator';
import { weatherTool } from './weather';
import { codeRunnerTool } from './code-runner';
import { datetimeTool } from './datetime';
import { knowledgeBaseTool } from './knowledge-base';

export const allTools = {
  calculator: calculatorTool,
  weather: weatherTool,
  codeRunner: codeRunnerTool,
  datetime: datetimeTool,
  knowledgeBase: knowledgeBaseTool,
};

export type ToolName = keyof typeof allTools;