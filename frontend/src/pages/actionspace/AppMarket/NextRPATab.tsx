import React, { useState, useEffect, useRef } from 'react';
import { Modal, Badge, Empty, Spin, Card, App } from 'antd';
import { VncScreen } from 'react-vnc';
import { useTranslation } from 'react-i18next';
import { vncProxyService } from '../../../services/marketService';

interface NextRPATabProps {
  appConfig: any;
}

const NextRPATab: React.FC<NextRPATabProps> = ({ appConfig }) => {
  const { t } = useTranslation();
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
        console.error('[NextRPATab] VNC proxy start failed:', error);
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
        return <Badge status="success" text={t('nextRPA.vnc.connected')} />;
      case 'connecting':
        return <Badge status="processing" text={t('nextRPA.vnc.connecting')} />;
      case 'error':
        return <Badge status="error" text={t('nextRPA.vnc.connectFailed', { error: errorMsg })} />;
      default:
        return <Badge status="default" text={t('nextRPA.vnc.notConnected')} />;
    }
  };

  if (!vncAddress) {
    return <Empty description={t('nextRPA.vnc.configureFirst')} />;
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
            <span>{t('nextRPA.vnc.connectingVnc')}</span>
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
                message.success(t('nextRPA.vnc.connectSuccess'));
              }}
              onDisconnect={(e: any) => {
                console.log('[NextRPATab] VNC disconnected:', e);
                if (e?.detail?.clean === false || e?.detail?.code === 1011) {
                  setErrorMsg(e?.detail?.reason || t('nextRPA.vnc.cannotConnectTarget'));
                  setStatus('error');
                  message.error(t('nextRPA.vnc.connectFailedMsg', { reason: e?.detail?.reason || t('nextRPA.vnc.cannotConnectTarget') }));
                } else {
                  setStatus('disconnected');
                }
                setLoading(false);
              }}
              onSecurityFailure={(e: any) => {
                console.log('[NextRPATab] VNC security failure:', e);
                setErrorMsg(t('nextRPA.vnc.securityFailure', { reason: e?.detail?.reason || '' }));
                setStatus('error');
                setLoading(false);
                message.error(t('nextRPA.vnc.securityFailureMsg'));
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
                <span style={{ color: '#fff', fontSize: 14 }}>{t('nextRPA.vnc.clickToInteract')}</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--custom-hover-bg)' }}>
            <span style={{ color: 'var(--custom-text-secondary)' }}>{t('nextRPA.vnc.waitingConnection')}</span>
          </div>
        )}
      </Card>

      {/* 状态 */}
      <div style={{ marginTop: 12 }}>
        {getStatusBadge()}
      </div>

      {/* Modal - 可交互 */}
      <Modal
        title={t('nextRPA.vnc.console')}
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
