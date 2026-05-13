// 静态示例数据，用于实时预览消息处理效果

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
  result: string;
}

export interface MockMessage {
  role: 'user' | 'agent';
  content: string;
  agentName?: string;
  toolCalls?: ToolCall[];
  contentAfterTool?: string;
}

export const mockConversation: {
  systemPrompt: string;
  messages: MockMessage[];
} = {
  systemPrompt: "你是一位专业的法律顾问，擅长合同审查和法律咨询。你需要仔细分析用户提供的文档，识别潜在的法律风险，并提供专业的建议。",
  messages: [
    { 
      role: "user", 
      content: "帮我查看一下工作目录的文件" 
    },
    { 
      role: "agent", 
      agentName: "法律顾问",
      content: "好的，我来查看当前工作目录的文件列表。",
      toolCalls: [{
        name: "list_directory",
        arguments: { path: "/workspace" },
        result: "[FILE] contract_v1.docx\n[FILE] contract_v2.docx\n[FILE] legal_opinion.pdf\n[DIR] attachments\n[FILE] meeting_notes.md\n[FILE] client_requirements.txt\n[FILE] draft_agreement.docx\n[FILE] revision_history.xlsx"
      }],
      contentAfterTool: "工作目录中有以下文件：\n- 2个合同文件 (contract_v1.docx, contract_v2.docx)\n- 1个法律意见书 (legal_opinion.pdf)\n- 1个附件目录\n- 其他辅助文件\n\n请问您需要我查看哪个文件？"
    },
    { 
      role: "user", 
      content: "读取 contract_v1.docx 的内容" 
    },
    {
      role: "agent",
      agentName: "法律顾问", 
      content: "好的，我来读取合同文件。",
      toolCalls: [{
        name: "read_file",
        arguments: { path: "/workspace/contract_v1.docx" },
        result: "# 合伙人协议\n\n## 第一条 总则\n\n本协议由以下各方签订，旨在明确合伙经营的基本原则和各方权利义务。本协议自签署之日起生效，有效期为五年。\n\n## 第二条 合伙人信息\n\n甲方：张三，身份证号：310xxx19800101xxxx，住址：上海市浦东新区xxx路xxx号\n乙方：李四，身份证号：310xxx19850515xxxx，住址：上海市徐汇区xxx路xxx号\n\n## 第三条 出资方式与比例\n\n甲方出资人民币100万元整，占股60%，出资方式为货币出资。\n乙方出资人民币50万元整，占股40%，出资方式为货币出资。\n全部出资应于本协议签署后30日内缴足。\n\n## 第四条 利润分配与亏损分担\n\n1. 利润按照出资比例分配，每季度结算一次。\n2. 亏损按照出资比例分担。\n3. 年度利润的20%作为公积金留存。\n\n## 第五条 合伙事务执行\n\n1. 合伙事务由甲方负责执行。\n2. 重大事项需经全体合伙人一致同意。\n3. 日常经营事项由执行合伙人自行决定。"
      }],
      contentAfterTool: "这是一份合伙人协议，主要内容包括：\n1. 合伙人为张三和李四\n2. 出资比例为 60:40\n3. 利润按出资比例分配\n\n需要我对合同条款进行详细分析吗？"
    },
    { 
      role: "user", 
      content: "分析一下这份合同有什么风险点" 
    }
  ]
};

export const mockToolDefinitions = [
  {
    name: "list_directory",
    description: "列出指定目录下的所有文件和子目录，返回文件名、类型和大小信息",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "要列出的目录路径，支持相对路径和绝对路径"
        },
        recursive: {
          type: "boolean",
          description: "是否递归列出子目录内容",
          default: false
        }
      },
      required: ["path"]
    }
  },
  {
    name: "read_file",
    description: "读取指定路径的文件内容，支持文本文件和二进制文件的读取操作",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "要读取的文件的完整路径，支持相对路径和绝对路径"
        },
        encoding: {
          type: "string",
          description: "文件编码格式，默认为utf-8",
          default: "utf-8"
        }
      },
      required: ["path"]
    }
  }
];

// 压缩工具定义（用于对比展示）
export const compressToolDefinition = (tool: typeof mockToolDefinitions[0]) => {
  const compressed = {
    name: tool.name,
    description: tool.description.length > 80 
      ? tool.description.substring(0, 80) + '...' 
      : tool.description,
    parameters: {
      type: "object",
      properties: {} as Record<string, { type: string }>,
      required: tool.parameters.required
    }
  };
  
  for (const [key, value] of Object.entries(tool.parameters.properties)) {
    compressed.parameters.properties[key] = { type: (value as any).type };
  }
  
  return compressed;
};

// 截断工具结果
export const truncateToolResult = (result: string, maxLength: number): string => {
  if (maxLength === 0 || result.length <= maxLength) {
    return result;
  }
  return result.substring(0, maxLength) + '...(truncated)';
};

// 估算 Token 数量（简单估算：中文约1.5字符/token，英文约4字符/token）
export const estimateTokens = (text: string): number => {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
};
