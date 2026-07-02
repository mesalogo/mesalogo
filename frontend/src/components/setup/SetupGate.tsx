import React, { useEffect, useState } from 'react';
import { Result, Button, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { setupAPI, SetupDefaults } from '../../services/api/setup';
import SetupWizard from '../../pages/setup/SetupWizard';

/**
 * 首启引导守卫
 *
 * 应用最外层（认证之前）调用 GET /api/setup/status：
 * - setup_mode === true  → 渲染初始化向导，拦截一切现有路由（含 /login）
 * - setup_mode === false → 渲染正常应用（children），行为与改造前一致
 * - 探活中 / 后端不可达 → 加载态 / 错误重试
 */
type Phase = 'checking' | 'setup' | 'ready' | 'error';

const SetupGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('checking');
  const [defaults, setDefaults] = useState<SetupDefaults | undefined>(undefined);

  const check = async () => {
    setPhase('checking');
    try {
      const s = await setupAPI.getStatus();
      setDefaults(s.defaults);
      setPhase(s.setup_mode ? 'setup' : 'ready');
    } catch {
      setPhase('error');
    }
  };

  useEffect(() => {
    check();
  }, []);

  if (phase === 'checking') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip={t('setupGate.connecting')}>
          <div style={{ width: 1, height: 1 }} />
        </Spin>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Result
          status="warning"
          title={t('setupGate.cannotConnect')}
          subTitle={t('setupGate.cannotConnectDesc')}
          extra={<Button type="primary" onClick={check}>{t('setupGate.retry')}</Button>}
        />
      </div>
    );
  }

  if (phase === 'setup') {
    return <SetupWizard defaults={defaults} onDone={() => setPhase('ready')} />;
  }

  return <>{children}</>;
};

export default SetupGate;
