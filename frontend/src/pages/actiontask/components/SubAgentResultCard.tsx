import React, { useState } from 'react';
import { Card, Tag, Typography, Space, Collapse, Tooltip, Avatar, Spin } from 'antd';
import {
  TeamOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
  DownOutlined,
  RightOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const { Text, Paragraph } = Typography;

/**
 * SubAgent 调用结果卡片组件
 *
 * 用于渲染 invoke_agent / invoke_agents 工具的结果。
 * 展示 SubAgent 的回复、状态、耗时等信息。
 */

interface SubAgentResult {
  agent_name: string;
  agent_role: string;
  response: string;
  status: 'success' | 'error';
  elapsed_seconds?: number;
  token_usage?: {
    prompt?: number;
    completion?: number;
  };
}

interface SubAgentResultCardProps {
  /** 工具名称: invoke_agent 或 invoke_agents */
  toolName: string;
  /** 工具参数（JSON 字符串或对象） */
  toolArguments: any;
  /** 工具返回结果（JSON 字符串或对象） */
  toolResult: any;
  /** 工具调用状态 */
  status?: string;
}

// 将秒数格式化为可读字符串
const formatTime = (seconds: number): string => {
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(0)}s`;
};

// 解析 JSON 安全函数
const safeParse = (data: any): any => {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
};

// 颜色映射：根据 agent name 生成一致的颜色
const agentColors = [
  '#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96',
  '#13c2c2', '#2f54eb', '#faad14', '#a0d911', '#f5222d'
];

const getAgentColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return agentColors[Math.abs(hash) % agentColors.length];
};

/**
 * 渲染单个 SubAgent 的结果
 */
const AgentResultItem: React.FC<{
  result: SubAgentResult;
  index: number;
  defaultExpanded?: boolean;
}> = ({ result, index, defaultExpanded = true }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isSuccess = result.status === 'success';
  const color = getAgentColor(result.agent_name);

  return (
    <div
      style={{
        border: `1px solid ${isSuccess ? 'var(--custom-border-color, #d9d9d9)' : '#ff4d4f'}`,
        borderRadius: '8px',
        marginBottom: '8px',
        overflow: 'hidden',
        backgroundColor: 'var(--custom-card-bg, #fff)'
      }}
    >
      {/* Agent 头部 */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          cursor: 'pointer',
          backgroundColor: isSuccess
            ? 'var(--custom-hover-bg, #fafafa)'
            : 'rgba(255, 77, 79, 0.05)',
          borderBottom: expanded ? '1px solid var(--custom-border-color, #f0f0f0)' : 'none'
        }}
      >
        <Space size={8}>
          {expanded ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
          <Avatar
            size="small"
            icon={<RobotOutlined />}
            style={{
              backgroundColor: color,
              color: '#fff',
              fontSize: '12px'
            }}
          />
          <Text strong style={{ fontSize: '13px' }}>
            {result.agent_name}
          </Text>
          <Tag color="default" style={{ fontSize: '11px', lineHeight: '18px', padding: '0 4px' }}>
            {result.agent_role}
          </Tag>
        </Space>
        <Space size={8}>
          {isSuccess ? (
            <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: '11px', margin: 0 }}>
              成功
            </Tag>
          ) : (
            <Tag icon={<CloseCircleOutlined />} color="error" style={{ fontSize: '11px', margin: 0 }}>
              失败
            </Tag>
          )}
          {result.elapsed_seconds !== undefined && (
            <Tooltip title="执行耗时">
              <Tag icon={<ClockCircleOutlined />} style={{ fontSize: '11px', margin: 0 }}>
                {formatTime(result.elapsed_seconds)}
              </Tag>
            </Tooltip>
          )}
        </Space>
      </div>

      {/* Agent 回复内容 */}
      {expanded && (
        <div style={{
          padding: '12px',
          maxHeight: '400px',
          overflow: 'auto',
          fontSize: '13px',
          lineHeight: 1.6
        }}>
          <div className="markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {result.response || '（无内容）'}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * SubAgent 调用结果卡片
 */
const SubAgentResultCard: React.FC<SubAgentResultCardProps> = ({
  toolName,
  toolArguments,
  toolResult,
  status
}) => {
  const args = safeParse(toolArguments);
  const resultData = safeParse(toolResult);

  // 解析结果
  let results: SubAgentResult[] = [];
  let totalElapsed: number | undefined;
  let errorMessage: string | undefined;

  // 从 toolResult 中提取结果
  // 后端返回的数据可能有多层嵌套：
  //   字符串 → {type:"tool_result", content:{success:true, result:{results:[...]}}}
  //   或直接 → {success:true, result:{results:[...]}}
  //   或直接 → {results:[...]}
  const extractResults = (data: any): void => {
    if (!data) return;

    // 如果 data 本身是字符串，尝试解析
    let parsed = safeParse(data);
    if (!parsed || typeof parsed !== 'object') return;

    // 处理 handle_request 的外层包装: {type:"tool_result", content:{...}}
    if (parsed.type === 'tool_result' && parsed.content) {
      const inner = safeParse(parsed.content);
      if (inner && typeof inner === 'object') {
        parsed = inner;
      }
    }

    // 向下查找实际结果：parsed.result 或 parsed 本身
    const innerResult = parsed.result || parsed;

    if (innerResult.results && Array.isArray(innerResult.results)) {
      // invoke_agents 多结果
      results = innerResult.results;
      totalElapsed = innerResult.total_elapsed_seconds;
    } else if (innerResult.agent_name) {
      // invoke_agent 单结果
      results = [innerResult];
      totalElapsed = innerResult.elapsed_seconds;
    } else if (innerResult.agents) {
      // list_available_agents 结果
      results = [];
    }

    if (parsed.error || innerResult.error) {
      errorMessage = parsed.error || innerResult.error;
    }
  };

  extractResults(resultData);

  // 判断是否为 list_available_agents
  const isListAgents = toolName === 'list_available_agents';

  // 提取调用描述
  let callerDescription = '';
  if (toolName === 'invoke_agent') {
    callerDescription = `→ ${args?.target_agent_name || '未知'}`;
  } else if (toolName === 'invoke_agents') {
    // invocations 可能被 LLM 双重序列化为 JSON 字符串
    const rawInvocations = args?.invocations;
    const invocations = Array.isArray(rawInvocations) ? rawInvocations : safeParse(rawInvocations) || [];
    const invArray = Array.isArray(invocations) ? invocations : [];
    const targets = invArray.map((inv: any) => inv.target_agent_name).join(', ');
    callerDescription = `→ [${targets || '未知'}]`;
  }

  // 如果是 list_available_agents，简单展示
  if (isListAgents) {
    const agentsList = safeParse(resultData);
    const agents = agentsList?.agents || agentsList?.result?.agents || [];
    return (
      <Card
        size="small"
        title={
          <Space>
            <TeamOutlined style={{ color: '#1677ff' }} />
            <Text strong style={{ fontSize: '13px' }}>可调用的智能体</Text>
            <Tag color="blue">{agents.length} 个</Tag>
          </Space>
        }
        style={{
          marginTop: '4px',
          marginBottom: '4px',
          borderRadius: '8px',
          border: '1px solid var(--custom-border-color, #d9d9d9)'
        }}
        bodyStyle={{ padding: '8px 12px' }}
      >
        {agents.map((agent: any, idx: number) => (
          <Tag key={idx} color={getAgentColor(agent.name)} style={{ marginBottom: '4px' }}>
            {agent.name} [{agent.role_name}]
          </Tag>
        ))}
      </Card>
    );
  }

  // invoke_agent / invoke_agents 结果卡片
  const isParallel = toolName === 'invoke_agents';
  const allSuccess = results.every(r => r.status === 'success');
  const hasResults = results.length > 0;
  // 判断是否正在执行中（ToolCallAction 已发送但 ToolResult 尚未返回）
  const isLoading = !toolResult && !errorMessage;

  return (
    <Card
      size="small"
      title={
        <Space>
          <TeamOutlined style={{ color: '#1677ff' }} />
          <Text strong style={{ fontSize: '13px' }}>
            {isParallel ? 'SubAgent 并行调用' : 'SubAgent 调用'}
          </Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {callerDescription}
          </Text>
          {isLoading ? (
            <Tag icon={<LoadingOutlined />} color="processing" style={{ fontSize: '11px', margin: 0 }}>
              调用中...
            </Tag>
          ) : hasResults ? (
            <>
              {allSuccess ? (
                <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: '11px', margin: 0 }}>
                  全部成功
                </Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="warning" style={{ fontSize: '11px', margin: 0 }}>
                  部分失败
                </Tag>
              )}
            </>
          ) : null}
          {totalElapsed !== undefined && (
            <Tooltip title={isParallel ? '总耗时（并行执行）' : '执行耗时'}>
              <Tag icon={<ClockCircleOutlined />} style={{ fontSize: '11px', margin: 0 }}>
                {formatTime(totalElapsed)}
              </Tag>
            </Tooltip>
          )}
        </Space>
      }
      style={{
        marginTop: '4px',
        marginBottom: '4px',
        borderRadius: '8px',
        border: '1px solid var(--custom-border-color, #d9d9d9)'
      }}
      bodyStyle={{ padding: '8px 12px' }}
    >
      {/* 错误信息 */}
      {errorMessage && (
        <div style={{
          padding: '8px 12px',
          marginBottom: '8px',
          backgroundColor: 'rgba(255, 77, 79, 0.05)',
          borderRadius: '4px',
          border: '1px solid #ff4d4f'
        }}>
          <Text type="danger" style={{ fontSize: '12px' }}>{errorMessage}</Text>
        </div>
      )}

      {/* SubAgent 结果列表 */}
      {results.map((result, idx) => (
        <AgentResultItem
          key={idx}
          result={result}
          index={idx}
          defaultExpanded={results.length <= 3}
        />
      ))}

      {/* 加载中 / 无结果 */}
      {!hasResults && !errorMessage && (
        isLoading ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />} />
            <div style={{ marginTop: '8px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                正在调用 SubAgent，请稍候...
              </Text>
            </div>
          </div>
        ) : (
          <Text type="secondary" style={{ fontSize: '12px' }}>
            暂无结果
          </Text>
        )
      )}
    </Card>
  );
};

export default SubAgentResultCard;
