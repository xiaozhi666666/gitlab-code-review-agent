import 'dotenv/config';
import express from 'express';
import { gitlabWebhookTool } from './mastra/tools/gitlab-webhook-tool';
import { codeReviewTool } from './mastra/tools/code-review-tool';
import { dingtalkTool } from './mastra/tools/dingtalk-tool';

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
    });

    if (!webhookResult.isValidPush) {
      console.log('ℹ️ 非有效推送事件，跳过处理');
      return res.json({
        success: true,
        message: '非有效推送事件',
        reviewCount: 0,
      });
    }

    console.log(`📊 处理 ${webhookResult.commits.length} 个提交 (测试模式)`);
    let totalReviews = 0;

    // 2. 处理每个提交 (使用模拟数据)
    for (const commit of webhookResult.commits) {
      try {
        console.log(`🔍 分析提交: ${commit.shortId}`);
        console.log(`📋 提交信息: ${commit.message.split('\n')[0]}`);
        console.log(`👤 提交者: ${commit.author}`);
        console.log(`📁 文件变更: ${commit.filesChanged.length} 个文件`);

        // 模拟文件差异数据 (跳过真实的GitLab API调用)
        const mockFiles = commit.filesChanged.map(filePath => ({
          filePath,
          content: `// 这是 ${filePath} 的模拟内容
function example() {
  console.log("Hello World");
  return true;
}`,
          diff: `--- a/${filePath}
+++ b/${filePath}
@@ -1,3 +1,5 @@
+// 新增的注释
 function example() {
-  console.log("Hello");
+  console.log("Hello World");
   return true;
 }`
        }));

        console.log(`📄 使用模拟的 ${mockFiles.length} 个文件差异`);

        // 2.2 AI 代码审查
        console.log(`🤖 开始 AI 代码审查...`);
        const reviewResult = await codeReviewTool.execute({
          context: {
            commitMessage: commit.message,
            authorName: commit.author,
            files: mockFiles,
            projectName: webhookResult.projectName,
            commitUrl: commit.url,
          },
        });
        
        console.log(`📊 审查完成，评分: ${reviewResult.overallScore}/10`);
        console.log(`🔍 发现问题: ${reviewResult.issues.length} 个`);
        console.log(`👍 积极方面: ${reviewResult.positives.length} 个`);

        // 2.3 发送钉钉通知
        console.log(`📤 发送钉钉通知...`);
        if (!process.env.DINGTALK_WEBHOOK_URL) {
          throw new Error('DINGTALK_WEBHOOK_URL 未配置');
        }

        const notifyResult = await dingtalkTool.execute({
          context: {
            webhookUrl: process.env.DINGTALK_WEBHOOK_URL!,
            secret: process.env.DINGTALK_SECRET,
            projectName: webhookResult.projectName,
            commitInfo: {
              id: commit.id,
              shortId: commit.shortId,
              message: commit.message,
              author: commit.author,
              url: commit.url,
              branch: req.body.ref?.replace('refs/heads/', '') || 'unknown',
            },
            reviewResult,
          },
        });

        if (notifyResult.success) {
          totalReviews++;
          console.log(`✅ 提交 ${commit.shortId} 处理完成`);
          console.log(`📱 钉钉通知发送成功`);
        } else {
          console.log(`❌ 提交 ${commit.shortId} 钉钉通知失败: ${notifyResult.message}`);
        }

      } catch (error: any) {
        console.error(`❌ 处理提交 ${commit.shortId} 失败:`, error.message);
      }
    }

    res.json({
      success: true,
      message: `测试模式: 成功处理 ${totalReviews}/${webhookResult.commits.length} 个提交`,
      reviewCount: totalReviews,
    });

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