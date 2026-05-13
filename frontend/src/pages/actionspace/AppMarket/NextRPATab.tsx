import React, { useState, useEffect, useRef } from 'react';
import { Modal, Badge, Empty, Spin, Card, App } from 'antd';
import { VncScreen } from 'react-vnc';
import { vncProxyService } from '../../../services/marketService';

interface NextRPATabProps {
  appConfig: any;
}

const NextRPATab: React.FC<NextRPATabProps> = ({ appConfig }) => {
  const { message } = App.useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [wsPort, setWsPort] = useState<number>(6080);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const vncRef = useRef<any>(null);
  const initRef = useRef(false);
  const tokenRef = useRef<string | null>(null);

  const vncAddress = appConfig?.connection?.localConfig?.vncUrl || '';
  const mcpAddress = appConfig?.connection?.localConfig?.sseUrl || '';
  const vncPassword = appConfig?.connection?.localConfig?.vncPassword || '';
  const vncWebProxyUrl = appConfig?.connection?.localConfig?.vncWebProxyUrl || '';

  useEffect(() => {
    if (!vncAddress || initRef.current) return;
    initRef.current = true;

    const initVNC = async () => {
      setLoading(true);
      setStatus('connecting');
      try {
        const target = vncAddress.replace(/^wss?:\/\//, '');
        console.log('[NextRPATab] Starting VNC proxy for target:', target);
        const result = await vncProxyService.start(target);
        console.log('[NextRPATab] VNC proxy started:', result);
        tokenRef.current = result.token;
        setToken(result.token);
        setWsPort(result.ws_port);
      } catch (error: any) {
        console.error('[NextRPATab] VNC 代理启动失败:', error);
        setErrorMsg(error?.message || String(error));
        setStatus('error');
        setLoading(false);
      }
    };

    initVNC();

    return () => {
      if (tokenRef.current) {
        console.log('[NextRPATab] Cleanup: stopping VNC proxy');
        vncProxyService.stop(tokenRef.current).catch(console.error);
      }
    };
  }, [vncAddress]);

  // 生成 WebSocket URL：优先使用用户配置的 Web VNC 代理地址
  const getVncWsUrl = () => {
    if (!token) return '';
    if (vncWebProxyUrl) {
      // 将 http(s):// 转换为 ws(s)://
      const wsUrl = vncWebProxyUrl
        .replace(/^https:\/\//, 'wss://')
        .replace(/^http:\/\//, 'ws://');
      return `${wsUrl}?token=${token}`;
    }
    return vncProxyService.getProxyUrl(wsPort, token);
  };

  const wsUrl = getVncWsUrl();

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return <Badge status="success" text="已连接" />;
      case 'connecting':
        return <Badge status="processing" text="连接中" />;
      case 'error':
        return <Badge status="error" text={`连接失败: ${errorMsg}`} />;
      default:
        return <Badge status="default" text="未连接" />;
    }
  };

  if (!vncAddress) {
    return <Empty description="请先配置 VNC 地址" />;
  }

  return (
    <div>
      {/* Info Bar */}
      <div style={{ marginBottom: 12, color: 'var(--custom-text-secondary)', fontSize: 13 }}>
        <div>VNC: {vncAddress}</div>
        <div>MCP: {mcpAddress}</div>
      </div>

      {/* 缩略图 - 只读 */}
      <Card
        styles={{ body: { padding: 0 } }}
      >
        {loading && !wsUrl ? (
          <div style={{ width: '100%', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <Spin />
            <span>正在连接 VNC...</span>
          </div>
        ) : wsUrl ? (
          <div style={{ width: '100%', aspectRatio: '16/9', position: 'relative' }}>
            <VncScreen
              url={wsUrl}
              scaleViewport
              viewOnly={true}
              background="#000000"
              style={{ width: '100%', height: '100%' }}
              rfbOptions={{ credentials: { password: vncPassword } }}
              onConnect={() => {
                console.log('[NextRPATab] VNC connected!');
                setStatus('connected');
                setLoading(false);
                message.success('VNC 连接成功');
              }}
              onDisconnect={(e: any) => {
                console.log('[NextRPATab] VNC disconnected:', e);
                if (e?.detail?.clean === false || e?.detail?.code === 1011) {
                  setErrorMsg(e?.detail?.reason || '无法连接到目标服务器');
                  setStatus('error');
                  message.error('VNC 连接失败: ' + (e?.detail?.reason || '无法连接到目标服务器'));
                } else {
                  setStatus('disconnected');
                }
                setLoading(false);
              }}
              onSecurityFailure={(e: any) => {
                console.log('[NextRPATab] VNC security failure:', e);
                setErrorMsg('安全验证失败: ' + (e?.detail?.reason || ''));
                setStatus('error');
                setLoading(false);
                message.error('VNC 安全验证失败');
              }}
            />
            {/* 透明遮罩层 - 捕获点击事件 */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onClick={() => setModalVisible(true)}
            >
              <div
                style={{
                  padding: '8px 16px',
                  background: 'rgba(0,0,0,0.6)',
                  borderRadius: 4,
                  opacity: 0,
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
              >
                <span style={{ color: '#fff', fontSize: 14 }}>点击进入交互模式</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--custom-hover-bg)' }}>
            <span style={{ color: 'var(--custom-text-secondary)' }}>等待连接...</span>
          </div>
        )}
      </Card>

      {/* 状态 */}
      <div style={{ marginTop: 12 }}>
        {getStatusBadge()}
      </div>

      {/* Modal - 可交互 */}
      <Modal
        title="VNC 控制台"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width="85vw"
        style={{ top: 20 }}
        footer={null}
        destroyOnHidden
      >
        {wsUrl && (
          <div style={{ width: '100%', height: '70vh' }}>
            <VncScreen
              ref={vncRef}
              url={wsUrl}
              scaleViewport
              viewOnly={false}
              background="#000000"
              style={{ width: '100%', height: '100%' }}
              rfbOptions={{ credentials: { password: vncPassword } }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default NextRPATab;
