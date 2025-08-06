export { calculatorTool } from './calculator';
export { weatherTool } from './weather';
export { codeRunnerTool } from './code-runner';
export { datetimeTool } from './datetime';
export { knowledgeBaseTool } from './knowledge-base';
export { chartGeneratorTool } from './chart-generator';

import { calculatorTool } from './calculator';
import { weatherTool } from './weather';
import { codeRunnerTool } from './code-runner';
import { datetimeTool } from './datetime';
import { knowledgeBaseTool } from './knowledge-base';
import { chartGeneratorTool } from './chart-generator';

export const allTools = {
  calculator: calculatorTool,
  weather: weatherTool,
  codeRunner: codeRunnerTool,
  datetime: datetimeTool,
  knowledgeBase: knowledgeBaseTool,
  chartGenerator: chartGeneratorTool,
};

export type ToolName = keyof typeof allTools;