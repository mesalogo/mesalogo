import React, { useState } from 'react';
import {
  Steps, Form, Input, Select, Button, Card, Row, Col, Typography, Alert,
  App as AntdApp, Result, Descriptions, Tag,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { DatabaseOutlined, ThunderboltOutlined, KeyOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { setupAPI, SetupDefaults } from '../../services/api/setup';

const { Title, Text } = Typography;

function useDbTypes() {
  const { t } = useTranslation('setup');
  return [
    { label: 'MySQL / MariaDB', value: 'mysql', driver: 'mysql+pymysql', port: '3306', suffix: '?charset=utf8mb4' },
    { label: 'PostgreSQL', value: 'postgresql', driver: 'postgresql+psycopg2', port: '5432', suffix: '' },
    { label: t('setup.dbType.sqlite'), value: 'sqlite', driver: 'sqlite', port: '', suffix: '' },
  ];
}

/** Builds the SQLAlchemy connection URI from the form values. */
function buildDbUri(v: any, dbTypes: ReturnType<typeof useDbTypes>): string {
  const dbTypeInfo = dbTypes.find((d) => d.value === v.dbType) || dbTypes[0];
  if (v.dbType === 'sqlite') {
    return `sqlite:///${v.sqlitePath || 'data/app.db'}`;
  }
  const auth = v.username ? `${v.username}:${encodeURIComponent(v.password || '')}@` : '';
  return `${dbTypeInfo.driver}://${auth}${v.host}:${v.port}/${v.database}${dbTypeInfo.suffix}`;
}

const SetupWizard: React.FC<{ defaults?: SetupDefaults; onDone: () => void }> = ({ defaults, onDone }) => {
  const { t } = useTranslation('setup');
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [current, setCurrent] = useState(0);
  const [dbType, setDbType] = useState(defaults?.db_type || 'mysql');
  const [testing, setTesting] = useState(false);
  const [dbTested, setDbTested] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const dbTypes = useDbTypes();

  // Prefilled by the backend (containers ship values like abm-mariadb / abm-redis).
  const initialValues = {
    dbType: defaults?.db_type || 'mysql',
    host: defaults?.db_host || '127.0.0.1',
    port: defaults?.db_port || '3306',
    database: defaults?.db_name || 'abm',
    username: defaults?.db_user || 'root',
    redisUrl: defaults?.redis_url || '',
  };

  const steps = [
    { title: t('setup.step.database'), icon: <DatabaseOutlined /> },
    { title: t('setup.step.redis'), icon: <ThunderboltOutlined /> },
    { title: t('setup.step.license'), icon: <KeyOutlined /> },
    { title: t('setup.step.confirm'), icon: <CheckCircleOutlined /> },
  ];

  const handleTestDb = async () => {
    try {
      await form.validateFields(['dbType', 'host', 'port', 'database', 'username', 'sqlitePath']);
    } catch {
      return;
    }
    setTesting(true);
    const res = await setupAPI.testDb(buildDbUri(form.getFieldsValue(true), dbTypes));
    setTesting(false);
    if (res.success) {
      setDbTested(true);
      message.success(t('setup.msg.dbTestSuccess'));
    } else {
      setDbTested(false);
      message.error(t('setup.msg.dbTestFailed', { error: res.error }));
    }
  };

  const handleTestRedis = async () => {
    const url = form.getFieldValue('redisUrl');
    if (!url) {
      message.info(t('setup.msg.redisUrlEmpty'));
      return;
    }
    setTesting(true);
    const res = await setupAPI.testRedis(url);
    setTesting(false);
    res.success
      ? message.success(t('setup.msg.redisTestSuccess'))
      : message.error(t('setup.msg.redisTestFailed', { error: res.error }));
  };

  const handleSave = async () => {
    const v = form.getFieldsValue(true);
    setSaving(true);
    const res = await setupAPI.save({ database_uri: buildDbUri(v, dbTypes), redis_url: v.redisUrl || '' });
    setSaving(false);
    if (!res.success) {
      message.error(t('setup.msg.saveFailed', { error: res.error }));
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
        // Backend is briefly unreachable during restart; keep polling.
      }
      if (tries > 60) {
        clearInterval(timer);
        message.warning(t('setup.msg.restartSlow'));
      }
    }, 2000);
  };

  const next = () => {
    if (current === 0 && !dbTested) {
      message.warning(t('setup.msg.dbTestRequired'));
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
          title={t('setup.restarting.title')}
          subTitle={t('setup.restarting.subtitle')}
        />
      </CenteredCard>
    );
  }

  return (
    <CenteredCard>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <Title level={3} style={{ marginBottom: 4 }}>{t('setup.title')}</Title>
        <Text type="secondary">{t('setup.subtitle')}</Text>
        {defaults?.in_docker && (
          <div style={{ marginTop: 8 }}>
            <Tag color="blue">{t('setup.dockerTag')}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('setup.dockerHint')}</Text>
          </div>
        )}
      </div>

      <Steps current={current} items={steps} size="small" style={{ marginBottom: 28 }} />

      <Form form={form} layout="vertical" requiredMark={false} initialValues={initialValues}>
        {/* Step 1: Database */}
        <div style={{ display: current === 0 ? 'block' : 'none' }}>
          <Form.Item name="dbType" label={t('setup.form.dbTypeLabel')} rules={[{ required: true }]}>
            <Select
              options={dbTypes.map((d) => ({ label: d.label, value: d.value }))}
              onChange={(val) => {
                setDbType(val);
                setDbTested(false);
                const picked = dbTypes.find((d) => d.value === val);
                if (picked?.port) form.setFieldValue('port', picked.port);
              }}
            />
          </Form.Item>

          {dbType === 'sqlite' ? (
            <Form.Item name="sqlitePath" label={t('setup.form.sqlitePathLabel')} rules={[{ required: true, message: t('setup.form.sqlitePathRequired') }]}>
              <Input placeholder="data/app.db" onChange={() => setDbTested(false)} />
            </Form.Item>
          ) : (
            <>
              <Row gutter={12}>
                <Col span={16}>
                  <Form.Item name="host" label={t('setup.form.hostLabel')} rules={[{ required: true, message: t('setup.form.hostRequired') }]}>
                    <Input onChange={() => setDbTested(false)} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="port" label={t('setup.form.portLabel')} rules={[{ required: true, message: t('setup.form.portRequired') }]}>
                    <Input onChange={() => setDbTested(false)} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="database" label={t('setup.form.databaseLabel')} rules={[{ required: true, message: t('setup.form.databaseRequired') }]}>
                <Input onChange={() => setDbTested(false)} />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="username" label={t('setup.form.usernameLabel')}>
                    <Input onChange={() => setDbTested(false)} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="password" label={t('setup.form.passwordLabel')}>
                    <Input.Password placeholder={t('setup.form.passwordPlaceholder')} onChange={() => setDbTested(false)} />
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
            message={t('setup.redis.optionalHint')}
          />
          <Form.Item name="redisUrl" label={t('setup.redis.urlLabel')}>
            <Input placeholder="redis://127.0.0.1:6379/0" />
          </Form.Item>
        </div>

        {/* Step 3: License */}
        <div style={{ display: current === 2 ? 'block' : 'none' }}>
          <Alert
            type="info" showIcon
            message={t('setup.license.hint')}
          />
        </div>

        {/* Step 4: Confirm */}
        <div style={{ display: current === 3 ? 'block' : 'none' }}>
          <Descriptions column={1} size="small" bordered styles={{ label: { width: 90 } }}>
            <Descriptions.Item label={t('setup.confirm.dbLabel')}>
              <Text code style={{ wordBreak: 'break-all' }}>{buildDbUri(form.getFieldsValue(true), dbTypes)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('setup.confirm.redisLabel')}>
              {form.getFieldValue('redisUrl') || <Text type="secondary">{t('setup.confirm.redisNotConfigured')}</Text>}
            </Descriptions.Item>
          </Descriptions>
          <Alert
            type="warning" showIcon style={{ marginTop: 16 }}
            message={t('setup.confirm.restartWarning')}
          />
        </div>
      </Form>

      {/* Actions: test connection + prev/next */}
      <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {current === 0 && (
            <Button onClick={handleTestDb} loading={testing}>
              {dbTested ? t('setup.action.connectionOk') : t('setup.action.testConnection')}
            </Button>
          )}
          {current === 1 && <Button onClick={handleTestRedis} loading={testing}>{t('setup.action.testConnection')}</Button>}
        </div>
        <div>
          {current > 0 && <Button onClick={prev} style={{ marginRight: 8 }}>{t('setup.action.prev')}</Button>}
          {current < steps.length - 1 ? (
            <Button type="primary" onClick={next}>{t('setup.action.next')}</Button>
          ) : (
            <Button type="primary" onClick={handleSave} loading={saving}>{t('setup.action.saveAndStart')}</Button>
          )}
        </div>
      </div>
    </CenteredCard>
  );
};

const CenteredCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div data-testid="setup-wizard-shell" style={{ minHeight: '100vh', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--ant-color-bg-layout, #f5f5f5)' }}>
    <Card style={{ width: 600, maxWidth: '100%' }} variant="outlined">{children}</Card>
  </div>
);

export default SetupWizard;
