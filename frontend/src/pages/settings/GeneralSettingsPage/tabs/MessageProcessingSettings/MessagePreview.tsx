import React from 'react';
import { Tag, Tooltip } from 'antd';
import { mockConversation, truncateToolResult, estimateTokens, MockMessage } from './mockData';

interface MessagePreviewProps {
  mode: 'default' | 'isolation';
  settings: {
    maxHistoryLength: number;
    toolResultMaxLength: number;
    toolCallContextRounds: number;
    splitToolCalls: boolean;
    compressToolDefinitions: boolean;
    includeThinking: boolean;
    autoSummarize: boolean;
  };
  color: string;
}

const MessagePreview: React.FC<MessagePreviewProps> = ({ mode, settings, color }) => {
  const { systemPrompt, messages } = mockConversation;
  
  // 根据 maxHistoryLength 截取历史消息
  const visibleMessages = messages.slice(-(settings.maxHistoryLength + 1)); // +1 是当前消息
  const hiddenCount = Math.max(0, messages.length - visibleMessages.length);
  
  // 格式化工具结果
  const formatToolResult = (result: string) => {
    return truncateToolResult(result, settings.toolResultMaxLength);
  };

  // 渲染默认模式的消息
  const renderDefaultMode = () => {
    const historyMessages = visibleMessages.slice(0, -1);
    const currentMessage = visibleMessages[visibleMessages.length - 1];
    
    return (
      <>
        {/* System Prompt */}
        <div style={{ marginBottom: '12px' }}>
          <Tag color="blue" style={{ marginBottom: '4px' }}>system</Tag>
          <div style={{ 
            background: 'var(--custom-bg-secondary)', 
            padding: '8px 12px', 
            borderRadius: '6px',
            fontSize: '12px',
            color: 'var(--custom-text-secondary)',
            maxHeight: '60px',
            overflow: 'hidden'
          }}>
            {systemPrompt.substring(0, 100)}...
          </div>
        </div>

        {/* 对话历史（在system prompt中） */}
        {historyMessages.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ 
              fontSize: '12px', 
              color: 'var(--custom-text-tertiary)',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              ## 对话历史 
              <Tag color="orange" style={{ fontSize: '10px' }}>
                {historyMessages.length}/{settings.maxHistoryLength}条
              </Tag>
              {hiddenCount > 0 && (
                <Tooltip title={`${hiddenCount}条早期消息已被截断`}>
                  <Tag color="red" style={{ fontSize: '10px' }}>
                    -{hiddenCount}条
                  </Tag>
                </Tooltip>
              )}
            </div>
            <div style={{ 
              background: 'var(--custom-bg-tertiary)', 
              padding: '8px 12px', 
              borderRadius: '6px',
              border: '1px dashed var(--custom-border-color)',
              maxHeight: '280px',
              overflow: 'auto'
            }}>
              {historyMessages.map((msg, idx) => (
                <div key={idx} style={{ marginBottom: '8px', fontSize: '12px' }}>
                  {msg.role === 'user' ? (
                    <div>
                      <span style={{ fontWeight: 500, color }}>**User said:**</span>
                      <div style={{ color: 'var(--custom-text-secondary)', marginLeft: '8px' }}>
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontWeight: 500, color }}>
                        **{msg.agentName} said:**
                      </span>
                      <div style={{ color: 'var(--custom-text-secondary)', marginLeft: '8px' }}>
                        {msg.content}
                        {msg.toolCalls?.map((tc, tcIdx) => (
                          <div key={tcIdx} style={{ 
                            fontFamily: 'monospace', 
                            fontSize: '11px',
                            color: 'var(--custom-text-tertiary)',
                            margin: '4px 0',
                            padding: '4px 8px',
                            background: 'var(--custom-bg-secondary)',
                            borderRadius: '4px'
                          }}>
                            <div style={{ color: '#52c41a' }}>[Called tool: {tc.name}]</div>
                            <div style={{ 
                              color: settings.toolResultMaxLength > 0 && tc.result.length > settings.toolResultMaxLength 
                                ? '#faad14' 
                                : 'inherit'
                            }}>
                              [Result: {formatToolResult(tc.result)}]
                            </div>
                          </div>
                        ))}
                        {msg.contentAfterTool && (
                          <div style={{ marginTop: '4px' }}>
                            {msg.contentAfterTool.substring(0, 100)}...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 当前用户消息 */}
        <div>
          <Tag color="green" style={{ marginBottom: '4px' }}>user</Tag>
          <div style={{ 
            background: 'var(--custom-bg-secondary)', 
            padding: '8px 12px', 
            borderRadius: '6px',
            fontSize: '12px'
          }}>
            {currentMessage?.content || '(当前消息)'}
          </div>
        </div>
      </>
    );
  };

  // 渲染隔离模式的消息
  const renderIsolationMode = () => {
    const historyMessages = visibleMessages.slice(0, -1);
    const currentMessage = visibleMessages[visibleMessages.length - 1];
    
    // 根据 splitToolCalls 和 toolCallContextRounds 处理消息
    const processedMessages: Array<{
      role: string;
      content: string;
      toolCalls?: any[];
      isToolResult?: boolean;
      dimmed?: boolean;
    }> = [];
    
    let toolCallRounds = 0;
    
    historyMessages.forEach((msg) => {
      if (msg.role === 'user') {
        processedMessages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'agent') {
        if (settings.splitToolCalls && msg.toolCalls) {
          // 拆分模式
          toolCallRounds++;
          const dimmed = toolCallRounds > settings.toolCallContextRounds;
          
          processedMessages.push({ 
            role: 'assistant', 
            content: msg.content,
            toolCalls: msg.toolCalls,
            dimmed
          });
          
          msg.toolCalls.forEach(tc => {
            processedMessages.push({ 
              role: 'tool', 
              content: formatToolResult(tc.result),
              isToolResult: true,
              dimmed
            });
          });
          
          if (msg.contentAfterTool) {
            processedMessages.push({ 
              role: 'assistant', 
              content: msg.contentAfterTool,
              dimmed
            });
          }
        } else {
          // 不拆分模式
          let content = msg.content;
          if (msg.toolCalls) {
            msg.toolCalls.forEach(tc => {
              content += `\n[工具调用结果 - ${tc.name}]: ${formatToolResult(tc.result)}`;
            });
          }
          if (msg.contentAfterTool) {
            content += '\n' + msg.contentAfterTool;
          }
          processedMessages.push({ role: 'assistant', content });
        }
      }
    });
    
    return (
      <>
        {/* System */}
        <div style={{ marginBottom: '8px' }}>
          <Tag color="blue" style={{ marginBottom: '4px' }}>system</Tag>
          <div style={{ 
            background: 'var(--custom-bg-secondary)', 
            padding: '6px 10px', 
            borderRadius: '4px',
            fontSize: '11px',
            color: 'var(--custom-text-secondary)',
            maxHeight: '40px',
            overflow: 'hidden'
          }}>
            {systemPrompt.substring(0, 60)}...
          </div>
        </div>

        {/* Messages */}
        <div style={{ 
          maxHeight: '300px', 
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          {hiddenCount > 0 && (
            <div style={{ 
              textAlign: 'center', 
              color: 'var(--custom-text-tertiary)',
              fontSize: '11px',
              padding: '4px'
            }}>
              ... {hiddenCount}条消息已截断 ...
            </div>
          )}
          
          {processedMessages.map((msg, idx) => (
            <div key={idx} style={{ opacity: msg.dimmed ? 0.4 : 1 }}>
              <Tag 
                color={
                  msg.role === 'user' ? 'green' : 
                  msg.role === 'tool' ? 'purple' : 
                  'cyan'
                }
                style={{ fontSize: '10px', marginBottom: '2px' }}
              >
                {msg.role}
                {msg.toolCalls && ' + tool_calls'}
                {msg.dimmed && (
                  <Tooltip title={`超出 tool_call_context_rounds(${settings.toolCallContextRounds}) 限制`}>
                    <span style={{ marginLeft: '4px', color: '#faad14' }}>⚠</span>
                  </Tooltip>
                )}
              </Tag>
              <div style={{ 
                background: msg.isToolResult ? 'var(--custom-bg-tertiary)' : 'var(--custom-bg-secondary)', 
                padding: '4px 8px', 
                borderRadius: '4px',
                fontSize: '11px',
                color: 'var(--custom-text-secondary)',
                fontFamily: msg.isToolResult ? 'monospace' : 'inherit',
                maxHeight: '60px',
                overflow: 'hidden'
              }}>
                {msg.content.substring(0, 150)}{msg.content.length > 150 ? '...' : ''}
              </div>
            </div>
          ))}
          
          {/* 当前消息 */}
          <div>
            <Tag color="green" style={{ fontSize: '10px', marginBottom: '2px' }}>user</Tag>
            <div style={{ 
              background: 'var(--custom-bg-secondary)', 
              padding: '4px 8px', 
              borderRadius: '4px',
              fontSize: '11px',
              border: `1px solid ${color}`
            }}>
              {currentMessage?.content || '(当前消息)'}
            </div>
          </div>
        </div>
      </>
    );
  };

  // 计算 Token 估算
  const calculateTokenEstimate = () => {
    let totalText = systemPrompt;
    visibleMessages.forEach(msg => {
      totalText += msg.content;
      if (msg.toolCalls) {
        msg.toolCalls.forEach(tc => {
          totalText += formatToolResult(tc.result);
        });
      }
      if (msg.contentAfterTool) {
        totalText += msg.contentAfterTool;
      }
    });
    return estimateTokens(totalText);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {mode === 'default' ? renderDefaultMode() : renderIsolationMode()}
      </div>
      
      {/* Token 估算 */}
      <div style={{ 
        marginTop: '12px', 
        padding: '8px 12px', 
        background: 'var(--custom-bg-tertiary)',
        borderRadius: '6px',
        fontSize: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Token 估算</span>
        <Tag color={color}>~{calculateTokenEstimate().toLocaleString()}</Tag>
      </div>
    </div>
  );
};

export default MessagePreview;
