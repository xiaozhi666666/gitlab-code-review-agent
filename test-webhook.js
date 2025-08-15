import axios from 'axios';

// 模拟 GitLab push webhook 数据
const mockWebhookData = {
  headers: {
    'x-gitlab-event': 'Push Hook',
    'x-gitlab-token': 'gitlab-code-review-webhook-2025',
    'content-type': 'application/json'
  },
  body: {
    object_kind: 'push',
    before: '95790bf891e76fee5e1747ab589903a6a1f80f22',
    after: 'da1560886d4f094c3e6c9ef40349f7d38b5d27d7',
    ref: 'refs/heads/main',
    user_name: '测试用户',
    user_email: 'test@example.com',
    project: {
      id: 52,
      name: '测试项目',
      web_url: 'https://gitlab.xiaomawang.com/test/project',
      http_url: 'https://gitlab.xiaomawang.com/test/project.git'
    },
    commits: [
      {
        id: 'da1560886d4f094c3e6c9ef40349f7d38b5d27d7',
        message: 'feat: 添加用户登录功能\n\n- 实现JWT认证\n- 添加用户验证中间件\n- 更新API文档',
        timestamp: new Date().toISOString(),
        url: 'https://gitlab.xiaomawang.com/test/project/-/commit/da1560886d4f094c3e6c9ef40349f7d38b5d27d7',
        author: {
          name: '张三',
          email: 'zhangsan@example.com'
        },
        added: ['src/auth/login.js', 'src/middleware/auth.js'],
        removed: [],
        modified: ['src/routes/user.js', 'README.md', 'package.json']
      }
    ]
  }
};

async function testWebhook() {
  try {
    console.log('🚀 开始测试 GitLab Webhook...');
    console.log('📤 发送模拟数据到本地服务器...');
    
    const response = await axios.post('http://localhost:3000/webhook/gitlab', mockWebhookData.body, {
      headers: mockWebhookData.headers
    });
    
    console.log('✅ 测试成功!');
    console.log('📊 响应结果:', response.data);
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('📋 错误详情:', error.response.data);
    }
  }
}

// 检查服务器是否运行
async function checkServer() {
  try {
    await axios.get('http://localhost:3000/health');
    console.log('✅ 服务器运行正常');
    return true;
  } catch (error) {
    console.error('❌ 服务器未运行，请先启动: npm run server:dev');
    return false;
  }
}

async function main() {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await testWebhook();
  }
}

main();