import 'dotenv/config';
import express from 'express';
import { gitlabWebhookTool, gitlabApiTool } from './mastra/tools/gitlab-webhook-tool';
import { codeReviewTool } from './mastra/tools/code-review-tool';
import { dingtalkTool } from './mastra/tools/dingtalk-tool';

const app = express();
app.use(express.json());

// GitLab Code Review Webhook Endpoint
app.post('/webhook/gitlab', async (req, res) => {
  try {
    console.log('📥 收到 GitLab Webhook 请求');
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

    console.log(`📊 处理 ${webhookResult.commits.length} 个提交`);
    let totalReviews = 0;

    // 2. 处理每个提交
    for (const commit of webhookResult.commits) {
      try {
        console.log(`🔍 分析提交: ${commit.shortId}`);
        console.log(`📋 提交信息: ${commit.message.split('\n')[0]}`);
        console.log(`👤 提交者: ${commit.author}`);
        console.log(`📁 文件变更: ${commit.filesChanged.length} 个文件`);

        // 验证必要的环境变量
        if (!process.env.GITLAB_ACCESS_TOKEN) {
          throw new Error('GITLAB_ACCESS_TOKEN 未配置');
        }
        if (!process.env.GITLAB_PROJECT_ID) {
          throw new Error('GITLAB_PROJECT_ID 未配置');
        }

        console.log(`🔗 GitLab API 请求: ${process.env.GITLAB_URL}/api/v4/projects/${process.env.GITLAB_PROJECT_ID}/repository/commits/${commit.id}/diff`);

        // 2.1 获取代码差异
        const diffResult = await gitlabApiTool.execute({
          context: {
            gitlabUrl: process.env.GITLAB_URL || 'https://gitlab.com',
            accessToken: process.env.GITLAB_ACCESS_TOKEN!,
            projectId: parseInt(process.env.GITLAB_PROJECT_ID!),
            commitSha: commit.id,
          },
          runtimeContext: {} as any
        });

        console.log(`📄 获取到 ${diffResult.files.length} 个文件的差异`);

        // 如果没有文件差异，跳过这个提交
        if (diffResult.files.length === 0) {
          console.log(`⏩ 提交 ${commit.shortId} 没有文件差异，跳过审查`);
          continue;
        }

        // 2.2 AI 代码审查
        console.log(`🤖 开始 AI 代码审查...`);
        const reviewResult = await codeReviewTool.execute({
          context: {
            commitMessage: commit.message,
            authorName: commit.author,
            files: diffResult.files,
            projectName: webhookResult.projectName,
            commitUrl: commit.url,
          },
          runtimeContext: {} as any
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
              branch: req.body.ref?.replace('refs/heads/', '') || 'unknown', // 提取分支名
            },
            reviewResult,
          },
          runtimeContext: {} as any
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
      message: `成功处理 ${totalReviews}/${webhookResult.commits.length} 个提交`,
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
    service: 'GitLab Code Review (Simple)' 
  });
});

// 测试钉钉消息端点
app.post('/test/dingtalk', async (req, res) => {
  try {
    const { message, title } = req.body;
    
    if (!process.env.DINGTALK_WEBHOOK_URL) {
      return res.status(400).json({ error: 'DingTalk webhook URL 未配置' });
    }

    // 创建一个简单的测试审查结果
    const testReviewResult = {
      overallScore: 9,
      summary: '这是一个测试消息，用于验证钉钉通知功能是否正常工作。',
      issues: [
        {
          severity: 'low',
          type: 'style',
          file: 'test.js',
          message: '这是一个测试问题',
          suggestion: '这是一个测试建议',
        }
      ],
      positives: ['测试功能正常', '代码结构清晰'],
      recommendations: ['继续保持良好的编码习惯'],
    };

    const result = await dingtalkTool.execute({
      context: {
        webhookUrl: process.env.DINGTALK_WEBHOOK_URL,
        secret: process.env.DINGTALK_SECRET,
        projectName: '测试项目',
        commitInfo: {
          id: 'test123456789',
          shortId: 'test1234',
          message: message || '测试提交信息',
          author: '测试用户',
          url: 'https://gitlab.com/test/commit/test123456789',
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
    service: 'GitLab Code Review System (Simple)',
    version: '1.0.0',
    description: '简化版代码审查系统，避免复杂的 Workflow 依赖',
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
  console.log(`🚀 GitLab Code Review Server (Simple) is running on port ${PORT}`);
  console.log(`📝 Webhook endpoint: http://localhost:${PORT}/webhook/gitlab`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test DingTalk: POST http://localhost:${PORT}/test/dingtalk`);
  console.log(`ℹ️  System info: http://localhost:${PORT}/info`);
});

export default app;