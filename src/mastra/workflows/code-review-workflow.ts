/**
 * GitLab 代码审查工作流
 * 
 * 这个工作流定义了从接收GitLab webhook到发送钉钉通知的完整流程：
 * 1. 处理GitLab webhook事件，提取提交信息
 * 2. 从GitLab API获取代码差异
 * 3. 使用AI进行代码审查分析
 * 4. 将审查结果发送到钉钉
 * 
 * 注意：由于Mastra workflow在某些环境下存在兼容性问题，
 * 目前推荐使用 simple-server.ts 中的直接工具调用方式
 */

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

/**
 * 第一步：处理GitLab Webhook
 * 
 * 功能：
 * - 验证webhook的安全性（secret token验证）
 * - 解析GitLab推送事件数据
 * - 提取项目信息和提交列表
 * - 过滤无效的推送事件（如删除操作、标签推送等）
 */
const webhookStep = createStep({
  id: 'process-webhook',
  description: 'Process GitLab webhook and extract commit information',
  
  // 输入数据结构：包含HTTP headers、body和可选的密钥
  inputSchema: z.object({
    headers: z.object({
      'x-gitlab-token': z.string().optional(), // GitLab发送的验证token
      'x-gitlab-event': z.string().optional(),  // 事件类型（Push Hook等）
    }),
    body: z.any(), // GitLab webhook的完整payload
    secretToken: z.string().optional(), // 用于验证的密钥
  }),
  
  // 输出数据结构：处理后的提交信息
  outputSchema: z.object({
    isValidPush: z.boolean(),      // 是否为有效的推送事件
    projectName: z.string(),       // 项目名称
    projectUrl: z.string(),        // 项目URL
    commits: z.array(z.object({    // 提交列表
      id: z.string(),              // 完整的commit SHA
      shortId: z.string(),         // 短commit SHA（前8位）
      message: z.string(),         // 提交信息
      author: z.string(),          // 提交者
      timestamp: z.string(),       // 提交时间
      url: z.string(),            // 提交的GitLab URL
      filesChanged: z.array(z.string()), // 变更的文件列表
    })),
    branch: z.string(),           // 分支名
  }),
  
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('输入数据不存在');
    }

    // 直接导入并使用GitLab webhook处理工具
    // 这个工具会验证token、解析webhook数据、提取提交信息
    const { gitlabWebhookTool } = await import('../tools/gitlab-webhook-tool');
    const result = await gitlabWebhookTool.execute({ context: inputData });
    return result;
  },
});

/**
 * 第二步：获取代码差异
 * 
 * 功能：
 * - 调用GitLab API获取每个提交的详细代码差异
 * - 获取文件内容（用于提供更好的上下文给AI）
 * - 处理多个提交（如果一次推送包含多个commit）
 * - 错误容错：某个提交失败不会影响其他提交的处理
 */
const fetchDiffStep = createStep({
  id: 'fetch-diff',
  description: 'Fetch commit diff from GitLab API',
  
  // 输入：上一步的输出 + GitLab API配置信息
  inputSchema: z.object({
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
    // GitLab API访问配置
    gitlabUrl: z.string(),        // GitLab实例URL
    accessToken: z.string(),      // 访问token
    projectId: z.number(),        // 项目ID
  }),
  
  // 输出：原有信息 + 每个提交的详细差异数据
  outputSchema: z.object({
    isValidPush: z.boolean(),
    projectName: z.string(),
    commits: z.array(z.any()),
    branch: z.string(),
    diffData: z.array(z.object({  // 新增：差异数据数组
      commitId: z.string(),       // 提交ID
      diff: z.string(),          // 完整的diff文本
      files: z.array(z.object({  // 文件级别的差异
        filePath: z.string(),     // 文件路径
        content: z.string().optional(), // 文件内容（可选）
        diff: z.string(),         // 该文件的diff
      })),
    })),
  }),
  
  execute: async ({ inputData, mastra }) => {
    // 如果不是有效推送，直接返回空结果
    if (!inputData || !inputData.isValidPush) {
      return {
        isValidPush: false,
        projectName: inputData?.projectName || '',
        commits: [],
        branch: '',
        diffData: [],
      };
    }

    // 导入GitLab API工具
    const { gitlabApiTool } = await import('../tools/gitlab-webhook-tool');

    const diffData = [];
    
    // 遍历每个提交，获取其代码差异
    for (const commit of inputData.commits) {
      try {
        // 调用GitLab API获取该提交的diff
        const diffResult = await gitlabApiTool.execute({
          context: {
            gitlabUrl: inputData.gitlabUrl,
            accessToken: inputData.accessToken,
            projectId: inputData.projectId,
            commitSha: commit.id,
          },
        });
        
        // 收集差异数据
        diffData.push({
          commitId: commit.id,
          diff: diffResult.diff,      // 完整的diff文本
          files: diffResult.files,    // 文件级别的详细信息
        });
      } catch (error) {
        console.error(`获取提交 ${commit.id} 的差异失败:`, error);
        // 错误容错：继续处理其他提交，不中断整个流程
        // 这样即使某个提交的API调用失败，其他提交仍然可以被处理
      }
    }

    return {
      isValidPush: inputData.isValidPush,
      projectName: inputData.projectName,
      commits: inputData.commits,
      branch: inputData.branch,
      diffData, // 返回收集到的所有差异数据
    };
  },
});

/**
 * 第三步：AI代码审查
 * 
 * 功能：
 * - 使用AI（基于规则 + 未来可扩展LLM）分析代码质量
 * - 从多个维度评估：安全性、性能、可维护性、代码风格等
 * - 为每个提交生成详细的审查报告
 * - 提供具体的问题指出和改进建议
 */
const reviewCodeStep = createStep({
  id: 'review-code',
  description: 'Analyze code changes using AI',
  
  // 输入：前面步骤的输出，包含差异数据
  inputSchema: z.object({
    isValidPush: z.boolean(),
    projectName: z.string(),
    commits: z.array(z.any()),
    branch: z.string(),
    diffData: z.array(z.object({
      commitId: z.string(),
      diff: z.string(),
      files: z.array(z.object({
        filePath: z.string(),
        content: z.string().optional(),
        diff: z.string(),
      })),
    })),
  }),
  
  // 输出：添加每个提交的审查结果
  outputSchema: z.object({
    isValidPush: z.boolean(),
    projectName: z.string(),
    commits: z.array(z.any()),
    branch: z.string(),
    reviews: z.array(z.object({      // 新增：审查结果数组
      commitId: z.string(),          // 对应的提交ID
      overallScore: z.number(),      // 总体评分（0-10）
      summary: z.string(),           // 审查摘要
      issues: z.array(z.any()),      // 发现的问题列表
      positives: z.array(z.string()), // 积极方面
      recommendations: z.array(z.string()), // 改进建议
    })),
  }),
  
  execute: async ({ inputData, mastra }) => {
    // 验证输入数据的有效性
    if (!inputData || !inputData.isValidPush || inputData.diffData.length === 0) {
      return {
        isValidPush: false,
        projectName: inputData?.projectName || '',
        commits: [],
        branch: '',
        reviews: [],
      };
    }

    // 导入代码审查工具
    const { codeReviewTool } = await import('../tools/code-review-tool');

    const reviews = [];
    
    // 为每个有差异数据的提交进行代码审查
    for (const diffItem of inputData.diffData) {
      // 找到对应的提交信息
      const commit = inputData.commits.find(c => c.id === diffItem.commitId);
      if (!commit) continue;

      try {
        // 调用AI代码审查工具
        const reviewResult = await codeReviewTool.execute({
          context: {
            commitMessage: commit.message,    // 提交信息
            authorName: commit.author,        // 提交者
            files: diffItem.files,           // 文件差异数据
            projectName: inputData.projectName, // 项目名
            commitUrl: commit.url,           // 提交URL
          },
        });

        // 收集审查结果
        reviews.push({
          commitId: commit.id,
          ...reviewResult, // 包含：overallScore, summary, issues, positives, recommendations
        });
      } catch (error) {
        console.error(`审查提交 ${commit.id} 失败:`, error);
        
        // 错误容错：为失败的审查创建一个默认结果
        // 这确保即使AI审查失败，用户也能知道发生了什么
        reviews.push({
          commitId: commit.id,
          overallScore: 5, // 中性评分
          summary: `审查过程中出现错误: ${error.message}`,
          issues: [],
          positives: [],
          recommendations: ['请手动检查此提交'],
        });
      }
    }

    return {
      isValidPush: inputData.isValidPush,
      projectName: inputData.projectName,
      commits: inputData.commits,
      branch: inputData.branch,
      reviews, // 返回所有审查结果
    };
  },
});

/**
 * 第四步：发送钉钉通知
 * 
 * 功能：
 * - 将每个提交的审查结果格式化为美观的Markdown消息
 * - 通过钉钉机器人发送到指定群聊
 * - 支持加签验证确保消息安全性
 * - 批量处理多个提交的通知
 */
const notifyStep = createStep({
  id: 'notify-dingtalk',
  description: 'Send review results to DingTalk',
  
  // 输入：前面步骤的所有输出 + 钉钉配置
  inputSchema: z.object({
    isValidPush: z.boolean(),
    projectName: z.string(),
    commits: z.array(z.any()),
    branch: z.string(),
    reviews: z.array(z.any()),        // AI审查结果
    // 钉钉配置
    dingtalkWebhook: z.string(),      // 钉钉机器人webhook URL
    dingtalkSecret: z.string().optional(), // 加签密钥（可选）
  }),
  
  // 输出：通知发送的结果统计
  outputSchema: z.object({
    success: z.boolean(),             // 是否有成功的通知
    message: z.string(),              // 结果描述
    reviewCount: z.number(),          // 成功发送的通知数量
  }),
  
  execute: async ({ inputData, mastra }) => {
    // 验证是否有有效的审查结果需要通知
    if (!inputData || !inputData.isValidPush || inputData.reviews.length === 0) {
      return {
        success: false,
        message: '没有有效的审查结果需要通知',
        reviewCount: 0,
      };
    }

    // 导入钉钉通知工具
    const { dingtalkTool } = await import('../tools/dingtalk-tool');

    let successCount = 0;  // 成功发送的计数
    const errors = [];     // 错误信息收集

    // 为每个审查结果发送钉钉通知
    for (const review of inputData.reviews) {
      // 找到对应的提交信息
      const commit = inputData.commits.find(c => c.id === review.commitId);
      if (!commit) continue;

      try {
        // 调用钉钉通知工具发送消息
        const result = await dingtalkTool.execute({
          context: {
            webhookUrl: inputData.dingtalkWebhook,
            secret: inputData.dingtalkSecret,
            projectName: inputData.projectName,
            // 提交基本信息
            commitInfo: {
              id: commit.id,
              shortId: commit.shortId,
              message: commit.message,
              author: commit.author,
              url: commit.url,
              branch: inputData.branch,
            },
            // AI审查结果
            reviewResult: {
              overallScore: review.overallScore,    // 总分
              summary: review.summary,              // 摘要
              issues: review.issues,                // 问题列表
              positives: review.positives,          // 积极方面
              recommendations: review.recommendations, // 建议
            },
          },
        });

        // 统计发送结果
        if (result.success) {
          successCount++;
        } else {
          errors.push(`提交 ${commit.shortId}: ${result.message}`);
        }
      } catch (error) {
        // 收集发送失败的错误信息
        errors.push(`提交 ${commit.shortId}: ${error.message}`);
      }
    }

    // 返回整体发送结果
    return {
      success: successCount > 0,
      message: successCount === inputData.reviews.length 
        ? `成功发送 ${successCount} 个代码审查通知`
        : `发送了 ${successCount}/${inputData.reviews.length} 个通知。错误: ${errors.join('; ')}`,
      reviewCount: successCount,
    };
  },
});

/**
 * 主工作流：GitLab代码审查工作流
 * 
 * 这是整个代码审查流程的主工作流，将上述四个步骤串联起来：
 * webhook处理 → 获取差异 → AI审查 → 钉钉通知
 * 
 * 输入参数说明：
 * - headers/body: 来自GitLab的webhook请求
 * - secretToken: webhook验证密钥
 * - gitlabUrl/accessToken/projectId: GitLab API访问配置
 * - dingtalkWebhook/dingtalkSecret: 钉钉通知配置
 * 
 * 工作流程：
 * 1. 接收并验证GitLab webhook请求
 * 2. 调用GitLab API获取详细的代码差异
 * 3. 使用AI工具分析代码质量
 * 4. 将审查结果发送到钉钉群聊
 * 
 * 注意：由于Mastra在某些环境下的兼容性问题（如addEventListener错误），
 * 目前推荐使用simple-server.ts中的直接工具调用方式来替代这个工作流。
 */
export const codeReviewWorkflow = createWorkflow({
  id: 'code-review-workflow',
  
  // 工作流的完整输入参数
  inputSchema: z.object({
    // HTTP请求相关
    headers: z.object({
      'x-gitlab-token': z.string().optional(),
      'x-gitlab-event': z.string().optional(),
    }),
    body: z.any(),                    // GitLab webhook payload
    secretToken: z.string().optional(), // webhook验证密钥
    
    // GitLab API配置
    gitlabUrl: z.string(),            // GitLab实例URL
    accessToken: z.string(),          // GitLab访问token
    projectId: z.number(),            // 项目ID
    
    // 钉钉配置
    dingtalkWebhook: z.string(),      // 钉钉webhook URL
    dingtalkSecret: z.string().optional(), // 钉钉加签密钥
  }),
  
  // 工作流的最终输出
  outputSchema: z.object({
    success: z.boolean(),             // 整体是否成功
    message: z.string(),              // 结果描述
    reviewCount: z.number(),          // 成功处理的审查数量
  }),
})
  // 按顺序执行四个步骤
  .then(webhookStep)      // 1. 处理webhook
  .then(fetchDiffStep)    // 2. 获取代码差异
  .then(reviewCodeStep)   // 3. AI代码审查
  .then(notifyStep);      // 4. 发送钉钉通知

// 提交工作流定义，使其生效
codeReviewWorkflow.commit();