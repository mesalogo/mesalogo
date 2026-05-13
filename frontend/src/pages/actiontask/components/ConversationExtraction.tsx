import React, { useEffect, useMemo, useState } from 'react';
import { Card, Typography, Tag, Collapse, Space, Modal, Button, Tooltip, App } from 'antd';
import {
  ToolOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  DownOutlined,
  RightOutlined,
  CodeOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  SearchOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  BulbOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  UndoOutlined,
  DownloadOutlined,
  CopyOutlined
} from '@ant-design/icons';
import ReactJson from 'react-json-view';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import capabilityAPI from '../../../services/api/capability';
import SubAgentResultCard from './SubAgentResultCard';
// 导入对话样式
import '../css/conversation.css';
// 导入 Markdown 渲染器样式
import '../css/markdown-renderer.css';

const { Text, Paragraph } = Typography;

// 模块级缓存：避免每个 ConversationExtraction 实例都发起 API 请求
let _capabilityToolsCache: any = null;
let _capabilityToolsFetchPromise: Promise<any> | null = null;

async function getCapabilityToolsCached() {
  if (_capabilityToolsCache) return _capabilityToolsCache;
  if (_capabilityToolsFetchPromise) return _capabilityToolsFetchPromise;
  _capabilityToolsFetchPromise = capabilityAPI.getTools()
    .then(response => {
      _capabilityToolsCache = response || {};
      _capabilityToolsFetchPromise = null;
      // 5分钟后过期，允许刷新
      setTimeout(() => { _capabilityToolsCache = null; }, 5 * 60 * 1000);
      return _capabilityToolsCache;
    })
    .catch(error => {
      console.error('获取能力工具关联关系失败:', error);
      _capabilityToolsFetchPromise = null;
      return {};
    });
  return _capabilityToolsFetchPromise;
}


/**
 * 解析思考标签内容，保留原始位置信息
 * @param {string} text 消息内容
 * @returns {Object} 解析后的段落数组，包含普通文本和思考内容
 */
const parseThinking = (text) => {
  if (!text) return { segments: [] };

  try {
    // 定义思考标记的正则表达式
    const thinkingPatterns = [
      { pattern: /<think>([\s\S]*?)<\/think>/g, type: 'think' },
      { pattern: /<thinking>([\s\S]*?)<\/thinking>/g, type: 'thinking' },
      { pattern: /<observing>([\s\S]*?)<\/observing>/g, type: 'observing' }
    ];

    // 存储所有匹配的标签及其位置
    const matches = [];

    // 查找所有思考标签及其位置
    thinkingPatterns.forEach(({ pattern, type }) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        matches.push({
          type: 'thinking',
          subtype: type,
          content: match[1].trim(),
          startPos: match.index,
          endPos: match.index + match[0].length,
          fullMatch: match[0]
        });
      }
    });

    // 检查是否有未闭合的思考标签（流式状态下可能出现）
    thinkingPatterns.forEach(({ type }) => {
      // 修改正则表达式，匹配未闭合的标签
      const unclosedPattern = new RegExp(`<${type}>([\\\s\\\S]*?)(?=<\\/${type}>|$)`, 'g');
      let match;

      while ((match = unclosedPattern.exec(text)) !== null) {
        // 检查是否已经有完整标签匹配了这部分内容
        const isAlreadyMatched = matches.some(m =>
          m.startPos <= match.index && m.endPos >= match.index + match[0].length
        );

        // 如果没有被完整标签匹配，且不是空内容，则添加为思考内容
        if (!isAlreadyMatched && match[1].trim()) {
          matches.push({
            type: 'thinking',
            subtype: type,
            content: match[1].trim(),
            startPos: match.index,
            endPos: match.index + match[0].length,
            fullMatch: match[0],
            isUnclosed: true
          });
        }
      }
    });

    // 如果没有找到思考标签，直接返回原文本
    if (matches.length === 0) {
      return {
        segments: [{ type: 'text', content: text }]
      };
    }

    // 按照位置排序匹配结果
    matches.sort((a, b) => a.startPos - b.startPos);

    // 构建段落数组，保留原始顺序
    const segments = [];
    let currentPos = 0;

    matches.forEach(match => {
      // 添加匹配前的文本
      if (match.startPos > currentPos) {
        const textBefore = text.substring(currentPos, match.startPos);
        if (textBefore.trim()) {
          segments.push({
            type: 'text',
            content: textBefore
          });
        }
      }

      // 添加思考内容
      segments.push({
        type: 'thinking',
        subtype: match.subtype,
        content: match.content,
        isUnclosed: match.isUnclosed
      });

      // 更新当前位置
      currentPos = match.endPos;
    });

    // 添加最后一个匹配后的文本
    if (currentPos < text.length) {
      const textAfter = text.substring(currentPos);
      if (textAfter.trim()) {
        segments.push({
          type: 'text',
          content: textAfter
        });
      }
    }

    return { segments };
  } catch (error) {
    console.error('思考内容解析失败:', error);
    // 发生错误时，将所有内容作为普通文本返回
    return {
      segments: [{ type: 'text', content: text }]
    };
  }
};

/**
 * HTML转义函数，防止XSS攻击
 */
const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

/**
 * Mermaid图表渲染组件 - 使用iframe隔离渲染
 * 类似GitHub的viewscreen-mermaid实现方式
 */
const MermaidRenderer = ({ chart }: { chart: string }) => {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = React.useState(200);
  const [svg, setSvg] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const [lastRenderedChart, setLastRenderedChart] = React.useState('');
  const { message } = App.useApp();
  
  // 为每个实例生成唯一ID，用于区分不同的mermaid渲染器
  const [instanceId] = React.useState(() => `mermaid-${Math.random().toString(36).substring(2, 10)}`);

  // 检查图表内容是否看起来完整
  const isChartComplete = React.useCallback((chartContent: string) => {
    if (!chartContent || chartContent.trim() === '') return false;

    const trimmed = chartContent.trim();

    // 检查是否有基本的mermaid语法结构
    const hasValidStart = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gitgraph|pie|gantt|mindmap|timeline|quadrantChart|requirement|c4Context|xychart|block|sankey|packet|architecture)/i.test(trimmed);

    if (!hasValidStart) return false;

    // 检查是否有未闭合的引号（只检查双引号，因为单引号在mermaid中不常用）
    const doubleQuotes = (trimmed.match(/"/g) || []).length;
    
    // 检查方括号是否配对
    const openBrackets = (trimmed.match(/\[/g) || []).length;
    const closeBrackets = (trimmed.match(/\]/g) || []).length;
    
    // 检查圆括号是否配对
    const openParens = (trimmed.match(/\(/g) || []).length;
    const closeParens = (trimmed.match(/\)/g) || []).length;
    
    // 检查花括号是否配对
    const openBraces = (trimmed.match(/\{/g) || []).length;
    const closeBraces = (trimmed.match(/\}/g) || []).length;

    // 基本的平衡检查 - 放宽条件，只要不是明显不完整就认为完整
    const isBalanced = (doubleQuotes % 2 === 0) &&
                      (openBrackets >= closeBrackets - 1 && openBrackets <= closeBrackets + 1) &&
                      (openParens >= closeParens - 1 && openParens <= closeParens + 1) &&
                      (openBraces >= closeBraces - 1 && openBraces <= closeBraces + 1);

    // 如果内容超过一定长度且有换行，认为可能是完整的
    const hasMultipleLines = trimmed.includes('\n');
    const isLongEnough = trimmed.length > 20;

    return isBalanced || (hasMultipleLines && isLongEnough);
  }, []);

  // 导出SVG功能
  const handleExportSVG = React.useCallback(() => {
    if (!svg) return;
    
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mermaid-diagram-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('SVG导出成功');
  }, [svg, message]);

  // 复制代码功能
  const handleCopyCode = React.useCallback(() => {
    if (!chart) return;
    
    navigator.clipboard.writeText(chart).then(() => {
      message.success('Mermaid代码已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  }, [chart, message]);

  // 查看代码状态
  const [showCode, setShowCode] = React.useState(false);

  // 生成iframe内容的HTML - 包含实例ID用于消息识别
  const generateIframeContent = React.useCallback((chartCode: string, id: string) => {
    // 使用转义后的图表代码
    const escapedChart = escapeHtml(chartCode);
    
    return `
<!DOCTYPE html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      background: #fff; 
      overflow: hidden;
      width: 100%;
      height: auto;
    }
    #container {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      width: 100%;
      padding: 8px;
      background: #fff;
    }
    .mermaid {
      width: 100%;
      text-align: center;
    }
    .mermaid svg {
      max-width: 100%;
      height: auto;
    }
    .error {
      color: #ff4d4f;
      padding: 12px;
      background: #fff2f0;
      border: 1px solid #ffccc7;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div id="container">
    <pre class="mermaid">${escapedChart}</pre>
  </div>
  <script>
    const INSTANCE_ID = '${id}';
    
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'strict',
      fontSize: 14,
      logLevel: 'fatal'
    });

    async function render() {
      try {
        const element = document.querySelector('.mermaid');
        const code = element.textContent;
        
        // 解码HTML实体
        const textarea = document.createElement('textarea');
        textarea.innerHTML = code;
        const decodedCode = textarea.value;
        
        const { svg } = await mermaid.render('mermaid-svg', decodedCode);
        element.innerHTML = svg;
        
        // 发送渲染成功消息和SVG内容，包含实例ID
        const height = document.body.scrollHeight;
        window.parent.postMessage({ 
          type: 'mermaid-rendered',
          instanceId: INSTANCE_ID,
          height: height,
          svg: svg
        }, '*');
      } catch (err) {
        const container = document.getElementById('container');
        container.innerHTML = '<div class="error">' + (err.message || '渲染失败') + '</div>';
        window.parent.postMessage({ 
          type: 'mermaid-error',
          instanceId: INSTANCE_ID,
          error: err.message,
          height: document.body.scrollHeight
        }, '*');
      }
    }

    render();
  </script>
</body>
</html>`;
  }, []);

  // iframe 的 srcdoc 内容
  const [srcdoc, setSrcdoc] = React.useState<string>('');
  
  // 是否已经成功渲染过（用于防止闪烁）
  const [hasRendered, setHasRendered] = React.useState(false);

  // 监听iframe消息 - 只处理属于当前实例的消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 只处理属于当前实例的消息
      if (event.data?.instanceId !== instanceId) return;
      
      if (event.data?.type === 'mermaid-rendered') {
        setIframeHeight(Math.max(event.data.height + 10, 100));
        setSvg(event.data.svg || '');
        setError(null);
        setHasRendered(true);
      } else if (event.data?.type === 'mermaid-error') {
        setIframeHeight(Math.max(event.data.height + 10, 80));
        setError(event.data.error);
        setSvg('');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [instanceId]);

  // 渲染图表到iframe - 内容变化时渲染，让mermaid自己处理错误
  useEffect(() => {
    if (!chart) return;
    
    // 如果内容与上次渲染的内容相同，跳过渲染
    if (chart === lastRenderedChart) return;

    // 清除错误状态
    setError(null);

    // 添加防抖，避免流式输出时频繁渲染
    const debounceTimer = setTimeout(() => {
      const htmlContent = generateIframeContent(chart, instanceId);
      setSrcdoc(htmlContent);
      setLastRenderedChart(chart);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [chart, lastRenderedChart, generateIframeContent, instanceId]);

  // 处理点击事件
  const handleClick = React.useCallback(() => {
    if (svg) {
      setIsModalVisible(true);
    }
  }, [svg]);

  return (
    <>
      <div 
        className="mermaid-diagram"
        onClick={handleClick}
        style={{ 
          border: '1px solid var(--custom-border)',
          borderRadius: '6px',
          overflow: 'hidden',
          backgroundColor: 'var(--custom-card-bg)',
          position: 'relative',
          cursor: svg ? 'pointer' : 'default'
        }}
        title={svg ? "点击查看大图" : undefined}
      >
        <iframe
          ref={iframeRef}
          srcDoc={srcdoc}
          sandbox="allow-scripts"
          style={{
            width: '100%',
            height: iframeHeight,
            border: 'none',
            display: 'block',
            backgroundColor: 'transparent',
            pointerEvents: 'none'
          }}
          title="Mermaid Diagram"
        />
      </div>
      
      {/* 放大查看Modal */}
      <Modal
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width="90%"
        centered
        style={{ maxWidth: '1200px' }}
      >
        {showCode ? (
          /* 代码视图 - 不使用缩放 */
          <>
            <div style={{
              position: 'absolute',
              bottom: '10px',
              right: '10px',
              zIndex: 1000,
              display: 'flex',
              gap: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              padding: '8px',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}>
              <Tooltip title="查看图表">
                <Button icon={<CodeOutlined />} onClick={() => setShowCode(false)} />
              </Tooltip>
              <Tooltip title="复制代码">
                <Button icon={<CopyOutlined />} onClick={handleCopyCode} />
              </Tooltip>
            </div>
            <div style={{
              padding: '16px',
              backgroundColor: '#282c34',
              fontFamily: 'monospace',
              fontSize: '14px',
              whiteSpace: 'pre-wrap',
              height: '80vh',
              overflowY: 'auto',
              overflowX: 'auto',
              textAlign: 'left',
              color: '#abb2bf',
              borderRadius: '6px'
            }}>
              {chart}
            </div>
          </>
        ) : (
          /* 图表视图 - 使用缩放 */
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={10}
            centerOnInit={true}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  zIndex: 1000,
                  display: 'flex',
                  gap: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  padding: '8px',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}>
                  <Tooltip title="放大">
                    <Button icon={<ZoomInOutlined />} onClick={() => zoomIn()} />
                  </Tooltip>
                  <Tooltip title="缩小">
                    <Button icon={<ZoomOutOutlined />} onClick={() => zoomOut()} />
                  </Tooltip>
                  <Tooltip title="重置">
                    <Button icon={<UndoOutlined />} onClick={() => resetTransform()} />
                  </Tooltip>
                  <Tooltip title="查看代码">
                    <Button icon={<CodeOutlined />} onClick={() => setShowCode(true)} />
                  </Tooltip>
                  <Tooltip title="复制代码">
                    <Button icon={<CopyOutlined />} onClick={handleCopyCode} />
                  </Tooltip>
                  <Tooltip title="导出SVG">
                    <Button icon={<DownloadOutlined />} onClick={handleExportSVG} />
                  </Tooltip>
                </div>
                <TransformComponent
                  wrapperStyle={{
                    width: '100%',
                    height: '80vh',
                    cursor: 'grab'
                  }}
                  contentStyle={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '20px'
                  }}
                >
                  <div dangerouslySetInnerHTML={{ __html: svg }} />
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        )}
      </Modal>
    </>
  );
};

/**
 * 通用Markdown渲染组件
 * 用于统一渲染Markdown内容，支持代码高亮、数学公式、mermaid图表等
 * @param {Object} props - 组件属性
 * @param {string} props.content - Markdown内容
 * @param {boolean} props.showLineNumbers - 是否显示代码行号，默认为true
 * @returns {JSX.Element} 渲染后的Markdown内容
 */
export const MarkdownRenderer = ({ content, showLineNumbers = true }) => {
  // 使用useMemo检测并处理LaTeX公式，防止流式输出时重复渲染
  const { processedContent, hasIncompleteMath } = React.useMemo(() => {
    if (!content) return { processedContent: '', hasIncompleteMath: false };
    
    // 统计LaTeX分隔符是否配对
    const dollarSigns = (content.match(/\$/g) || []).length;
    const doubleDollarSigns = (content.match(/\$\$/g) || []).length;
    
    // 计算单个$符号的数量（排除$$）
    const singleDollarCount = dollarSigns - doubleDollarSigns * 2;
    
    // 如果单个$符号数量为奇数，说明有未闭合的行内公式
    const hasIncompleteMath = singleDollarCount % 2 !== 0;
    
    // 如果有不完整的公式，临时禁用LaTeX渲染，显示原始文本
    return { 
      processedContent: content,
      hasIncompleteMath 
    };
  }, [content]);

  if (!processedContent) return null;

  return (
    <div className="markdown-renderer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, hasIncompleteMath ? undefined : remarkMath].filter(Boolean)}
        rehypePlugins={[hasIncompleteMath ? undefined : rehypeKatex, rehypeRaw].filter(Boolean)}
        components={{
          code({node, inline, className, children, ...props}: any) {
            const match = /language-(\w+)/.exec(className || '');

            // 处理行内代码
            if (inline) {
              return <code className={className} {...props}>{children}</code>;
            }

            // 获取代码内容
            const codeContent = String(children).replace(/\n$/, '');

            // 处理mermaid图表
            if (match && match[1] === 'mermaid') {
              // 直接渲染mermaid图表，不进行语法验证
              const trimmedCode = codeContent.trim();

              // 直接使用MermaidRenderer渲染，让它内部处理错误
              return <MermaidRenderer chart={trimmedCode} />;
            }

            // 处理普通代码块
            return match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                showLineNumbers={showLineNumbers}
                {...props}
              >
                {codeContent}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

/**
 * 渲染思考内容的组件
 */
export const ThinkingContentRenderer = ({ thinkingContent, isUnclosed }) => {
  // 确保thinkingContent存在且为字符串
  if (!thinkingContent || typeof thinkingContent !== 'string' || thinkingContent.trim() === '') {
    return null;
  }

  // 移除标签并清理内容
  const cleanedContent = thinkingContent
    .replace(/<\/?think>/g, '')
    .replace(/<\/?thinking>/g, '')
    .replace(/<\/?observing>/g, '')
    .trim();

  // 如果清理后内容为空，不渲染
  if (!cleanedContent) {
    return null;
  }

  return (
    <div style={{ marginBottom: '8px' }}>
      <Collapse
        ghost
       
        defaultActiveKey={isUnclosed ? ['1'] : []} // 如果是未闭合的标签（流式状态），默认展开
        items={[
          {
            key: '1',
            label: (
              <Text type="secondary">
                <BulbOutlined style={{ marginRight: '5px' }} />
                查看思考过程 {isUnclosed && <Tag color="grey">思考中</Tag>}
              </Text>
            ),
            children: (
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: '12px',
                  padding: '12px',
                  backgroundColor: 'var(--custom-hover-bg)',
                  borderRadius: '6px',
                  border: '1px solid var(--custom-border)',
                  overflowY: 'auto'
                }}
              >
                {cleanedContent}
              </div>
            )
          }
        ]}
      />
    </div>
  );
};

/**
 * 内容渲染组件
 * 用于解析和展示会话中的各种内容，包括普通文本、工具调用和思考内容
 * 作为所有消息内容渲染的中心组件
 */
function ConversationExtraction({
  content,
  messageThinking,
  isToolCallOnly = false,
  message = null,
  task = null
}: any) {
  // 能力-工具映射数据（使用模块级缓存，避免每个实例重复请求）
  const [capabilityToolsMap, setCapabilityToolsMap] = useState(_capabilityToolsCache || {});

  useEffect(() => {
    let cancelled = false;
    if (!_capabilityToolsCache) {
      getCapabilityToolsCached().then(data => {
        if (!cancelled) setCapabilityToolsMap(data);
      });
    }
    return () => { cancelled = true; };
  }, []);

  // 处理消息内容
  const { displayContent, thinkingContent, imageContent } = useMemo(() => {
    // 如果提供了完整的message对象，优先从message中提取内容
    let rawContent = message ? message.content : content;
    let thinkingContent = message ? message.thinking : messageThinking;
    let displayContent = '';
    let imageContent = [];

    // 处理多模态内容
    if (Array.isArray(rawContent)) {
      // 多模态消息：提取文本和图像
      rawContent.forEach(item => {
        if (item.type === 'text') {
          displayContent += item.text || '';
        } else if (item.type === 'image') {
          imageContent.push(item);
        }
      });
    } else {
      // 纯文本消息
      displayContent = rawContent || '';
    }

    // 如果有单独的thinking字段，确保格式正确
    if (thinkingContent && typeof thinkingContent === 'string' &&
        !thinkingContent.includes('<think>') &&
        !thinkingContent.includes('<thinking>') &&
        !thinkingContent.includes('<observing>')) {
      thinkingContent = `<think>\n${thinkingContent}\n</think>`;
    }

    return {
      displayContent: displayContent || '',
      thinkingContent,
      imageContent
    };
  }, [content, messageThinking, message]);

  // 使用新的解析器处理思考内容和工具调用

  // 解析工具调用和结果，并保留原始位置信息
  const parseToolCalls = (text) => {
    if (!text) return { segments: [] };

    // 存储工具调用ID与索引的映射，用于关联调用和结果
    const toolCallIdMap = {};

    try {
      // 查找所有可能的JSON对象
      const jsonSegments = [];
      let currentText = '';
      let currentPos = 0;

      while (currentPos < text.length) {
        const startPos = text.indexOf('{"content":', currentPos);

        // 如果找不到更多的JSON对象，将剩余文本作为普通内容添加
        if (startPos === -1) {
          if (currentPos < text.length) {
            currentText += text.substring(currentPos);
          }
          break;
        }

        // 将JSON前的文本作为普通内容添加
        if (startPos > currentPos) {
          currentText += text.substring(currentPos, startPos);
        }

        // 查找匹配的JSON结束位置
        let endPos = startPos;
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = startPos; i < text.length; i++) {
          const char = text[i];

          if (escapeNext) {
            escapeNext = false;
            continue;
          }

          if (char === '\\') {
            escapeNext = true;
            continue;
          }

          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }

          if (!inString) {
            if (char === '{') braceCount++;
            if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                endPos = i + 1;
                break;
              }
            }
          }
        }

        // 如果找到完整的JSON
        if (endPos > startPos) {
          const jsonStr = text.substring(startPos, endPos);

          try {
            // 尝试解析JSON，如果失败则作为普通文本处理
            let jsonObj;
            try {
              jsonObj = JSON.parse(jsonStr);
            } catch (parseError) {
              // 记录警告而不是错误，避免控制台出现大量错误信息
              console.warn('JSON解析失败:', parseError);
              // 将JSON字符串作为普通文本添加
              currentText += jsonStr;
              currentPos = endPos;
              continue;
            }

            // 检查是否为空白内容的JSON，如果是则跳过
            if (jsonObj.content && jsonObj.content.trim() === "" && !jsonObj.meta) {
              // 跳过空白内容的JSON
              currentPos = endPos;
              continue;
            }

            // 如果当前累积的文本不为空，添加为文本段
            if (currentText.trim() !== '') {
              jsonSegments.push({
                type: 'text',
                content: currentText.trim()
              });
              currentText = '';
            }

            // 解析工具调用
            if (jsonObj.meta) {
              // 处理工具调用动作 - ToolCallAction
              if (jsonObj.meta.ToolCallAction) {
                const actionData = jsonObj.meta.ToolCallAction;
                const toolCallId = jsonObj.meta.toolCallId || '';

                // 创建工具调用对象
                const toolCall = {
                  type: 'toolCall',
                  subtype: 'action',
                  function: actionData.Function,
                  arguments: actionData.Arguments,
                  toolCallId: toolCallId,
                  result: null,
                  // 存储原始JSON对象
                  rawJson: jsonObj
                };

                // 记录到段落集合中
                const index = jsonSegments.length;
                jsonSegments.push(toolCall);

                // 记录工具调用ID映射
                if (toolCallId) {
                  toolCallIdMap[toolCallId] = index;
                }
              }
              // 处理工具调用结果 - ToolCallResult 或 role:tool 格式
              else if (jsonObj.meta.ToolCallResult || (jsonObj.meta.type === 'toolResult' && jsonObj.meta.role === 'tool')) {
                // 支持两种格式：旧的ToolCallResult格式和新的role:tool格式
                let resultContent, toolName, toolCallId, status, toolParameter;

                if (jsonObj.meta.ToolCallResult) {
                  // 旧格式
                  resultContent = jsonObj.meta.ToolCallResult;
                  toolName = jsonObj.meta.toolName || '';
                  toolCallId = jsonObj.meta.toolCallId || '';
                  status = jsonObj.meta.status || 'success';
                  toolParameter = jsonObj.meta.toolParameter || '{}';
                } else {
                  // 新的role:tool格式
                  resultContent = jsonObj.meta.content;
                  toolName = jsonObj.meta.tool_name || '';
                  toolCallId = jsonObj.meta.tool_call_id || '';
                  status = jsonObj.meta.status || 'success'; // 读取status字段，默认成功状态
                  toolParameter = jsonObj.meta.tool_parameter || '{}';
                }

                // 创建结果对象
                const resultObj = {
                  content: resultContent,
                  toolName: toolName,
                  status: status,
                  // 存储原始JSON对象
                  rawJson: jsonObj
                };

                // 如果有对应的工具调用，将结果添加到该工具调用中
                if (toolCallId && toolCallIdMap[toolCallId] !== undefined) {
                  const index = toolCallIdMap[toolCallId];
                  jsonSegments[index].result = resultObj;
                  jsonSegments[index].status = status; // 更新状态到对应的工具调用中
                } else {
                  // 如果没有找到对应的工具调用，创建一个新的工具调用对象并添加到段落集合
                  // 标记为自动创建的，以便在渲染时可以区别处理
                  // 使用toolParameter作为arguments
                  let toolArguments = {};
                  try {
                    // 尝试解析工具参数
                    if (typeof toolParameter === 'string') {
                      // 如果是字符串，尝试解析JSON
                      if (toolParameter.trim() === '' || toolParameter === '{}') {
                        // 空字符串或空对象，使用默认空对象
                        toolArguments = {};
                      } else {
                        // 尝试解析JSON字符串
                        toolArguments = JSON.parse(toolParameter);
                      }
                    } else if (typeof toolParameter === 'object' && toolParameter !== null) {
                      // 如果已经是对象，直接使用
                      toolArguments = toolParameter;
                    } else {
                      // 其他情况使用空对象
                      toolArguments = {};
                    }
                  } catch (e) {
                    // 解析失败时，不输出详细的参数内容到控制台，避免泄露敏感信息
                    console.warn('工具参数解析失败:', e.message);

                    // 对于解析失败的情况，尝试更智能的处理
                    if (typeof toolParameter === 'string') {
                      // 如果是字符串但不是有效JSON，可能是已经序列化的参数
                      // 尝试将其作为单个参数值处理
                      try {
                        // 检查是否是双重编码的JSON字符串
                        const unescaped = toolParameter.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                        toolArguments = JSON.parse(unescaped);
                      } catch (secondError) {
                        // 如果仍然失败，将原始字符串作为value参数
                        toolArguments = {
                          value: toolParameter,
                          _parse_note: "原始参数无法解析为JSON，已作为字符串值处理"
                        };
                      }
                    } else {
                      // 其他类型的参数
                      toolArguments = {
                        raw_parameter: toolParameter,
                        parse_error: e.message
                      };
                    }
                  }

                  jsonSegments.push({
                    type: 'toolCall',
                    subtype: 'action',
                    function: toolName || 'unknown',
                    arguments: toolArguments,
                    toolCallId: toolCallId,
                    status: status, // 设置工具调用状态
                    result: resultObj,
                    isAutoCreated: true // 标记为自动创建的工具调用
                  });
                }
              }
              // 处理其他类型的元数据 (如果需要)
              else if (jsonObj.content) {
                // 如果有常规内容，添加为文本段
                if (jsonObj.content.trim() !== '') {
                  jsonSegments.push({
                    type: 'text',
                    content: jsonObj.content.trim()
                  });
                }
              }
            } else if (jsonObj.content) {
              // 如果只有常规内容，添加为文本段
              if (jsonObj.content.trim() !== '') {
                jsonSegments.push({
                  type: 'text',
                  content: jsonObj.content.trim()
                });
              }
            }
          } catch (e) {
            console.error('JSON解析失败:', e);
            // 如果解析失败，将该JSON字符串作为普通文本添加
            currentText += jsonStr;
          }

          currentPos = endPos;
        } else {
          // 如果无法找到完整的JSON，将剩余文本作为普通内容添加
          currentText += text.substring(currentPos);
          break;
        }
      }

      // 处理最后可能剩余的文本
      if (currentText.trim() !== '') {
        jsonSegments.push({
          type: 'text',
          content: currentText.trim()
        });
      }

      // 合并相邻的文本段，避免出现多个分散的文本块
      const mergedSegments = [];
      let currentTextSegment = null;

      for (const segment of jsonSegments) {
        if (segment.type === 'text') {
          if (currentTextSegment) {
            currentTextSegment.content += '\n\n' + segment.content;
          } else {
            currentTextSegment = { ...segment };
            mergedSegments.push(currentTextSegment);
          }
        } else {
          currentTextSegment = null;
          mergedSegments.push(segment);
        }
      }

      // 移除所有HTML注释
      mergedSegments.forEach(segment => {
        if (segment.type === 'text') {
          // 移除所有HTML注释
          segment.content = segment.content.replace(/<!-- .*? -->/g, '').trim();
        }
      });

      // 过滤掉空文本段
      return {
        segments: mergedSegments.filter(segment =>
          segment.type !== 'text' || segment.content.trim() !== ''
        )
      };
    } catch (error) {
      console.error('工具调用解析失败:', error);
      // 发生错误时，将所有内容作为普通文本返回
      return {
        segments: [{ type: 'text', content: text }]
      };
    }
  };

  // 获取工具图标
  const getToolIcon = (toolName) => {
    const toolIcons = {
      'sequentialthinking': <ThunderboltOutlined />,
      'search_web': <SearchOutlined />,
      'web_search': <SearchOutlined />,
      'web_fetch': <GlobalOutlined />,
      'get_agent_var': <DatabaseOutlined />,
      'set_agent_var': <DatabaseOutlined />,
      'code': <CodeOutlined />,
      'api': <ApiOutlined />,
      'default': <ToolOutlined />
    };

    return toolIcons[toolName] || toolIcons.default;
  };

  // 获取工具所属的能力标签
  const getToolCapabilityTags = (toolName) => {
    const capabilityColors = ['blue', 'cyan', 'green', 'orange', 'purple', 'magenta', 'geekblue'];
    const capabilitiesSet = new Set();

    // 遍历能力-工具映射，查找包含当前工具的能力
    Object.entries(capabilityToolsMap).forEach(([capabilityName, serversData]) => {
      if (serversData && typeof serversData === 'object') {
        // 遍历所有服务器类型，检查是否包含该工具
        const hasToolInAnyServer = Object.values(serversData).some(
          toolsList => Array.isArray(toolsList) && toolsList.includes(toolName)
        );
        if (hasToolInAnyServer) {
          capabilitiesSet.add(capabilityName);
        }
      }
    });

    // 如果找到能力，返回标签
    if (capabilitiesSet.size > 0) {
      return Array.from(capabilitiesSet).map((capName, index) => (
        <Tag 
          key={String(capName)} 
          color={capabilityColors[index % capabilityColors.length]} 
         
        >
          {String(capName)}
        </Tag>
      ));
    }

    // 如果没有找到能力，返回默认标签
    return <Tag color="default">工具调用</Tag>;
  };

  // 渲染文本内容
  const renderTextContent = (segment, index) => {
    if (segment.type === 'text') {
      // 不再尝试自动检测和修复代码块外的Mermaid内容
      // 只渲染Markdown内容，由Markdown组件中的代码块处理器处理完整的mermaid标签

      return (
        <div key={`text-${index}`} className="text-content" style={{
          marginBottom: '12px',
          width: '100%', // 确保文本内容宽度与父容器一致
          maxWidth: '100%', // 确保不超过父容器宽度
          overflowX: 'auto', // 添加水平滚动以防内容溢出
          wordBreak: 'break-word', // 确保长单词可以换行
          overflowWrap: 'break-word' // 确保长单词可以换行
        }}>
          <MarkdownRenderer content={segment.content} />
        </div>
      );
    }
    return null;
  };

  // 渲染思考内容段落
  const renderThinkingSegment = (segment, index) => {
    if (segment.type === 'thinking') {
      return <ThinkingContentRenderer
        key={`thinking-${index}`}
        thinkingContent={segment.content}
        isUnclosed={segment.isUnclosed}
      />;
    }
    return null;
  };

  // SubAgent 工具名称集合
  const SUBAGENT_TOOL_NAMES = new Set(['invoke_agent', 'invoke_agents', 'list_available_agents']);

  // 渲染工具调用卡片
  const renderToolCallCard = (toolCall, index) => {
    // 只处理toolCall类型的段落
    if (toolCall.type === 'toolCall' && toolCall.subtype === 'action') {

      // 🔗 SubAgent 工具特殊渲染
      if (SUBAGENT_TOOL_NAMES.has(toolCall.function)) {
        return (
          <div key={`subagent-${index}`} style={{ marginBottom: '12px' }}>
            <SubAgentResultCard
              toolName={toolCall.function}
              toolArguments={toolCall.arguments}
              toolResult={toolCall.result?.content || toolCall.result?.rawJson}
              status={toolCall.result?.status}
            />
          </div>
        );
      }

      // 检查是否有结果
      const hasResult = toolCall.result !== null;

      // 获取状态标签
      let statusTag = <Tag color="processing">处理中...</Tag>;

      if (hasResult) {
        // 只使用status字段判断结果状态
        const status = toolCall.result.status || 'success';
        if (status === 'error') {
          statusTag = <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>;
        } else if (status === 'warning') {
          statusTag = <Tag icon={<WarningOutlined />} color="warning">警告</Tag>;
        } else {
          statusTag = <Tag icon={<CheckCircleOutlined />} color="success">成功</Tag>;
        }
      }

      return (
        <div key={`tool-${index}`} style={{ marginBottom: '12px' }}>
          <Collapse
            expandIcon={({ isActive }) => isActive ? <DownOutlined /> : <RightOutlined />}
            defaultActiveKey={[]} // 默认闭合
           
            items={[
              {
                key: '1',
                label: (
                  <Space>
                    {getToolIcon(toolCall.function)}
                    <Text strong>{toolCall.function}</Text>
                    {getToolCapabilityTags(toolCall.function)}
                    {statusTag}
                  </Space>
                ),
                children: hasResult ? (
                  <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                    {/* 显示完整的ToolCallResult内容 */}
                    {toolCall.result.rawJson ? (
                      <ReactJson
                        src={toolCall.result.rawJson}
                        theme="chalk"
                        displayDataTypes={false}
                        collapsed={2}
                      />
                    ) : (
                      typeof toolCall.result.content === 'string' ? (
                        <div className="tool-result-content">
                          <MarkdownRenderer
                            content={toolCall.result.content}
                            showLineNumbers={false}
                          />
                        </div>
                      ) : (
                        (() => {
                          try {
                            // 尝试解析JSON，如果失败则显示原始字符串
                            return (
                              <ReactJson
                                src={toolCall.result.content}
                                theme="chalk"
                                displayDataTypes={false}
                                collapsed={1}
                              />
                            );
                          } catch (e) {
                            console.warn('工具调用结果JSON解析失败:', e);
                            // 解析失败时显示警告和原始内容
                            return (
                              <div>
                                <div style={{
                                  padding: '10px',
                                  backgroundColor: '#fffbe6',
                                  border: '1px solid #ffe58f',
                                  borderRadius: '4px',
                                  color: '#874d00',
                                  marginBottom: '10px'
                                }}>
                                  <p>JSON解析警告: {e.message}</p>
                                </div>
                                <pre style={{
                                  maxHeight: '150px',
                                  overflow: 'auto',
                                  padding: '8px',
                                  backgroundColor: 'var(--custom-hover-bg)',
                                  borderRadius: '4px'
                                }}>
                                  {typeof toolCall.result.content === 'string'
                                    ? toolCall.result.content
                                    : JSON.stringify(toolCall.result.content, null, 2)}
                                </pre>
                              </div>
                            );
                          }
                        })()
                      )
                    )}
                  </div>
                ) : (
                  <div>暂无结果</div>
                )
              }
            ]}
          />
        </div>
      );
    }
    return null;
  };

  // 解析内容
  // 先解析思考内容
  const { segments: thinkingSegments } = parseThinking(displayContent || '');

  // 对每个文本段落解析工具调用
  const allSegments = [];

  thinkingSegments.forEach(segment => {
    if (segment.type === 'text') {
      // 对文本段落解析工具调用
      const { segments: toolSegments } = parseToolCalls(segment.content);
      allSegments.push(...toolSegments);
    } else {
      // 保留思考内容段落
      allSegments.push(segment);
    }
  });

  // 如果没有任何段落 (内容为空)
  if (allSegments.length === 0) {
    return null;
  }

  // 检查是否有工具调用 - 通过解析后的段落判断
  const hasToolCall = allSegments.some(segment => segment.type === 'toolCall');

  // 如果只有一个文本段落，且没有工具调用，且指定只处理工具调用，则返回null
  if (isToolCallOnly && !hasToolCall) {
    return null;
  }

  // 渲染图像内容
  const renderImageContent = () => {
    if (!imageContent || imageContent.length === 0) return null;

    return (
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '8px'
        }}>
          {imageContent.map((image, index) => {
            const source = image.source || {};
            const mediaType = source.media_type || 'image/jpeg';
            const data = source.data || '';

            // 构建完整的data URI
            const imageUrl = data.startsWith('data:')
              ? data
              : `data:${mediaType};base64,${data}`;

            return (
              <div key={index} style={{
                border: '1px solid var(--custom-border)',
                borderRadius: '6px',
                overflow: 'hidden',
                maxWidth: '200px',
                backgroundColor: 'var(--custom-header-bg)'
              }}>
                <img
                  src={imageUrl}
                  alt={`上传的图片 ${index + 1}`}
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '150px',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                  onError={(e: any) => {
                    (e.target as HTMLElement).style.display = 'none';
                    (e.target.nextSibling as HTMLElement).style.display = 'block';
                  }}
                />
                <div style={{
                  display: 'none',
                  padding: '20px',
                  textAlign: 'center',
                  color: 'var(--custom-text-secondary)',
                  fontSize: '12px'
                }}>
                  图片加载失败
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 渲染组件 - 包含思考内容和段落内容
  return (
    <div className="conversation-extraction">
      {/* 渲染单独的思考内容（如果存在） */}
      {thinkingContent && typeof thinkingContent === 'string' && thinkingContent.trim() !== '' && (
        <ThinkingContentRenderer
          thinkingContent={thinkingContent}
          isUnclosed={
            (thinkingContent.includes('<thinking>') && !thinkingContent.includes('</thinking>')) ||
            (thinkingContent.includes('<think>') && !thinkingContent.includes('</think>')) ||
            (thinkingContent.includes('<observing>') && !thinkingContent.includes('</observing>'))
          }
        />
      )}

      {/* 渲染图像内容 */}
      {renderImageContent()}

      {/* 渲染所有段落，包括普通文本、思考内容和工具调用 */}
      {allSegments.map((segment, index) => {
        if (segment.type === 'text') {
          return renderTextContent(segment, index);
        } else if (segment.type === 'toolCall') {
          return renderToolCallCard(segment, index);
        } else if (segment.type === 'thinking') {
          return renderThinkingSegment(segment, index);
        }
        return null;
      })}
    </div>
  );
}

export default ConversationExtraction;