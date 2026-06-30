import React, { useState } from 'react';
import {
  Steps, Form, Input, Select, Button, Card, Row, Col, Typography, Alert,
  App as AntdApp, Result, Descriptions, Tag,
} from 'antd';
import { DatabaseOutlined, ThunderboltOutlined, KeyOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { setupAPI, SetupDefaults } from '../../services/api/setup';

const { Title, Text } = Typography;

const DB_TYPES = [
  { label: 'MySQL / MariaDB', value: 'mysql', driver: 'mysql+pymysql', port: '3306', suffix: '?charset=utf8mb4' },
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

const SetupWizard: React.FC<{ defaults?: SetupDefaults; onDone: () => void }> = ({ defaults, onDone }) => {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [current, setCurrent] = useState(0);
  const [dbType, setDbType] = useState(defaults?.db_type || 'mysql');
  const [testing, setTesting] = useState(false);
  const [dbTested, setDbTested] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // 由后端下发的预填默认值（容器内会给出 abm-mariadb / abm-redis 等）
  const initialValues = {
    dbType: defaults?.db_type || 'mysql',
    host: defaults?.db_host || '127.0.0.1',
    port: defaults?.db_port || '3306',
    database: defaults?.db_name || 'abm',
    username: defaults?.db_user || 'root',
    redisUrl: defaults?.redis_url || '',
  };

  const steps = [
    { title: '数据库', icon: <DatabaseOutlined /> },
    { title: 'Redis', icon: <ThunderboltOutlined /> },
    { title: '许可证', icon: <KeyOutlined /> },
    { title: '确认', icon: <CheckCircleOutlined /> },
  ];

  const handleTestDb = async () => {
    try {
      await form.validateFields(['dbType', 'host', 'port', 'database', 'username', 'sqlitePath']);
    } catch {
      return;
    }
    setTesting(true);
    const res = await setupAPI.testDb(buildDbUri(form.getFieldsValue(true)));
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
    const res = await setupAPI.save({ database_uri: buildDbUri(v), redis_url: v.redisUrl || '' });
    setSaving(false);
    if (!res.success) {
      message.error(`保存失败：${res.error}`);
      return;
    }
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
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <Title level={3} style={{ marginBottom: 4 }}>系统初始化</Title>
        <Text type="secondary">首次启动，请配置必要的连接信息，完成后系统将自动重启。</Text>
        {defaults?.in_docker && (
          <div style={{ marginTop: 8 }}>
            <Tag color="blue">容器部署</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>已按容器服务名预填，通常只需补全密码</Text>
          </div>
        )}
      </div>

      <Steps current={current} items={steps} size="small" style={{ marginBottom: 28 }} />

      <Form form={form} layout="vertical" requiredMark={false} initialValues={initialValues}>
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
              <Row gutter={12}>
                <Col span={16}>
                  <Form.Item name="host" label="主机" rules={[{ required: true, message: '请输入主机' }]}>
                    <Input onChange={() => setDbTested(false)} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="port" label="端口" rules={[{ required: true, message: '请输入端口' }]}>
                    <Input onChange={() => setDbTested(false)} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="database" label="数据库名" rules={[{ required: true, message: '请输入数据库名' }]}>
                <Input onChange={() => setDbTested(false)} />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="username" label="用户名">
                    <Input onChange={() => setDbTested(false)} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="password" label="密码">
                    <Input.Password placeholder="请输入数据库密码" onChange={() => setDbTested(false)} />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
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
          <Descriptions column={1} size="small" bordered styles={{ label: { width: 90 } }}>
            <Descriptions.Item label="数据库">
              <Text code style={{ wordBreak: 'break-all' }}>{buildDbUri(form.getFieldsValue(true))}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Redis">
              {form.getFieldValue('redisUrl') || <Text type="secondary">未配置（无缓存模式）</Text>}
            </Descriptions.Item>
          </Descriptions>
          <Alert
            type="warning" showIcon style={{ marginTop: 16 }}
            message="保存后系统将写入配置并自动重启，期间服务短暂不可用。"
          />
        </div>
      </Form>

      {/* 操作区：测试连接 + 上一步/下一步 */}
      <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {current === 0 && (
            <Button onClick={handleTestDb} loading={testing}>
              {dbTested ? '✓ 连接正常' : '测试连接'}
            </Button>
          )}
          {current === 1 && <Button onClick={handleTestRedis} loading={testing}>测试连接</Button>}
        </div>
        <div>
          {current > 0 && <Button onClick={prev} style={{ marginRight: 8 }}>上一步</Button>}
          {current < steps.length - 1 ? (
            <Button type="primary" onClick={next}>下一步</Button>
          ) : (
            <Button type="primary" onClick={handleSave} loading={saving}>保存并启动</Button>
          )}
        </div>
      </div>
    </CenteredCard>
  );
};

const CenteredCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--ant-color-bg-layout, #f5f5f5)' }}>
    <Card style={{ width: 600, maxWidth: '100%' }} variant="outlined">{children}</Card>
  </div>
);

export default SetupWizard;
