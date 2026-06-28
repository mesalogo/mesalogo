import React, { useState } from 'react';
import {
  Steps, Form, Input, Select, Button, Card, Space, Typography, Alert, App as AntdApp, Result,
} from 'antd';
import { DatabaseOutlined, ThunderboltOutlined, KeyOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { setupAPI } from '../../services/api/setup';

const { Title, Paragraph, Text } = Typography;

const DB_TYPES = [
  { label: 'MySQL', value: 'mysql', driver: 'mysql+pymysql', port: '3306', suffix: '?charset=utf8mb4' },
  { label: 'PostgreSQL', value: 'postgresql', driver: 'postgresql+psycopg2', port: '5432', suffix: '' },
  { label: 'SQLite（本地文件，仅开发）', value: 'sqlite', driver: 'sqlite', port: '', suffix: '' },
];

/** 由表单字段拼出 SQLAlchemy 连接串 */
function buildDbUri(v: any): string {
  const t = DB_TYPES.find((d) => d.value === v.dbType) || DB_TYPES[0];
  if (v.dbType === 'sqlite') {
    return `sqlite:///${v.sqlitePath || 'data/app.db'}`;
  }
  const auth = v.username ? `${v.username}:${encodeURIComponent(v.password || '')}@` : '';
  return `${t.driver}://${auth}${v.host}:${v.port}/${v.database}${t.suffix}`;
}

const SetupWizard: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [current, setCurrent] = useState(0);
  const [dbType, setDbType] = useState('mysql');
  const [testing, setTesting] = useState(false);
  const [dbTested, setDbTested] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const steps = [
    { title: '数据库', icon: <DatabaseOutlined /> },
    { title: 'Redis（可选）', icon: <ThunderboltOutlined /> },
    { title: '许可证（可选）', icon: <KeyOutlined /> },
    { title: '确认并保存', icon: <CheckCircleOutlined /> },
  ];

  const handleTestDb = async () => {
    try {
      await form.validateFields(['dbType', 'host', 'port', 'database', 'username', 'sqlitePath']);
    } catch {
      return;
    }
    setTesting(true);
    const uri = buildDbUri(form.getFieldsValue());
    const res = await setupAPI.testDb(uri);
    setTesting(false);
    if (res.success) {
      setDbTested(true);
      message.success('数据库连接成功');
    } else {
      setDbTested(false);
      message.error(`数据库连接失败：${res.error}`);
    }
  };

  const handleTestRedis = async () => {
    const url = form.getFieldValue('redisUrl');
    if (!url) {
      message.info('未填写 Redis 地址，将以无缓存模式运行');
      return;
    }
    setTesting(true);
    const res = await setupAPI.testRedis(url);
    setTesting(false);
    res.success ? message.success('Redis 连接成功') : message.error(`Redis 连接失败：${res.error}`);
  };

  const handleSave = async () => {
    const v = form.getFieldsValue(true);
    setSaving(true);
    const res = await setupAPI.save({
      database_uri: buildDbUri(v),
      redis_url: v.redisUrl || '',
    });
    setSaving(false);
    if (!res.success) {
      message.error(`保存失败：${res.error}`);
      return;
    }
    // 进入「等待重启」态，轮询后端直到退出 Setup 模式
    setRestarting(true);
    pollUntilReady();
  };

  const pollUntilReady = () => {
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      try {
        const s = await setupAPI.getStatus();
        if (!s.setup_mode) {
          clearInterval(timer);
          onDone();
          window.location.reload();
        }
      } catch {
        // 重启过程中后端短暂不可达属正常，继续轮询
      }
      if (tries > 60) {
        clearInterval(timer);
        message.warning('后端重启耗时较长，请稍后手动刷新页面');
      }
    }, 2000);
  };

  const next = () => {
    if (current === 0 && !dbTested) {
      message.warning('请先测试数据库连接通过');
      return;
    }
    setCurrent((c) => c + 1);
  };
  const prev = () => setCurrent((c) => c - 1);

  if (restarting) {
    return (
      <CenteredCard>
        <Result
          status="info"
          title="配置已保存，后端正在重启…"
          subTitle="正在等待服务恢复，完成后将自动进入登录页面，请稍候。"
        />
      </CenteredCard>
    );
  }

  return (
    <CenteredCard>
      <Title level={3} style={{ textAlign: 'center', marginBottom: 4 }}>系统初始化</Title>
      <Paragraph type="secondary" style={{ textAlign: 'center' }}>
        欢迎使用 ABM-LLM。首次启动需要配置数据库等连接信息，完成后系统将自动重启。
      </Paragraph>

      <Steps current={current} items={steps} style={{ margin: '24px 0' }} />

      <Form form={form} layout="vertical" initialValues={{ dbType: 'mysql', host: '127.0.0.1', port: '3306', database: 'abm' }}>
        {/* Step 1: 数据库 */}
        <div style={{ display: current === 0 ? 'block' : 'none' }}>
          <Form.Item name="dbType" label="数据库类型" rules={[{ required: true }]}>
            <Select
              options={DB_TYPES.map((d) => ({ label: d.label, value: d.value }))}
              onChange={(val) => {
                setDbType(val);
                setDbTested(false);
                const t = DB_TYPES.find((d) => d.value === val);
                if (t?.port) form.setFieldValue('port', t.port);
              }}
            />
          </Form.Item>

          {dbType === 'sqlite' ? (
            <Form.Item name="sqlitePath" label="数据库文件路径" rules={[{ required: true, message: '请输入路径' }]}>
              <Input placeholder="data/app.db" onChange={() => setDbTested(false)} />
            </Form.Item>
          ) : (
            <>
              <Space style={{ display: 'flex' }} align="start">
                <Form.Item name="host" label="主机" rules={[{ required: true, message: '请输入主机' }]} style={{ flex: 1 }}>
                  <Input placeholder="127.0.0.1" onChange={() => setDbTested(false)} />
                </Form.Item>
                <Form.Item name="port" label="端口" rules={[{ required: true, message: '请输入端口' }]} style={{ width: 120 }}>
                  <Input onChange={() => setDbTested(false)} />
                </Form.Item>
              </Space>
              <Form.Item name="database" label="数据库名" rules={[{ required: true, message: '请输入数据库名' }]}>
                <Input placeholder="abm" onChange={() => setDbTested(false)} />
              </Form.Item>
              <Space style={{ display: 'flex' }} align="start">
                <Form.Item name="username" label="用户名" style={{ flex: 1 }}>
                  <Input placeholder="root" onChange={() => setDbTested(false)} />
                </Form.Item>
                <Form.Item name="password" label="密码" style={{ flex: 1 }}>
                  <Input.Password onChange={() => setDbTested(false)} />
                </Form.Item>
              </Space>
            </>
          )}
          <Button onClick={handleTestDb} loading={testing}>测试连接</Button>
          {dbTested && <Text type="success" style={{ marginLeft: 12 }}>✓ 连接正常</Text>}
        </div>

        {/* Step 2: Redis */}
        <div style={{ display: current === 1 ? 'block' : 'none' }}>
          <Alert
            type="info" showIcon style={{ marginBottom: 16 }}
            message="Redis 为可选项，留空则以无缓存模式运行，不影响核心功能。"
          />
          <Form.Item name="redisUrl" label="Redis 连接地址">
            <Input placeholder="redis://127.0.0.1:6379/0" />
          </Form.Item>
          <Button onClick={handleTestRedis} loading={testing}>测试连接</Button>
        </div>

        {/* Step 3: License */}
        <div style={{ display: current === 2 ? 'block' : 'none' }}>
          <Alert
            type="info" showIcon
            message="许可证可在系统启动后于「设置 → 关于」中激活，此处可直接跳过。"
          />
        </div>

        {/* Step 4: 确认 */}
        <div style={{ display: current === 3 ? 'block' : 'none' }}>
          <Alert
            type="warning" showIcon style={{ marginBottom: 16 }}
            message="保存后系统将写入配置并自动重启，期间服务短暂不可用。"
          />
          <Paragraph>
            <Text strong>数据库：</Text> <Text code>{buildDbUri(form.getFieldsValue(true))}</Text>
          </Paragraph>
          <Paragraph>
            <Text strong>Redis：</Text> <Text code>{form.getFieldValue('redisUrl') || '（未配置）'}</Text>
          </Paragraph>
        </div>
      </Form>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={prev} disabled={current === 0}>上一步</Button>
        {current < steps.length - 1 ? (
          <Button type="primary" onClick={next}>下一步</Button>
        ) : (
          <Button type="primary" onClick={handleSave} loading={saving}>保存并启动</Button>
        )}
      </div>
    </CenteredCard>
  );
};

const CenteredCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--ant-color-bg-layout, #f5f5f5)' }}>
    <Card style={{ width: 560, maxWidth: '100%' }} variant="outlined">{children}</Card>
  </div>
);

export default SetupWizard;
