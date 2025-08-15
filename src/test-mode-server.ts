import 'dotenv/config';
import express from 'express';
import { gitlabWebhookTool } from './mastra/tools/gitlab-webhook-tool';
import { codeReviewTool } from './mastra/tools/code-review-tool';
import { dingtalkTool, dingtalkBatchTool } from './mastra/tools/dingtalk-tool';

const app = express();
app.use(express.json());

// GitLab Code Review Webhook Endpoint (Test Mode)
app.post('/webhook/gitlab', async (req, res) => {
  try {
    console.log('📥 收到 GitLab Webhook 请求 (测试模式)');
    console.log('🔍 Headers:', JSON.stringify({
      'x-gitlab-event': req.headers['x-gitlab-event'],
      'x-gitlab-token': req.headers['x-gitlab-token'] ? '***' : 'missing',
      'content-type': req.headers['content-type']
    }, null, 2));
    console.log('📦 Body:', JSON.stringify({
      object_kind: req.body.object_kind,
      ref: req.body.ref,
      project_name: req.body.project?.name,
      commits_count: req.body.commits?.length
    }, null, 2));
    
    // 1. 处理 GitLab webhook
    const webhookResult = await gitlabWebhookTool.execute({
      context: {
        headers: req.headers as any,
        body: req.body,
        secretToken: process.env.GITLAB_WEBHOOK_SECRET,
      },
      runtimeContext: {} as any
    });

    if (!webhookResult.isValidPush) {
      console.log('ℹ️ 非有效推送事件，跳过处理');
      return res.json({
        success: true,
        message: '非有效推送事件',
        reviewCount: 0,
      });
    }

    console.log(`📊 批量处理 ${webhookResult.commits.length} 个提交 (测试模式)`);
    
    // 2. 批量处理所有提交的代码审查
    const commitsReviews = [];
    
    for (const commit of webhookResult.commits) {
      try {
        console.log(`🔍 分析提交: ${commit.shortId}`);
        console.log(`📋 提交信息: ${commit.message.split('\n')[0]}`);
        console.log(`👤 提交者: ${commit.author}`);
        console.log(`📁 文件变更: ${commit.filesChanged.length} 个文件`);

        // 模拟文件差异数据 (跳过真实的GitLab API调用)
        const mockFiles = commit.filesChanged.map(filePath => {
          // 根据文件类型生成不同的模拟内容
          if (filePath.endsWith('.html')) {
            return {
              filePath,
              content: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>${filePath} 页面</title>
</head>
<body>
    <h1>欢迎来到${filePath}</h1>
    <p>这是新增的内容</p>
</body>
</html>`,
              diff: `--- a/${filePath}
+++ b/${filePath}
@@ -5,6 +5,7 @@
 </head>
 <body>
     <h1>欢迎来到${filePath}</h1>
+    <p>这是新增的内容</p>
 </body>
 </html>`
            };
          } else if (filePath.endsWith('.css')) {
            return {
              filePath,
              content: `.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.new-style {
  color: #333;
  font-size: 16px;
}`,
              diff: `--- a/${filePath}
+++ b/${filePath}
@@ -3,3 +3,8 @@
   margin: 0 auto;
   padding: 20px;
 }
+
+.new-style {
+  color: #333;
+  font-size: 16px;
+}`
            };
          } else {
            // JavaScript或其他文件类型
            return {
              filePath,
              content: `// 这是 ${filePath} 的模拟内容
function example() {
  // 使用适当的日志记录
  logger.info("Hello World");
  return true;
}`,
              diff: `--- a/${filePath}
+++ b/${filePath}
@@ -1,3 +1,5 @@
+// 新增的注释
 function example() {
-  logger.info("Hello");
+  logger.info("Hello World");
   return true;
 }`
            };
          }
        });

        console.log(`📄 使用模拟的 ${mockFiles.length} 个文件差异`);

        // 2.1 AI 代码审查
        console.log(`🤖 开始 AI 代码审查...`);
        const reviewResult = await codeReviewTool.execute({
          context: {
            commitMessage: commit.message,
            authorName: commit.author,
            files: mockFiles,
            projectName: webhookResult.projectName,
            commitUrl: commit.url,
          },
          runtimeContext: {} as any
        });
        
        console.log(`📊 审查完成，评分: ${reviewResult.overallScore}/10`);
        console.log(`🔍 发现问题: ${reviewResult.issues.length} 个`);
        console.log(`👍 积极方面: ${reviewResult.positives.length} 个`);

        // 收集审查结果
        commitsReviews.push({
          commitInfo: {
            id: commit.id,
            shortId: commit.shortId,
            message: commit.message,
            author: commit.author,
            url: commit.url,
          },
          reviewResult,
        });

        console.log(`✅ 提交 ${commit.shortId} 分析完成`);

      } catch (error: any) {
        console.error(`❌ 处理提交 ${commit.shortId} 失败:`, error.message);
      }
    }

    // 3. 发送批量钉钉通知
    if (commitsReviews.length > 0) {
      console.log(`📤 发送批量钉钉通知 (${commitsReviews.length} 个提交)...`);
      
      if (!process.env.DINGTALK_WEBHOOK_URL) {
        throw new Error('DINGTALK_WEBHOOK_URL 未配置');
      }

      // 获取主要提交者（提交数量最多的作者）
      const authorCounts = commitsReviews.reduce((acc, review) => {
        acc[review.commitInfo.author] = (acc[review.commitInfo.author] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const mainAuthor = Object.entries(authorCounts).reduce((a, b) => 
        authorCounts[a[0]] > authorCounts[b[0]] ? a : b
      )[0];

      const batchNotifyResult = await dingtalkBatchTool.execute({
        context: {
          webhookUrl: process.env.DINGTALK_WEBHOOK_URL!,
          secret: process.env.DINGTALK_SECRET,
          projectName: webhookResult.projectName,
          pushInfo: {
            branch: req.body.ref?.replace('refs/heads/', '') || 'unknown',
            totalCommits: commitsReviews.length,
            author: mainAuthor,
          },
          commitsReviews,
        },
        runtimeContext: {} as any
      });

      if (batchNotifyResult.success) {
        console.log(`✅ 批量钉钉通知发送成功`);
        res.json({
          success: true,
          message: `测试模式: 成功处理并发送批量通知 (${commitsReviews.length} 个提交)`,
          reviewCount: commitsReviews.length,
        });
      } else {
        console.log(`❌ 批量钉钉通知失败: ${batchNotifyResult.message}`);
        res.json({
          success: false,
          message: `批量通知失败: ${batchNotifyResult.message}`,
          reviewCount: commitsReviews.length,
        });
      }
    } else {
      res.json({
        success: false,
        message: '没有成功处理的提交',
        reviewCount: 0,
      });
    }

  } catch (error: any) {
    console.error('❌ Webhook 处理失败:', error.message);
    res.status(500).json({
      success: false,
      message: `处理失败: ${error.message}`,
    });
  }
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'GitLab Code Review (Test Mode)' 
  });
});

// 测试批量钉钉消息端点
app.post('/test/dingtalk-batch', async (req, res) => {
  try {
    if (!process.env.DINGTALK_WEBHOOK_URL) {
      return res.status(400).json({ error: 'DingTalk webhook URL 未配置' });
    }

    // 创建测试用的批量审查结果
    const testCommitsReviews = [
      {
        commitInfo: {
          id: 'test-commit-1-12345678',
          shortId: 'test1234',
          message: '🚀 添加新功能：用户认证系统',
          author: '小小智',
          url: 'https://gitlab.xiaomawang.com/test/project/-/commit/test-commit-1-12345678',
        },
        reviewResult: {
          overallScore: 8.5,
          summary: '代码质量良好，实现了完整的用户认证功能',
          issues: [
            {
              severity: 'medium',
              type: 'security',
              file: 'src/auth/login.ts',
              line: 45,
              message: '密码验证逻辑可能存在时序攻击风险',
              suggestion: '建议使用恒定时间比较函数',
            }
          ],
          positives: ['代码结构清晰', '包含完整的测试'],
          recommendations: ['建议添加更多的边界条件测试', '考虑使用更安全的密码存储方式'],
        },
      },
      {
        commitInfo: {
          id: 'test-commit-2-87654321',
          shortId: 'test5678',
          message: '🐛 修复用户登录时的内存泄漏问题',
          author: '小小智',
          url: 'https://gitlab.xiaomawang.com/test/project/-/commit/test-commit-2-87654321',
        },
        reviewResult: {
          overallScore: 9.2,
          summary: '优秀的bug修复，解决了重要的内存泄漏问题',
          issues: [],
          positives: ['修复了关键性能问题', '代码清理得很好', '添加了防护代码'],
          recommendations: ['建议添加性能监控', '可以考虑添加相关的单元测试'],
        },
      }
    ];

    const result = await dingtalkBatchTool.execute({
      context: {
        webhookUrl: process.env.DINGTALK_WEBHOOK_URL,
        secret: process.env.DINGTALK_SECRET,
        projectName: '测试项目',
        pushInfo: {
          branch: 'main',
          totalCommits: 2,
          author: '小小智',
        },
        commitsReviews: testCommitsReviews,
      },
      runtimeContext: {} as any
    });

    res.json(result);
  } catch (error: any) {
    console.error('DingTalk batch test error:', error);
    res.status(500).json({
      success: false,
      message: `发送批量测试消息失败: ${error.message}`,
    });
  }
});

// 测试钉钉消息端点
app.post('/test/dingtalk', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!process.env.DINGTALK_WEBHOOK_URL) {
      return res.status(400).json({ error: 'DingTalk webhook URL 未配置' });
    }

    // 创建一个简单的测试审查结果
    const testReviewResult = {
      overallScore: 8,
      summary: '这是测试模式的代码审查报告。系统跳过了GitLab API调用，使用模拟数据进行审查。',
      issues: [
        {
          severity: 'medium' as const,
          type: 'style' as const,
          file: 'test.js',
          message: '建议使用更具描述性的变量名',
          suggestion: '将变量名从 "data" 改为更具体的名称',
        },
        {
          severity: 'low' as const,
          type: 'documentation' as const,
          file: 'README.md',
          message: '缺少API文档说明',
          suggestion: '建议添加完整的API使用示例',
        }
      ],
      positives: [
        '代码结构清晰，逻辑合理',
        '遵循了良好的命名规范',
        '包含了适当的错误处理'
      ],
      recommendations: [
        '建议添加单元测试覆盖',
        '考虑使用TypeScript提高代码安全性',
        '定期进行代码重构以保持可维护性'
      ],
    };

    const result = await dingtalkTool.execute({
      context: {
        webhookUrl: process.env.DINGTALK_WEBHOOK_URL,
        secret: process.env.DINGTALK_SECRET,
        projectName: '测试项目',
        commitInfo: {
          id: 'test-commit-12345678',
          shortId: 'test1234',
          message: message || '🧪 测试模式代码审查\n\n这是一个测试提交，用于验证钉钉通知功能。',
          author: '测试用户',
          url: 'https://gitlab.xiaomawang.com/test/project/-/commit/test-commit-12345678',
          branch: 'main',
        },
        reviewResult: testReviewResult,
      },
      runtimeContext: {} as any
    });

    res.json(result);
  } catch (error: any) {
    console.error('DingTalk test error:', error);
    res.status(500).json({
      success: false,
      message: `发送测试消息失败: ${error.message}`,
    });
  }
});

// 系统信息
app.get('/info', (req, res) => {
  res.json({
    service: 'GitLab Code Review System (Test Mode)',
    version: '1.0.0',
    description: '测试模式：跳过GitLab API调用，使用模拟数据进行代码审查测试',
    note: '更新有效的GITLAB_ACCESS_TOKEN后可切换回正式模式',
    endpoints: [
      'POST /webhook/gitlab',
      'POST /test/dingtalk',
      'GET /health',
      'GET /info'
    ],
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🧪 GitLab Code Review Server (Test Mode) is running on port ${PORT}`);
  console.log(`📝 Webhook endpoint: http://localhost:${PORT}/webhook/gitlab`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test DingTalk: POST http://localhost:${PORT}/test/dingtalk`);
  console.log(`ℹ️  System info: http://localhost:${PORT}/info`);
  console.log(`⚠️  注意：当前为测试模式，跳过GitLab API调用`);
  console.log(`💡 获取有效的GITLAB_ACCESS_TOKEN后可切换回正式模式`);
});

export default app;