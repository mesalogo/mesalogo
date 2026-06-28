import React, { useEffect, useState } from 'react';
import { Result, Button, Spin } from 'antd';
import { setupAPI } from '../../services/api/setup';
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
  const [phase, setPhase] = useState<Phase>('checking');

  const check = async () => {
    setPhase('checking');
    try {
      const s = await setupAPI.getStatus();
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
        <Spin size="large" tip="正在连接后端…">
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
          title="无法连接到后端服务"
          subTitle="请确认后端已启动，然后重试。"
          extra={<Button type="primary" onClick={check}>重试</Button>}
        />
      </div>
    );
  }

  if (phase === 'setup') {
    return <SetupWizard onDone={() => setPhase('ready')} />;
  }

  return <>{children}</>;
};

export default SetupGate;
