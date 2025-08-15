import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import axios from 'axios';

interface GitLabCommit {
  id: string;
  message: string;
  timestamp: string;
  url: string;
  author: {
    name: string;
    email: string;
  };
  added: string[];
  removed: string[];
  modified: string[];
}

interface GitLabPushEvent {
  object_kind: string;
  before: string;
  after: string;
  ref: string;
  user_name: string;
  user_email: string;
  project: {
    id: number;
    name: string;
    web_url: string;
    http_url: string;
  };
  commits: GitLabCommit[];
}

export const gitlabWebhookTool = createTool({
  id: 'gitlab-webhook',
  description: 'Process GitLab webhook push events and extract commit information',
  inputSchema: z.object({
    headers: z.object({
      'x-gitlab-token': z.string().optional(),
      'x-gitlab-event': z.string().optional(),
    }),
    body: z.object({
      object_kind: z.string(),
      before: z.string(),
      after: z.string(),
      ref: z.string(),
      user_name: z.string(),
      user_email: z.string(),
      project: z.object({
        id: z.number(),
        name: z.string(),
        web_url: z.string(),
        http_url: z.string(),
      }),
      commits: z.array(z.object({
        id: z.string(),
        message: z.string(),
        timestamp: z.string(),
        url: z.string(),
        author: z.object({
          name: z.string(),
          email: z.string(),
        }),
        added: z.array(z.string()),
        removed: z.array(z.string()),
        modified: z.array(z.string()),
      })),
    }),
    secretToken: z.string().optional(),
  }),
  outputSchema: z.object({
    isValidPush: z.boolean(),
    projectName: z.string(),
    projectUrl: z.string(),
    commits: z.array(z.object({
      id: z.string(),
      shortId: z.string(),
      message: z.string(),
      author: z.string(),
      timestamp: z.string(),
      url: z.string(),
      filesChanged: z.array(z.string()),
    })),
    branch: z.string(),
  }),
  execute: async ({ context }) => {
    const { headers, body, secretToken } = context;
    
    // Verify webhook token if provided
    if (secretToken && headers['x-gitlab-token']) {
      if (headers['x-gitlab-token'] !== secretToken) {
        throw new Error('Invalid webhook token');
      }
    }
    
    // Check if it's a push event
    if (body.object_kind !== 'push') {
      return {
        isValidPush: false,
        projectName: body.project.name,
        projectUrl: body.project.web_url,
        commits: [],
        branch: '',
      };
    }
    
    // Skip if it's a tag push or delete
    if (body.ref.startsWith('refs/tags/') || body.after === '0000000000000000000000000000000000000000') {
      return {
        isValidPush: false,
        projectName: body.project.name,
        projectUrl: body.project.web_url,
        commits: [],
        branch: '',
      };
    }
    
    const branch = body.ref.replace('refs/heads/', '');
    
    const processedCommits = body.commits.map(commit => ({
      id: commit.id,
      shortId: commit.id.substring(0, 8),
      message: commit.message,
      author: commit.author.name,
      timestamp: commit.timestamp,
      url: commit.url,
      filesChanged: [...commit.added, ...commit.modified, ...commit.removed],
    }));
    
    return {
      isValidPush: true,
      projectName: body.project.name,
      projectUrl: body.project.web_url,
      commits: processedCommits,
      branch,
    };
  },
});

export const gitlabApiTool = createTool({
  id: 'gitlab-api',
  description: 'Fetch commit diff and file content from GitLab API',
  inputSchema: z.object({
    gitlabUrl: z.string(),
    accessToken: z.string(),
    projectId: z.number(),
    commitSha: z.string(),
  }),
  outputSchema: z.object({
    diff: z.string(),
    files: z.array(z.object({
      filePath: z.string(),
      content: z.string().optional(),
      diff: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    const { gitlabUrl, accessToken, projectId, commitSha } = context;
    
    const baseUrl = gitlabUrl.replace(/\/$/, '');
    
    try {
      // Fetch commit diff
      const diffResponse = await axios.get(
        `${baseUrl}/api/v4/projects/${projectId}/repository/commits/${commitSha}/diff`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      const diffData = diffResponse.data;
      let fullDiff = '';
      const files = [];
      
      for (const fileDiff of diffData) {
        fullDiff += `\n--- ${fileDiff.old_path}\n+++ ${fileDiff.new_path}\n${fileDiff.diff}`;
        
        // Try to fetch file content for better context (only for text files)
        let fileContent;
        if (!fileDiff.deleted_file && fileDiff.new_path.match(/\.(js|ts|tsx|jsx|py|java|cpp|c|h|css|html|md|json|yaml|yml|xml)$/i)) {
          try {
            const fileResponse = await axios.get(
              `${baseUrl}/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(fileDiff.new_path)}/raw`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
                params: {
                  ref: commitSha,
                },
              }
            );
            fileContent = fileResponse.data;
          } catch (error) {
            // File might not exist or be too large, skip content
            fileContent = undefined;
          }
        }
        
        files.push({
          filePath: fileDiff.new_path || fileDiff.old_path,
          content: fileContent,
          diff: fileDiff.diff,
        });
      }
      
      return {
        diff: fullDiff,
        files,
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch commit data: ${error.message}`);
    }
  },
});