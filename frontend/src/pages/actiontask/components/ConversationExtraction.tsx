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
// Import conversation styles
import '../css/conversation.css';
// Import Markdown renderer styles
import '../css/markdown-renderer.css';

const { Text, Paragraph } = Typography;

// Module-level cache to avoid API requests from every ConversationExtraction instance
let _capabilityToolsCache: any = null;
let _capabilityToolsFetchPromise: Promise<any> | null = null;

async function getCapabilityToolsCached() {
  if (_capabilityToolsCache) return _capabilityToolsCache;
  if (_capabilityToolsFetchPromise) return _capabilityToolsFetchPromise;
  _capabilityToolsFetchPromise = capabilityAPI.getTools()
    .then(response => {
      _capabilityToolsCache = response || {};
      _capabilityToolsFetchPromise = null;
      // Expire after 5 minutes to allow refresh
      setTimeout(() => { _capabilityToolsCache = null; }, 5 * 60 * 1000);
      return _capabilityToolsCache;
    })
    .catch(error => {
      console.error('fetch capability-tool mapping failed:', error);
      _capabilityToolsFetchPromise = null;
      return {};
    });
  return _capabilityToolsFetchPromise;
}


/**
 * Parse thinking tags while preserving original positions
 * @param {string} text Message content
 * @returns {Object} Parsed segment array containing text and thinking content
 */
const parseThinking = (text) => {
  if (!text) return { segments: [] };

  try {
    // Define thinking-tag regular expressions
    const thinkingPatterns = [
      { pattern: /<think>([\s\S]*?)<\/think>/g, type: 'think' },
      { pattern: /<thinking>([\s\S]*?)<\/thinking>/g, type: 'thinking' },
      { pattern: /<observing>([\s\S]*?)<\/observing>/g, type: 'observing' }
    ];

    // Store all matched tags and their positions
    const matches = [];

    // Find all thinking tags and positions
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

    // Check unclosed thinking tags that may appear during streaming
    thinkingPatterns.forEach(({ type }) => {
      // Match unclosed tags
      const unclosedPattern = new RegExp(`<${type}>([\\\s\\\S]*?)(?=<\\/${type}>|$)`, 'g');
      let match;

      while ((match = unclosedPattern.exec(text)) !== null) {
        // Check whether this range was already matched by a complete tag
        const isAlreadyMatched = matches.some(m =>
          m.startPos <= match.index && m.endPos >= match.index + match[0].length
        );

        // If not matched by a complete tag and non-empty, add as thinking content
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

    // If no thinking tags are found, return original text
    if (matches.length === 0) {
      return {
        segments: [{ type: 'text', content: text }]
      };
    }

    // Sort matches by position
    matches.sort((a, b) => a.startPos - b.startPos);

    // Build segments while preserving original order
    const segments = [];
    let currentPos = 0;

    matches.forEach(match => {
      // Add text before match
      if (match.startPos > currentPos) {
        const textBefore = text.substring(currentPos, match.startPos);
        if (textBefore.trim()) {
          segments.push({
            type: 'text',
            content: textBefore
          });
        }
      }

      // Add thinking content
      segments.push({
        type: 'thinking',
        subtype: match.subtype,
        content: match.content,
        isUnclosed: match.isUnclosed
      });

      // Update current position
      currentPos = match.endPos;
    });

    // Add text after the final match
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
    console.error('thinking content parsing failed:', error);
    // On error, return everything as plain text
    return {
      segments: [{ type: 'text', content: text }]
    };
  }
};

/**
 * HTML escape helper to prevent XSS
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
 * Mermaid diagram renderer using iframe isolation
 * Similar to GitHub viewscreen-mermaid implementation
 */
const MermaidRenderer = ({ chart }: { chart: string }) => {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = React.useState(200);
  const [svg, setSvg] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const [lastRenderedChart, setLastRenderedChart] = React.useState('');
  const { message } = App.useApp();
  
  // Generate a unique ID per instance to distinguish mermaid renderers
  const [instanceId] = React.useState(() => `mermaid-${Math.random().toString(36).substring(2, 10)}`);

  // Check whether chart content looks complete
  const isChartComplete = React.useCallback((chartContent: string) => {
    if (!chartContent || chartContent.trim() === '') return false;

    const trimmed = chartContent.trim();

    // Check basic mermaid syntax structure
    const hasValidStart = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gitgraph|pie|gantt|mindmap|timeline|quadrantChart|requirement|c4Context|xychart|block|sankey|packet|architecture)/i.test(trimmed);

    if (!hasValidStart) return false;

    // Check unclosed quotes (double quotes only; single quotes are uncommon in mermaid)
    const doubleQuotes = (trimmed.match(/"/g) || []).length;
    
    // Check square bracket balance
    const openBrackets = (trimmed.match(/\[/g) || []).length;
    const closeBrackets = (trimmed.match(/\]/g) || []).length;
    
    // Check parenthesis balance
    const openParens = (trimmed.match(/\(/g) || []).length;
    const closeParens = (trimmed.match(/\)/g) || []).length;
    
    // Check brace balance
    const openBraces = (trimmed.match(/\{/g) || []).length;
    const closeBraces = (trimmed.match(/\}/g) || []).length;

    // Basic balance check, permissive unless obviously incomplete
    const isBalanced = (doubleQuotes % 2 === 0) &&
                      (openBrackets >= closeBrackets - 1 && openBrackets <= closeBrackets + 1) &&
                      (openParens >= closeParens - 1 && openParens <= closeParens + 1) &&
                      (openBraces >= closeBraces - 1 && openBraces <= closeBraces + 1);

    // If content is long enough and has line breaks, it may be complete
    const hasMultipleLines = trimmed.includes('\n');
    const isLongEnough = trimmed.length > 20;

    return isBalanced || (hasMultipleLines && isLongEnough);
  }, []);

  // Export SVG
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
    message.success('SVG exported');
  }, [svg, message]);

  // Copy code
  const handleCopyCode = React.useCallback(() => {
    if (!chart) return;
    
    navigator.clipboard.writeText(chart).then(() => {
      message.success('Mermaid code copied to clipboard');
    }).catch(() => {
      message.error('Copy failed');
    });
  }, [chart, message]);

  // Code-view state
  const [showCode, setShowCode] = React.useState(false);

  // Generate iframe HTML with instance ID for message matching
  const generateIframeContent = React.useCallback((chartCode: string, id: string) => {
    // Use escaped chart code
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
        
        // Decode HTML entities
        const textarea = document.createElement('textarea');
        textarea.innerHTML = code;
        const decodedCode = textarea.value;
        
        const { svg } = await mermaid.render('mermaid-svg', decodedCode);
        element.innerHTML = svg;
        
        // Send render-success message and SVG payload with instance ID
        const height = document.body.scrollHeight;
        window.parent.postMessage({ 
          type: 'mermaid-rendered',
          instanceId: INSTANCE_ID,
          height: height,
          svg: svg
        }, '*');
      } catch (err) {
        const container = document.getElementById('container');
        container.innerHTML = '<div class="error">' + (err.message || 'Render failed') + '</div>';
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

  // iframe srcdoc content
  const [srcdoc, setSrcdoc] = React.useState<string>('');
  
  // Whether render has succeeded, used to prevent flicker
  const [hasRendered, setHasRendered] = React.useState(false);

  // Listen for iframe messages from this instance only
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only handle messages for this instance
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

  // Render chart to iframe on content changes; let mermaid handle errors
  useEffect(() => {
    if (!chart) return;
    
    // Skip if content matches the last rendered chart
    if (chart === lastRenderedChart) return;

    // Clear error state
    setError(null);

    // Debounce to avoid frequent renders during streaming
    const debounceTimer = setTimeout(() => {
      const htmlContent = generateIframeContent(chart, instanceId);
      setSrcdoc(htmlContent);
      setLastRenderedChart(chart);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [chart, lastRenderedChart, generateIframeContent, instanceId]);

  // Handle click event
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
        title={svg ? "Click to view larger image" : undefined}
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
      
      {/* zoom modal */}
      <Modal
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width="90%"
        centered
        style={{ maxWidth: '1200px' }}
      >
        {showCode ? (
          /* code view without zoom */
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
              <Tooltip title="View diagram">
                <Button icon={<CodeOutlined />} onClick={() => setShowCode(false)} />
              </Tooltip>
              <Tooltip title="Copy code">
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
          /* diagram view with zoom */
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
                  <Tooltip title="Zoom in">
                    <Button icon={<ZoomInOutlined />} onClick={() => zoomIn()} />
                  </Tooltip>
                  <Tooltip title="Zoom out">
                    <Button icon={<ZoomOutOutlined />} onClick={() => zoomOut()} />
                  </Tooltip>
                  <Tooltip title="Reset">
                    <Button icon={<UndoOutlined />} onClick={() => resetTransform()} />
                  </Tooltip>
                  <Tooltip title="View code">
                    <Button icon={<CodeOutlined />} onClick={() => setShowCode(true)} />
                  </Tooltip>
                  <Tooltip title="Copy code">
                    <Button icon={<CopyOutlined />} onClick={handleCopyCode} />
                  </Tooltip>
                  <Tooltip title="Export SVG">
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
 * Generic Markdown renderer component
 * Uniformly renders Markdown with syntax highlighting, math, mermaid, and more
 * @param {Object} props - Component props
 * @param {string} props.content - Markdown content
 * @param {boolean} props.showLineNumbers - Whether to show line numbers, defaults to true
 * @returns {JSX.Element} Rendered Markdown content
 */
export const MarkdownRenderer = ({ content, showLineNumbers = true }) => {
  // Use useMemo to detect and handle LaTeX formulas to avoid repeated streaming renders
  const { processedContent, hasIncompleteMath } = React.useMemo(() => {
    if (!content) return { processedContent: '', hasIncompleteMath: false };
    
    // Count LaTeX delimiter pairs
    const dollarSigns = (content.match(/\$/g) || []).length;
    const doubleDollarSigns = (content.match(/\$\$/g) || []).length;
    
    // Count single dollar signs excluding $$
    const singleDollarCount = dollarSigns - doubleDollarSigns * 2;
    
    // Odd single-dollar count indicates an unclosed inline formula
    const hasIncompleteMath = singleDollarCount % 2 !== 0;
    
    // If formula is incomplete, temporarily disable LaTeX rendering and show raw text
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

            // Handle inline code
            if (inline) {
              return <code className={className} {...props}>{children}</code>;
            }

            // Get code content
            const codeContent = String(children).replace(/\n$/, '');

            // Handle mermaid diagrams
            if (match && match[1] === 'mermaid') {
              // Render mermaid directly without syntax validation
              const trimmedCode = codeContent.trim();

              // Use MermaidRenderer directly and let it handle errors
              return <MermaidRenderer chart={trimmedCode} />;
            }

            // Handle regular code blocks
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
 * Renderer for thinking content
 */
export const ThinkingContentRenderer = ({ thinkingContent, isUnclosed }) => {
  // Ensure thinkingContent exists and is a string
  if (!thinkingContent || typeof thinkingContent !== 'string' || thinkingContent.trim() === '') {
    return null;
  }

  // Remove tags and clean content
  const cleanedContent = thinkingContent
    .replace(/<\/?think>/g, '')
    .replace(/<\/?thinking>/g, '')
    .replace(/<\/?observing>/g, '')
    .trim();

  // Do not render if cleaned content is empty
  if (!cleanedContent) {
    return null;
  }

  return (
    <div style={{ marginBottom: '8px' }}>
      <Collapse
        ghost
       
        defaultActiveKey={isUnclosed ? ['1'] : []} // expand by default for unclosed tags during streaming
        items={[
          {
            key: '1',
            label: (
              <Text type="secondary">
                <BulbOutlined style={{ marginRight: '5px' }} />
                View thinking process {isUnclosed && <Tag color="grey">Thinking</Tag>}
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
 * Content rendering component
 * Parses and displays conversation content, including text, tool calls, and thinking content
 * Central component for rendering all message content
 */
function ConversationExtraction({
  content,
  messageThinking,
  isToolCallOnly = false,
  message = null,
  task = null
}: any) {
  // Capability-tool mapping data, using module cache to avoid repeated requests
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

  // Process message content
  const { displayContent, thinkingContent, imageContent } = useMemo(() => {
    // Prefer extracting content from the full message object if provided
    let rawContent = message ? message.content : content;
    let thinkingContent = message ? message.thinking : messageThinking;
    let displayContent = '';
    let imageContent = [];

    // Process multimodal content
    if (Array.isArray(rawContent)) {
      // Multimodal message: extract text and images
      rawContent.forEach(item => {
        if (item.type === 'text') {
          displayContent += item.text || '';
        } else if (item.type === 'image') {
          imageContent.push(item);
        }
      });
    } else {
      // Plain text message
      displayContent = rawContent || '';
    }

    // Normalize separate thinking field if present
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

  // Use new parser for thinking content and tool calls

  // Parse tool calls and results while preserving original positions
  const parseToolCalls = (text) => {
    if (!text) return { segments: [] };

    // Map tool-call IDs to indexes to associate calls with results
    const toolCallIdMap = {};

    try {
      // Find all possible JSON objects
      const jsonSegments = [];
      let currentText = '';
      let currentPos = 0;

      while (currentPos < text.length) {
        const startPos = text.indexOf('{"content":', currentPos);

        // If no more JSON objects are found, append remaining text as plain content
        if (startPos === -1) {
          if (currentPos < text.length) {
            currentText += text.substring(currentPos);
          }
          break;
        }

        // Add text before JSON as plain content
        if (startPos > currentPos) {
          currentText += text.substring(currentPos, startPos);
        }

        // Find matching JSON end position
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

        // If complete JSON is found
        if (endPos > startPos) {
          const jsonStr = text.substring(startPos, endPos);

          try {
            // Try to parse JSON; if it fails, treat as plain text
            let jsonObj;
            try {
              jsonObj = JSON.parse(jsonStr);
            } catch (parseError) {
              // Log warning instead of error to avoid noisy console output
              console.warn('JSON parse failed:', parseError);
              // Add JSON string as plain text
              currentText += jsonStr;
              currentPos = endPos;
              continue;
            }

            // Skip JSON with blank content
            if (jsonObj.content && jsonObj.content.trim() === "" && !jsonObj.meta) {
              // Skip blank-content JSON
              currentPos = endPos;
              continue;
            }

            // Add accumulated text as a text segment if non-empty
            if (currentText.trim() !== '') {
              jsonSegments.push({
                type: 'text',
                content: currentText.trim()
              });
              currentText = '';
            }

            // Parse tool call
            if (jsonObj.meta) {
              // Handle tool call action - ToolCallAction
              if (jsonObj.meta.ToolCallAction) {
                const actionData = jsonObj.meta.ToolCallAction;
                const toolCallId = jsonObj.meta.toolCallId || '';

                // Create tool call object
                const toolCall = {
                  type: 'toolCall',
                  subtype: 'action',
                  function: actionData.Function,
                  arguments: actionData.Arguments,
                  toolCallId: toolCallId,
                  result: null,
                  // Store raw JSON object
                  rawJson: jsonObj
                };

                // Add to segment collection
                const index = jsonSegments.length;
                jsonSegments.push(toolCall);

                // Record tool-call ID mapping
                if (toolCallId) {
                  toolCallIdMap[toolCallId] = index;
                }
              }
              // Handle tool call result - ToolCallResult or role:tool format
              else if (jsonObj.meta.ToolCallResult || (jsonObj.meta.type === 'toolResult' && jsonObj.meta.role === 'tool')) {
                // Support legacy ToolCallResult and new role:tool formats
                let resultContent, toolName, toolCallId, status, toolParameter;

                if (jsonObj.meta.ToolCallResult) {
                  // Legacy format
                  resultContent = jsonObj.meta.ToolCallResult;
                  toolName = jsonObj.meta.toolName || '';
                  toolCallId = jsonObj.meta.toolCallId || '';
                  status = jsonObj.meta.status || 'success';
                  toolParameter = jsonObj.meta.toolParameter || '{}';
                } else {
                  // New role:tool format
                  resultContent = jsonObj.meta.content;
                  toolName = jsonObj.meta.tool_name || '';
                  toolCallId = jsonObj.meta.tool_call_id || '';
                  status = jsonObj.meta.status || 'success'; // read status field, default to success
                  toolParameter = jsonObj.meta.tool_parameter || '{}';
                }

                // Create result object
                const resultObj = {
                  content: resultContent,
                  toolName: toolName,
                  status: status,
                  // Store raw JSON object
                  rawJson: jsonObj
                };

                // Attach result to matching tool call if present
                if (toolCallId && toolCallIdMap[toolCallId] !== undefined) {
                  const index = toolCallIdMap[toolCallId];
                  jsonSegments[index].result = resultObj;
                  jsonSegments[index].status = status; // update corresponding tool-call status
                } else {
                  // If no matching tool call is found, create and add a new tool call object
                  // Mark as auto-created so rendering can distinguish it
                  // Use toolParameter as arguments
                  let toolArguments = {};
                  try {
                    // Try to parse tool parameters
                    if (typeof toolParameter === 'string') {
                      // If it is a string, try parsing JSON
                      if (toolParameter.trim() === '' || toolParameter === '{}') {
                        // Empty string or object uses default empty object
                        toolArguments = {};
                      } else {
                        // Try parsing JSON string
                        toolArguments = JSON.parse(toolParameter);
                      }
                    } else if (typeof toolParameter === 'object' && toolParameter !== null) {
                      // Use directly if already an object
                      toolArguments = toolParameter;
                    } else {
                      // Use empty object otherwise
                      toolArguments = {};
                    }
                  } catch (e) {
                    // On parse failure, avoid logging full parameters to prevent leaking sensitive info
                    console.warn('tool parameter parsing failed:', e.message);

                    // Try smarter handling for parse failures
                    if (typeof toolParameter === 'string') {
                      // A non-JSON string may be serialized parameters
                      // Try treating it as a single parameter value
                      try {
                        // Check for double-encoded JSON string
                        const unescaped = toolParameter.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                        toolArguments = JSON.parse(unescaped);
                      } catch (secondError) {
                        // If it still fails, store original string as value
                        toolArguments = {
                          value: toolParameter,
                          _parse_note: "Original parameter could not be parsed as JSON and was handled as a string value"
                        };
                      }
                    } else {
                      // Other parameter types
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
                    status: status, // set tool-call status
                    result: resultObj,
                    isAutoCreated: true // mark as auto-created tool call
                  });
                }
              }
              // Handle other metadata types if needed
              else if (jsonObj.content) {
                // Add regular content as a text segment if present
                if (jsonObj.content.trim() !== '') {
                  jsonSegments.push({
                    type: 'text',
                    content: jsonObj.content.trim()
                  });
                }
              }
            } else if (jsonObj.content) {
              // Add regular-only content as a text segment
              if (jsonObj.content.trim() !== '') {
                jsonSegments.push({
                  type: 'text',
                  content: jsonObj.content.trim()
                });
              }
            }
          } catch (e) {
            console.error('JSON parse failed:', e);
            // If parsing fails, add JSON string as plain text
            currentText += jsonStr;
          }

          currentPos = endPos;
        } else {
          // If complete JSON cannot be found, append remaining text as plain content
          currentText += text.substring(currentPos);
          break;
        }
      }

      // Handle possible remaining text
      if (currentText.trim() !== '') {
        jsonSegments.push({
          type: 'text',
          content: currentText.trim()
        });
      }

      // Merge adjacent text segments to avoid fragmented text blocks
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

      // Remove all HTML comments
      mergedSegments.forEach(segment => {
        if (segment.type === 'text') {
          // Remove all HTML comments
          segment.content = segment.content.replace(/<!-- .*? -->/g, '').trim();
        }
      });

      // Filter empty text segments
      return {
        segments: mergedSegments.filter(segment =>
          segment.type !== 'text' || segment.content.trim() !== ''
        )
      };
    } catch (error) {
      console.error('tool call parsing failed:', error);
      // On error, return everything as plain text
      return {
        segments: [{ type: 'text', content: text }]
      };
    }
  };

  // Get tool icon
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

  // Get capability tags for a tool
  const getToolCapabilityTags = (toolName) => {
    const capabilityColors = ['blue', 'cyan', 'green', 'orange', 'purple', 'magenta', 'geekblue'];
    const capabilitiesSet = new Set();

    // Traverse capability-tool mapping to find capabilities containing this tool
    Object.entries(capabilityToolsMap).forEach(([capabilityName, serversData]) => {
      if (serversData && typeof serversData === 'object') {
        // Traverse all server types and check whether they contain this tool
        const hasToolInAnyServer = Object.values(serversData).some(
          toolsList => Array.isArray(toolsList) && toolsList.includes(toolName)
        );
        if (hasToolInAnyServer) {
          capabilitiesSet.add(capabilityName);
        }
      }
    });

    // Return tags if capabilities are found
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

    // Return default tag if no capability is found
    return <Tag color="default">Tool Call</Tag>;
  };

  // Render text content
  const renderTextContent = (segment, index) => {
    if (segment.type === 'text') {
      // No longer auto-detect or repair mermaid content outside code blocks
      // Render Markdown only; code block handler processes complete mermaid tags

      return (
        <div key={`text-${index}`} className="text-content" style={{
          marginBottom: '12px',
          width: '100%', // ensure text content width matches parent
          maxWidth: '100%', // ensure it does not exceed parent width
          overflowX: 'auto', // add horizontal scroll for overflow
          wordBreak: 'break-word', // allow long words to wrap
          overflowWrap: 'break-word' // allow long words to wrap
        }}>
          <MarkdownRenderer content={segment.content} />
        </div>
      );
    }
    return null;
  };

  // Render thinking segments
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

  // SubAgent tool-name set
  const SUBAGENT_TOOL_NAMES = new Set(['invoke_agent', 'invoke_agents', 'list_available_agents']);

  // Render tool call card
  const renderToolCallCard = (toolCall, index) => {
    // Handle only toolCall segments
    if (toolCall.type === 'toolCall' && toolCall.subtype === 'action') {

      // Special rendering for SubAgent tools
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

      // Check whether result exists
      const hasResult = toolCall.result !== null;

      // Get status tag
      let statusTag = <Tag color="processing">Processing...</Tag>;

      if (hasResult) {
        // Determine result state using status field only
        const status = toolCall.result.status || 'success';
        if (status === 'error') {
          statusTag = <Tag icon={<CloseCircleOutlined />} color="error">Failed</Tag>;
        } else if (status === 'warning') {
          statusTag = <Tag icon={<WarningOutlined />} color="warning">Warning</Tag>;
        } else {
          statusTag = <Tag icon={<CheckCircleOutlined />} color="success">Success</Tag>;
        }
      }

      return (
        <div key={`tool-${index}`} style={{ marginBottom: '12px' }}>
          <Collapse
            expandIcon={({ isActive }) => isActive ? <DownOutlined /> : <RightOutlined />}
            defaultActiveKey={[]} // closed by default
           
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
                    {/* show full ToolCallResult content */}
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
                            // Try parsing JSON; if it fails, show raw string
                            return (
                              <ReactJson
                                src={toolCall.result.content}
                                theme="chalk"
                                displayDataTypes={false}
                                collapsed={1}
                              />
                            );
                          } catch (e) {
                            console.warn('tool call result JSON parsing failed:', e);
                            // Show warning and raw content on parse failure
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
                                  <p>JSON parse warning: {e.message}</p>
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
                  <div>No result</div>
                )
              }
            ]}
          />
        </div>
      );
    }
    return null;
  };

  // Parse content
  // Parse thinking content first
  const { segments: thinkingSegments } = parseThinking(displayContent || '');

  // Parse tool calls in each text segment
  const allSegments = [];

  thinkingSegments.forEach(segment => {
    if (segment.type === 'text') {
      // Parse tool calls in text segment
      const { segments: toolSegments } = parseToolCalls(segment.content);
      allSegments.push(...toolSegments);
    } else {
      // Preserve thinking segments
      allSegments.push(segment);
    }
  });

  // If no segments exist, content is empty
  if (allSegments.length === 0) {
    return null;
  }

  // Check parsed segments for tool calls
  const hasToolCall = allSegments.some(segment => segment.type === 'toolCall');

  // If only text exists and tool-call-only mode is enabled, return null
  if (isToolCallOnly && !hasToolCall) {
    return null;
  }

  // Render image content
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

            // Build full data URI
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
                  alt={`Uploaded image ${index + 1}`}
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
                  Image failed to load
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render component with thinking and segment content
  return (
    <div className="conversation-extraction">
      {/* render standalone thinking content if present */}
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

      {/* render image content */}
      {renderImageContent()}

      {/* render all segments including text, thinking content, and tool calls */}
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