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
  systemPrompt: "You are a professional legal advisor, skilled in contract review and legal consulting. You need to carefully analyze the documents provided by the user, identify potential legal risks, and provide professional advice.",
  messages: [
    { 
      role: "user", 
      content: "Help me view the files in the working directory" 
    },
    { 
      role: "agent", 
      agentName: "Legal Advisor",
      content: "Sure, let me view the file list of the current working directory.",
      toolCalls: [{
        name: "list_directory",
        arguments: { path: "/workspace" },
        result: "[FILE] contract_v1.docx\n[FILE] contract_v2.docx\n[FILE] legal_opinion.pdf\n[DIR] attachments\n[FILE] meeting_notes.md\n[FILE] client_requirements.txt\n[FILE] draft_agreement.docx\n[FILE] revision_history.xlsx"
      }],
      contentAfterTool: "The working directory contains the following files:\n- 2 contract files (contract_v1.docx, contract_v2.docx)\n- 1 legal opinion (legal_opinion.pdf)\n- 1 attachments directory\n- Other auxiliary files\n\nWhich file would you like me to review?"
    },
    { 
      role: "user", 
      content: "Read the content of contract_v1.docx" 
    },
    {
      role: "agent",
      agentName: "Legal Advisor", 
      content: "Sure, let me read the contract file.",
      toolCalls: [{
        name: "read_file",
        arguments: { path: "/workspace/contract_v1.docx" },
        result: "# Partnership Agreement\n\n## Article 1 General Provisions\n\nThis agreement is entered into by the following parties to clarify the basic principles of the partnership and the rights and obligations of each party. This agreement takes effect from the date of signing and is valid for five years.\n\n## Article 2 Partner Information\n\nParty A: Zhang San, ID No.: 310xxx19800101xxxx, Address: xxx Road, Pudong New Area, Shanghai\nParty B: Li Si, ID No.: 310xxx19850515xxxx, Address: xxx Road, Xuhui District, Shanghai\n\n## Article 3 Contribution Method and Ratio\n\nParty A contributes RMB 1,000,000, holding 60% of shares, in the form of monetary contribution.\nParty B contributes RMB 500,000, holding 40% of shares, in the form of monetary contribution.\nAll contributions shall be fully paid within 30 days after signing this agreement.\n\n## Article 4 Profit Distribution and Loss Sharing\n\n1. Profits are distributed according to the contribution ratio and settled quarterly.\n2. Losses are shared according to the contribution ratio.\n3. 20% of annual profit is retained as reserve fund.\n\n## Article 5 Execution of Partnership Affairs\n\n1. Partnership affairs are executed by Party A.\n2. Major matters require unanimous consent of all partners.\n3. Daily operational matters are decided by the executing partner."
      }],
      contentAfterTool: "This is a partnership agreement. The main content includes:\n1. The partners are Zhang San and Li Si\n2. The contribution ratio is 60:40\n3. Profits are distributed according to the contribution ratio\n\nWould you like me to analyze the contract clauses in detail?"
    },
    { 
      role: "user", 
      content: "Analyze what risk points this contract has" 
    }
  ]
};

export const mockToolDefinitions = [
  {
    name: "list_directory",
    description: "List all files and subdirectories under the specified directory, returning file name, type, and size information",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The directory path to list, supporting both relative and absolute paths"
        },
        recursive: {
          type: "boolean",
          description: "Whether to recursively list subdirectory contents",
          default: false
        }
      },
      required: ["path"]
    }
  },
  {
    name: "read_file",
    description: "Read the content of the file at the specified path, supporting both text and binary file reading operations",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The full path of the file to read, supporting both relative and absolute paths"
        },
        encoding: {
          type: "string",
          description: "File encoding format, defaults to utf-8",
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
