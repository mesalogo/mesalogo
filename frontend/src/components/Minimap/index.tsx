import { useRef, useEffect, useState, useCallback } from 'react';
import { getAgentColor } from '../../utils/colorUtils';

interface MinimapProps {
  containerRef: React.RefObject<HTMLElement>;
  messages: any[];
  width?: number;
  visible?: boolean;
}

interface MessageBlock {
  y: number;
  height: number;
  color: string;
  role: string;
}

const MESSAGE_COLORS = {
  human: '#1677ff',
  user: '#1677ff',
  assistant: '#1677ff',
  system: '#8c8c8c',
  error: '#ff4d4f',
};

export default function Minimap({
  containerRef,
  messages,
  width = 80,
  visible = true,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number | null>(null);
  const [viewportInfo, setViewportInfo] = useState({
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
  });
  const [hoverTime, setHoverTime] = useState<string | null>(null);
  const [hoverName, setHoverName] = useState<string | null>(null);
  const [mouseY, setMouseY] = useState(0);
  const blockInfoRef = useRef<{y: number; height: number; msgIndex: number; originalY: number; originalHeight: number}[]>([]);
  // 缓存 DOM 查询结果，仅在 messages 数量变化时重新查询
  const cachedBlocksRef = useRef<MessageBlock[]>([]);
  const cachedMsgCountRef = useRef(0);

  const getMessageColor = useCallback((msg: any) => {
    const agentId = msg.agent_id || (msg.agent && msg.agent.id);
    const agentName = msg.agent_name || (msg.agent && msg.agent.name);
    
    if (agentId || agentName) {
      return getAgentColor(agentId || agentName);
    }
    const role = msg.role?.toLowerCase() || 'system';
    return MESSAGE_COLORS[role as keyof typeof MESSAGE_COLORS] || MESSAGE_COLORS.system;
  }, []);

  // 使用 rAF 节流的滚动处理
  const updateViewportInfo = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const container = containerRef.current;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      setViewportInfo({ scrollTop, scrollHeight, clientHeight });
      setShouldShow(scrollHeight > clientHeight + 10);
      
      setIsScrolling(true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 1500);
    });
  }, [containerRef]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    updateViewportInfo();
    container.addEventListener('scroll', updateViewportInfo, { passive: true });
    
    const resizeObserver = new ResizeObserver(updateViewportInfo);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', updateViewportInfo);
      resizeObserver.disconnect();
    };
  }, [containerRef, updateViewportInfo]);

  // 仅在 messages 数量变化时重新查询 DOM 构建 blocks
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !visible || messages.length === 0) {
      cachedBlocksRef.current = [];
      cachedMsgCountRef.current = 0;
      return;
    }

    const { scrollHeight, clientHeight } = container;
    if (scrollHeight <= clientHeight) {
      cachedBlocksRef.current = [];
      return;
    }

    const canvasHeight = container.clientHeight;
    const scale = canvasHeight / scrollHeight;
    const messageElements = container.querySelectorAll('.message-item');
    const blocks: MessageBlock[] = [];

    messageElements.forEach((el, index) => {
      const htmlEl = el as HTMLElement;
      const msg = messages[index];
      if (!msg) return;

      blocks.push({
        y: htmlEl.offsetTop * scale,
        height: Math.max(htmlEl.offsetHeight * scale, 2),
        color: getMessageColor(msg),
        role: msg.role,
      });
    });

    cachedBlocksRef.current = blocks;
    cachedMsgCountRef.current = messages.length;
  }, [messages.length, visible, containerRef, getMessageColor, messages]);

  // canvas 绘制 - 使用缓存的 blocks
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !visible) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = width;
    const canvasHeight = container.clientHeight;

    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = 'var(--custom-card-bg, #1f1f1f)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const { scrollHeight, clientHeight, scrollTop } = viewportInfo;
    if (scrollHeight <= clientHeight || messages.length === 0) return;

    const blocks = cachedBlocksRef.current;
    if (blocks.length === 0) return;

    const scale = canvasHeight / scrollHeight;

    // 紧凑绘制
    const totalHeight = blocks.reduce((sum, b) => sum + b.height, 0);
    const compactScale = totalHeight > 0 ? canvasHeight / totalHeight : 1;
    let currentY = 0;
    const blockInfo: {y: number; height: number; msgIndex: number; originalY: number; originalHeight: number}[] = [];
    
    blocks.forEach((block, index) => {
      const compactHeight = block.height * compactScale;
      ctx.fillStyle = block.color;
      ctx.globalAlpha = 1;
      ctx.fillRect(0, currentY, canvasWidth, compactHeight);
      blockInfo.push({ y: currentY, height: compactHeight, msgIndex: index, originalY: block.y / scale, originalHeight: block.height / scale });
      currentY += compactHeight;
    });
    
    blockInfoRef.current = blockInfo;

    // 视口指示器
    ctx.globalAlpha = 1;
    let viewportTopCompact = 0;
    let viewportBottomCompact = 0;
    const viewportTopOriginal = scrollTop;
    const viewportBottomOriginal = scrollTop + clientHeight;
    
    if (blockInfo.length > 0 && viewportTopOriginal <= blockInfo[0].originalY) {
      viewportTopCompact = 0;
    }
    
    for (const block of blockInfo) {
      const blockTopOriginal = block.originalY;
      const blockBottomOriginal = block.originalY + block.originalHeight;
      
      if (viewportTopCompact === 0 && blockBottomOriginal > viewportTopOriginal && viewportTopOriginal > blockInfo[0].originalY) {
        const ratio = Math.max(0, (viewportTopOriginal - blockTopOriginal) / block.originalHeight);
        viewportTopCompact = block.y + ratio * block.height;
      }
      
      if (blockBottomOriginal >= viewportBottomOriginal) {
        const ratio = Math.min(1, (viewportBottomOriginal - blockTopOriginal) / block.originalHeight);
        viewportBottomCompact = block.y + ratio * block.height;
        break;
      }
      viewportBottomCompact = block.y + block.height;
    }
    
    const viewportHeightCompact = Math.max(viewportBottomCompact - viewportTopCompact, 10);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(0, viewportTopCompact, canvasWidth, viewportHeightCompact);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, viewportTopCompact + 0.5, canvasWidth - 1, viewportHeightCompact - 1);

  }, [viewportInfo, width, visible, getMessageColor, containerRef, messages.length]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = canvas.getBoundingClientRect();
    const clickY = e.clientY - rect.top;

    const { scrollHeight, clientHeight } = viewportInfo;
    
    // 根据点击位置找到对应的消息，然后滚动到该消息
    const blockInfo = blockInfoRef.current;
    for (const block of blockInfo) {
      if (clickY >= block.y && clickY < block.y + block.height) {
        // 计算点击在该消息块内的比例
        const ratio = (clickY - block.y) / block.height;
        // 计算原始滚动位置
        const targetScrollTop = block.originalY + ratio * block.originalHeight - clientHeight / 2;
        
        container.scrollTo({
          top: Math.max(0, Math.min(targetScrollTop, scrollHeight - clientHeight)),
          behavior: 'auto',
        });
        return;
      }
    }
    
    // 如果点击在消息块之外（底部空白区域），滚动到底部
    if (blockInfo.length > 0 && clickY >= blockInfo[blockInfo.length - 1].y + blockInfo[blockInfo.length - 1].height) {
      container.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: 'auto',
      });
    }
  }, [containerRef, viewportInfo]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    handleClick(e);
  }, [handleClick]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setMouseY(y);
    
    // 查找对应的消息
    const blockInfo = blockInfoRef.current;
    for (const block of blockInfo) {
      if (y >= block.y && y < block.y + block.height) {
        const msg = messages[block.msgIndex];
        if (msg) {
          const time = new Date(msg.timestamp || msg.created_at).toLocaleString();
          setHoverTime(time);
          const name = msg.agent_name || msg.agent?.name || (msg.role === 'human' ? '用户' : '系统');
          setHoverName(name);
        }
        break;
      }
    }
    
    if (isDragging) {
      handleClick(e);
    }
  }, [isDragging, handleClick, messages]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    const container = containerRef.current;
    if (!container) return;
    
    // 将滚轮事件传递给消息容器
    container.scrollTop += e.deltaY;
  }, [containerRef]);

  if (!visible || messages.length === 0 || !shouldShow) return null;

  const isVisible = isScrolling || isHovering || isDragging;

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: width,
        zIndex: 10,
        opacity: isVisible ? (isHovering || isDragging ? 0.9 : 0.6) : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: 'auto',
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => { setIsHovering(false); setHoverTime(null); setHoverName(null); }}
    >
      {/* 悬停指示线和标签 */}
      {isHovering && (
        <>
          <div style={{
            position: 'absolute',
            right: width,
            top: mouseY,
            width: 16,
            height: 1,
            background: 'rgba(255,255,255,0.6)',
            pointerEvents: 'none',
          }} />
          {hoverTime && (
            <div style={{
              position: 'absolute',
              right: width + 16,
              top: mouseY - 16,
              background: 'rgba(0,0,0,0.75)',
              color: '#fff',
              padding: '4px 6px',
              borderRadius: '3px',
              fontSize: '11px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              lineHeight: 1.4,
            }}>
              <div style={{ opacity: 0.7 }}>{hoverName}</div>
              <div>{hoverTime}</div>
            </div>
          )}
        </>
      )}
      <canvas
        ref={canvasRef}
        style={{
          cursor: 'pointer',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  );
}
