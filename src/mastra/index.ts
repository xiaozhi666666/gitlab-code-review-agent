
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { codeReviewWorkflow } from './workflows/code-review-workflow';
import { codeReviewAgent } from './agents/code-review-agent';

export const mastra = new Mastra({
  workflows: { 
    codeReviewWorkflow
  },
  agents: { 
    codeReviewAgent
  },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
