
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { codeReviewWorkflow } from './workflows/code-review-workflow';
import { codeReviewAgent } from './agents/code-review-agent';

export const mastra = new Mastra({
  workflows: {
    codeReviewWorkflow
  },
  agents: {
    codeReviewAgent
  },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
