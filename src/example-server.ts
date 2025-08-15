import 'dotenv/config';
import express from 'express';
import { mastra } from './mastra';

const app = express();
app.use(express.json());

// GitLab Code Review Webhook Endpoint
app.post('/webhook/gitlab', async (req, res) => {
  try {
    // 从环境变量或配置中获取必要参数
    const config = {
      secretToken: process.env.GITLAB_WEBHOOK_SECRET,
      gitlabUrl: process.env.GITLAB_URL || 'https://gitlab.com',
      accessToken: process.env.GITLAB_ACCESS_TOKEN,
      projectId: parseInt(process.env.GITLAB_PROJECT_ID || '0'),
      dingtalkWebhook: process.env.DINGTALK_WEBHOOK_URL,
      dingtalkSecret: process.env.DINGTALK_SECRET,
    };

    // 验证必要的配置
    if (!config.accessToken) {
      return res.status(400).json({ error: 'GitLab access token 未配置' });
    }
    if (!config.dingtalkWebhook) {
      return res.status(400).json({ error: 'DingTalk webhook URL 未配置' });
    }
    if (!config.projectId) {
      return res.status(400).json({ error: 'GitLab project ID 未配置' });
    }

    // 运行代码审查工作流
    const workflow = mastra.getWorkflow('codeReviewWorkflow');
    if (!workflow) {
      return res.status(500).json({
        success: false,
        message: 'Code review workflow 未找到',
      });
    }

    const result = await workflow.execute({
      headers: req.headers as any,
      body: req.body,
      ...config,
    });

    res.json({
      success: result.success,
      message: result.message,
      reviewCount: result.reviewCount,
    });

  } catch (error: any) {
    console.error('Code review workflow error:', error);
    res.status(500).json({
      success: false,
      message: `工作流执行失败: ${error.message}`,
    });
  }
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 测试钉钉消息端点
app.post('/test/dingtalk', async (req, res) => {
  try {
    const { message, title } = req.body;
    
    if (!process.env.DINGTALK_WEBHOOK_URL) {
      return res.status(400).json({ error: 'DingTalk webhook URL 未配置' });
    }

    const agent = mastra.getAgent('codeReviewAgent');
    if (!agent) {
      return res.status(500).json({
        success: false,
        message: 'Code review agent 未找到',
      });
    }

    const tools = agent.tools;
    const dingtalkTool = tools?.dingtalkSimpleTool;
    
    if (!dingtalkTool) {
      return res.status(500).json({
        success: false,
        message: 'DingTalk tool 未找到',
      });
    }

    const result = await dingtalkTool.execute({
      context: {
        webhookUrl: process.env.DINGTALK_WEBHOOK_URL,
        secret: process.env.DINGTALK_SECRET,
        message: message || '测试消息',
        title: title || '测试',
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

// 获取工作流信息
app.get('/info', (req, res) => {
  const workflows = Object.keys(mastra.getWorkflows());
  const agents = Object.keys(mastra.getAgents());

  res.json({
    workflows,
    agents,
    version: '1.0.0',
    description: 'GitLab Code Review System with Mastra',
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 GitLab Code Review Server is running on port ${PORT}`);
  console.log(`📝 Webhook endpoint: http://localhost:${PORT}/webhook/gitlab`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test DingTalk: POST http://localhost:${PORT}/test/dingtalk`);
  console.log(`ℹ️  System info: http://localhost:${PORT}/info`);
});

export default app;