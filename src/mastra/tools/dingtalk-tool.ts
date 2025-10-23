import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import axios from 'axios';
import crypto from 'crypto';

interface CodeReviewResult {
  overallScore: number;
  summary: string;
  issues: Array<{
    severity: string;
    type: string;
    file: string;
    line?: number;
    message: string;
    suggestion?: string;
  }>;
  positives: string[];
  recommendations: string[];
}

export const dingtalkTool = createTool({
  id: 'dingtalk-notify',
  description: 'Send code review notifications to DingTalk',
  inputSchema: z.object({
    webhookUrl: z.string(),
    secret: z.string().optional(),
    projectName: z.string(),
    commitInfo: z.object({
      id: z.string(),
      shortId: z.string(),
      message: z.string(),
      author: z.string(),
      url: z.string(),
      branch: z.string(),
    }),
    reviewResult: z.object({
      overallScore: z.number(),
      summary: z.string(),
      issues: z.array(z.object({
        severity: z.string(),
        type: z.string(),
        file: z.string(),
        line: z.number().optional(),
        message: z.string(),
        suggestion: z.string().optional(),
      })),
      positives: z.array(z.string()),
      recommendations: z.array(z.string()),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { webhookUrl, secret, projectName, commitInfo, reviewResult } = context;
    
    try {
      // Generate signature if secret is provided
      let timestamp: string | undefined;
      let sign: string | undefined;
      
      if (secret) {
        timestamp = Date.now().toString();
        const stringToSign = `${timestamp}\n${secret}`;
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(stringToSign);
        sign = hmac.digest('base64');
      }
      
      // Format severity emoji
      const getSeverityEmoji = (severity: string) => {
        switch (severity) {
          case 'critical': return '🚨';
          case 'high': return '⚠️';
          case 'medium': return '⚡';
          case 'low': return '💡';
          default: return '📝';
        }
      };
      
      // Format score emoji
      const getScoreEmoji = (score: number) => {
        if (score >= 9) return '🏆';
        if (score >= 7) return '✅';
        if (score >= 5) return '🔶';
        return '🔴';
      };
      
      // Create markdown message
      const markdownText = `
# 🔍 代码审查报告

## 📋 基本信息
- **项目**: ${projectName}
- **分支**: ${commitInfo.branch}
- **提交者**: ${commitInfo.author}
- **提交ID**: [${commitInfo.shortId}](${commitInfo.url})
- **提交信息**: ${commitInfo.message}

## 📊 审查结果
${getScoreEmoji(reviewResult.overallScore)} **总体评分**: ${reviewResult.overallScore}/10

**摘要**: ${reviewResult.summary}

${reviewResult.issues.length > 0 ? `
## ⚠️ 发现的问题 (${reviewResult.issues.length}个)

${reviewResult.issues.map(issue => `
### ${getSeverityEmoji(issue.severity)} ${issue.severity.toUpperCase()} - ${issue.type}
- **文件**: ${issue.file}${issue.line ? ` (第${issue.line}行)` : ''}
- **问题**: ${issue.message}
${issue.suggestion ? `- **建议**: ${issue.suggestion}` : ''}
`).join('\n')}
` : ''}

${reviewResult.positives.length > 0 ? `
## 👍 积极方面
${reviewResult.positives.map(positive => `- ✅ ${positive}`).join('\n')}
` : ''}

${reviewResult.recommendations.length > 0 ? `
## 💡 改进建议
${reviewResult.recommendations.map(rec => `- 🔧 ${rec}`).join('\n')}
` : ''}

---
*由 Mastra 代码审查系统自动生成 • ${new Date().toLocaleString('zh-CN')}*
      `.trim();
      
      // Prepare request payload
      const payload: any = {
        msgtype: 'markdown',
        markdown: {
          title: `${projectName} 代码审查`,
          text: markdownText,
        },
      };
      
      // Prepare request URL with signature if needed
      let requestUrl = webhookUrl;
      if (secret && timestamp && sign) {
        requestUrl += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
      }
      
      // Send message to DingTalk
      const response = await axios.post(requestUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.data.errcode === 0) {
        return {
          success: true,
          message: '钉钉消息发送成功',
        };
      } else {
        throw new Error(`钉钉API错误: ${response.data.errmsg}`);
      }
    } catch (error: any) {
      return {
        success: false,
        message: `发送钉钉消息失败: ${error.message}`,
      };
    }
  },
});

export const dingtalkBatchTool = createTool({
  id: 'dingtalk-batch',
  description: 'Send batch code review notifications for multiple commits to DingTalk',
  inputSchema: z.object({
    webhookUrl: z.string(),
    secret: z.string().optional(),
    projectName: z.string(),
    pushInfo: z.object({
      branch: z.string(),
      totalCommits: z.number(),
      author: z.string(), // 主要提交者
    }),
    commitsReviews: z.array(z.object({
      commitInfo: z.object({
        id: z.string(),
        shortId: z.string(),
        message: z.string(),
        author: z.string(),
        url: z.string(),
      }),
      reviewResult: z.object({
        overallScore: z.number(),
        summary: z.string(),
        issues: z.array(z.object({
          severity: z.string(),
          type: z.string(),
          file: z.string(),
          line: z.number().optional(),
          message: z.string(),
          suggestion: z.string().optional(),
        })),
        positives: z.array(z.string()),
        recommendations: z.array(z.string()),
      }),
    })),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { webhookUrl, secret, projectName, pushInfo, commitsReviews } = context;
    
    try {
      // Generate signature if secret is provided
      let timestamp: string | undefined;
      let sign: string | undefined;
      
      if (secret) {
        timestamp = Date.now().toString();
        const stringToSign = `${timestamp}\n${secret}`;
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(stringToSign);
        sign = hmac.digest('base64');
      }
      
      // Calculate overall statistics
      const totalIssues = commitsReviews.reduce((sum, review) => sum + review.reviewResult.issues.length, 0);
      const averageScore = commitsReviews.reduce((sum, review) => sum + review.reviewResult.overallScore, 0) / commitsReviews.length;
      
      // Group issues by severity
      const issuesBySeverity = commitsReviews.reduce((acc, review) => {
        review.reviewResult.issues.forEach(issue => {
          if (!acc[issue.severity]) acc[issue.severity] = [];
          acc[issue.severity].push({
            ...issue,
            commit: review.commitInfo.shortId
          });
        });
        return acc;
      }, {} as Record<string, Array<any>>);
      
      // Format severity emoji
      const getSeverityEmoji = (severity: string) => {
        switch (severity) {
          case 'critical': return '🚨';
          case 'high': return '⚠️';
          case 'medium': return '⚡';
          case 'low': return '💡';
          default: return '📝';
        }
      };
      
      // Format score emoji
      const getScoreEmoji = (score: number) => {
        if (score >= 9) return '🏆';
        if (score >= 7) return '✅';
        if (score >= 5) return '🔶';
        return '🔴';
      };
      
      // Create markdown message
      const markdownText = `
# 📦 代码推送审查报告

## 📋 基本信息
- **项目**: ${projectName}
- **分支**: ${pushInfo.branch}
- **提交数量**: ${pushInfo.totalCommits} 个
- **主要提交者**: ${pushInfo.author}

## 📊 整体审查结果
${getScoreEmoji(averageScore)} **平均评分**: ${averageScore.toFixed(1)}/10
🔍 **总问题数**: ${totalIssues} 个

## 📝 提交详情
${commitsReviews.map((review, index) => `
### ${index + 1}. [${review.commitInfo.shortId}](${review.commitInfo.url}) ${getScoreEmoji(review.reviewResult.overallScore)} ${review.reviewResult.overallScore}/10
**作者**: ${review.commitInfo.author}
**信息**: ${review.commitInfo.message.split('\n')[0]}
**问题**: ${review.reviewResult.issues.length} 个
`).join('')}

${totalIssues > 0 ? `
## ⚠️ 发现的问题汇总 (${totalIssues}个)

${Object.entries(issuesBySeverity).map(([severity, issues]) => `
### ${getSeverityEmoji(severity)} ${severity.toUpperCase()} (${issues.length}个)
${issues.map(issue => `
- **文件**: ${issue.file}${issue.line ? ` (第${issue.line}行)` : ''} - **提交**: ${issue.commit}
- **问题**: ${issue.message}
${issue.suggestion ? `- **建议**: ${issue.suggestion}` : ''}
`).join('')}
`).join('')}
` : ''}

## 💡 改进建议
${Array.from(new Set(commitsReviews.flatMap(review => review.reviewResult.recommendations))).map(rec => `- 🔧 ${rec}`).join('\n')}

---
*由 Mastra 代码审查系统自动生成 • ${new Date().toLocaleString('zh-CN')}*
      `.trim();
      
      // Prepare request payload
      const payload: any = {
        msgtype: 'markdown',
        markdown: {
          title: `${projectName} 代码推送审查 (${pushInfo.totalCommits} 个提交)`,
          text: markdownText,
        },
      };
      
      // Prepare request URL with signature if needed
      let requestUrl = webhookUrl;
      if (secret && timestamp && sign) {
        requestUrl += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
      }
      
      // Send message to DingTalk
      const response = await axios.post(requestUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.data.errcode === 0) {
        return {
          success: true,
          message: '批量钉钉消息发送成功',
        };
      } else {
        throw new Error(`钉钉API错误: ${response.data.errmsg}`);
      }
    } catch (error: any) {
      return {
        success: false,
        message: `发送批量钉钉消息失败: ${error.message}`,
      };
    }
  },
});

export const dingtalkSimpleTool = createTool({
  id: 'dingtalk-simple',
  description: 'Send simple text message to DingTalk',
  inputSchema: z.object({
    webhookUrl: z.string(),
    secret: z.string().optional(),
    message: z.string(),
    title: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { webhookUrl, secret, message, title } = context;
    
    try {
      // Generate signature if secret is provided
      let timestamp: string | undefined;
      let sign: string | undefined;
      
      if (secret) {
        timestamp = Date.now().toString();
        const stringToSign = `${timestamp}\n${secret}`;
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(stringToSign);
        sign = hmac.digest('base64');
      }
      
      // Prepare request payload
      const payload = {
        msgtype: 'text',
        text: {
          content: message,
        },
      };
      
      // Prepare request URL with signature if needed
      let requestUrl = webhookUrl;
      if (secret && timestamp && sign) {
        requestUrl += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
      }
      
      // Send message to DingTalk
      const response = await axios.post(requestUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.data.errcode === 0) {
        return {
          success: true,
          message: '钉钉消息发送成功',
        };
      } else {
        throw new Error(`钉钉API错误: ${response.data.errmsg}`);
      }
    } catch (error: any) {
      return {
        success: false,
        message: `发送钉钉消息失败: ${error.message}`,
      };
    }
  },
});