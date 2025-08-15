import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const codeReviewTool = createTool({
  id: 'code-review',
  description: 'Analyze code changes and generate AI-powered code review comments',
  inputSchema: z.object({
    commitMessage: z.string(),
    authorName: z.string(),
    files: z.array(z.object({
      filePath: z.string(),
      content: z.string().optional(),
      diff: z.string(),
    })),
    projectName: z.string(),
    commitUrl: z.string(),
  }),
  outputSchema: z.object({
    overallScore: z.number().min(0).max(10),
    summary: z.string(),
    issues: z.array(z.object({
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      type: z.enum(['bug', 'security', 'performance', 'style', 'maintainability', 'documentation']),
      file: z.string(),
      line: z.number().optional(),
      message: z.string(),
      suggestion: z.string().optional(),
    })),
    positives: z.array(z.string()),
    recommendations: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    const { commitMessage, authorName, files, projectName, commitUrl } = context;
    
    // Prepare the code analysis prompt
    const filesAnalysis = files.map(file => ({
      path: file.filePath,
      diff: file.diff,
      content: file.content?.substring(0, 5000) || 'Content not available', // Limit content size
    }));
    
    const analysisPrompt = `
请对以下代码提交进行详细的代码审查分析：

项目：${projectName}
提交者：${authorName}
提交信息：${commitMessage}
提交链接：${commitUrl}

变更文件：
${filesAnalysis.map(file => `
文件: ${file.path}
差异:
${file.diff}

${file.content !== 'Content not available' ? `文件内容片段:
${file.content}` : ''}
`).join('\n---\n')}

请从以下方面进行代码审查：

1. **代码质量**：语法、逻辑、错误处理
2. **安全性**：潜在的安全漏洞、敏感信息泄露
3. **性能**：算法效率、资源使用
4. **可维护性**：代码结构、命名规范、注释
5. **最佳实践**：编程规范、设计模式
6. **文档**：注释完整性、文档更新

请按以下JSON格式返回分析结果：
{
  "overallScore": 数字(0-10分，10分为最好),
  "summary": "整体评价摘要（2-3句话）",
  "issues": [
    {
      "severity": "low|medium|high|critical",
      "type": "bug|security|performance|style|maintainability|documentation",
      "file": "文件路径",
      "line": 行号（可选），
      "message": "问题描述",
      "suggestion": "改进建议（可选）"
    }
  ],
  "positives": ["积极方面的评价"],
  "recommendations": ["总体改进建议"]
}

请确保分析中文输出，关注实际代码问题，提供有建设性的建议。
    `;
    
    try {
      // This would typically use an AI service, but for now we'll create a mock response
      // In a real implementation, you'd use OpenAI API or similar
      
      // Simple heuristic-based analysis for demonstration
      const issues = [];
      const positives = [];
      let score = 8; // Default good score
      
      // Analyze each file
      for (const file of files) {
        const diff = file.diff.toLowerCase();
        
        // Check for potential security issues
        if (diff.includes('password') || diff.includes('secret') || diff.includes('token')) {
          issues.push({
            severity: 'high' as const,
            type: 'security' as const,
            file: file.filePath,
            message: '代码中可能包含敏感信息（密码、密钥、token等）',
            suggestion: '建议使用环境变量或配置文件来存储敏感信息',
          });
          score -= 2;
        }
        
        // Check for console.log
        if (diff.includes('console.log') || diff.includes('print(')) {
          issues.push({
            severity: 'low' as const,
            type: 'style' as const,
            file: file.filePath,
            message: '代码中包含调试输出语句',
            suggestion: '生产环境中应移除或使用适当的日志框架',
          });
          score -= 0.5;
        }
        
        // Check for TODO comments
        if (diff.includes('todo') || diff.includes('fixme')) {
          issues.push({
            severity: 'medium' as const,
            type: 'maintainability' as const,
            file: file.filePath,
            message: '代码中包含待办事项注释',
            suggestion: '建议及时处理或创建相应的任务追踪',
          });
        }
        
        // Check for large files
        if (file.diff.split('\n').length > 100) {
          issues.push({
            severity: 'medium' as const,
            type: 'maintainability' as const,
            file: file.filePath,
            message: '单次提交的代码变更较大',
            suggestion: '建议将大型变更拆分为多个小的、逻辑相关的提交',
          });
          score -= 1;
        }
        
        // Check for good practices
        if (diff.includes('test') || diff.includes('spec')) {
          positives.push(`在 ${file.filePath} 中包含了测试代码`);
          score += 0.5;
        }
        
        if (diff.includes('/**') || diff.includes('//')) {
          positives.push(`${file.filePath} 包含良好的代码注释`);
        }
      }
      
      // Analyze commit message
      if (commitMessage.length < 10) {
        issues.push({
          severity: 'low' as const,
          type: 'documentation' as const,
          file: 'commit',
          message: '提交信息过于简短',
          suggestion: '建议使用更详细描述性的提交信息',
        });
        score -= 0.5;
      }
      
      if (commitMessage.match(/^(feat|fix|docs|style|refactor|test|chore):/)) {
        positives.push('使用了规范的提交信息格式');
        score += 0.5;
      }
      
      const recommendations = [];
      if (issues.length === 0) {
        recommendations.push('代码质量良好，继续保持！');
      } else {
        recommendations.push('建议在提交前运行代码检查工具');
        if (issues.some(i => i.type === 'security')) {
          recommendations.push('建议定期进行安全审计');
        }
        if (issues.some(i => i.type === 'maintainability')) {
          recommendations.push('建议遵循项目的编码规范和最佳实践');
        }
      }
      
      return {
        overallScore: Math.max(0, Math.min(10, score)),
        summary: `代码提交包含 ${files.length} 个文件的变更。${issues.length > 0 ? `发现 ${issues.length} 个需要注意的问题。` : '代码质量良好。'}${positives.length > 0 ? `有 ${positives.length} 个积极的方面。` : ''}`,
        issues,
        positives,
        recommendations,
      };
    } catch (error: any) {
      throw new Error(`代码审查分析失败: ${error.message}`);
    }
  },
});