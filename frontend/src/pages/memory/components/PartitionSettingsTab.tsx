import { useState, useEffect } from 'react';
import {
  Form,
  Select,
  Button,
  Card,
  Typography,
  Space,
  Alert,
  Row,
  Col,
  Tag,
  App
} from 'antd';
import {
  SaveOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api/axios';

const { Text } = Typography;
const { Option } = Select;

const PartitionSettingsTab = ({ config, onConfigUpdate, loading }: any) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [strategies, setStrategies] = useState([]);

  // 加载可用的分区策略
  const loadStrategies = async () => {
    try {
      const response = await api.get('/memory/partition-strategies');
      const data = response.data;

      if (data.success) {
        setStrategies(data.data);
      } else {
        console.error(t('memory.config.loadStrategiesFailed', { reason: data.message }));
      }
    } catch (error) {
      console.error(t('memory.config.loadStrategiesFailed', { reason: error }));
    }
  };

  // 初始化
  useEffect(() => {
    loadStrategies();
  }, []);

  // 当配置更新时，更新表单值
  useEffect(() => {
    if (config) {
      form.setFieldsValue({
        partition_strategy: config.partition_strategy,
        server_url: config.server_url,
        message_sync_strategy: config.message_sync_strategy || 'disabled'
      });
    }
  }, [config, form]);

  // 保存配置
  const handleSave = async (values) => {
    try {
      setSaving(true);

      const response = await api.post('/memory/partition-config', values);
      const data = response.data;

      if (data.success) {
        message.success(t('memory.config.saveSuccess'));
        // 如果返回了更新后的配置数据，直接更新表单
        if (data.data) {
          form.setFieldsValue({
            partition_strategy: data.data.partition_strategy,
            server_url: data.data.server_url,
            message_sync_strategy: data.data.message_sync_strategy || 'disabled'
          });
        }
        onConfigUpdate && onConfigUpdate();
      } else {
        message.error(t('memory.config.saveFailedWithReason', { reason: data.message }));
      }
    } catch (error) {
      console.error('Failed to save partition configuration:', error);
      message.error(t('memory.config.saveFailed'));
    } finally {
      setSaving(false);
    }
  };







  return (
    <div>
      {/* 当前配置状态 */}
      <Card
        title={t('memory.config.currentStatus')}
        style={{ marginBottom: '24px' }}
      >
        <Row gutter={16}>
          <Col span={6}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>{t('memory.config.graphStatus')}</Text>
              <div style={{ marginTop: '4px' }}>
                <Tag color={config?.enabled ? 'success' : 'error'}>
                  {config?.enabled ? t('memory.config.statusEnabled') : t('memory.config.statusDisabled')}
                </Tag>
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>{t('memory.config.currentFramework')}</Text>
              <div style={{ marginTop: '4px' }}>
                <Text strong>{config?.framework || 'N/A'}</Text>
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>{t('memory.config.partitionStrategy')}</Text>
              <div style={{ marginTop: '4px' }}>
                <Text strong>
                  {strategies.find(s => s.key === config?.partition_strategy)?.name || config?.partition_strategy || 'N/A'}
                </Text>
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>{t('memory.config.messageSync')}</Text>
              <div style={{ marginTop: '4px' }}>
                <Tag color={config?.message_sync_strategy === 'disabled' ? 'default' : 'blue'}>
                  {config?.message_sync_strategy === 'disabled' ? t('memory.config.syncDisabled') :
                   config?.message_sync_strategy === 'message_complete' ? t('memory.config.syncMessageComplete') :
                   config?.message_sync_strategy === 'round_complete' ? t('memory.config.syncRoundComplete') : t('memory.config.syncNotConfigured')}
                </Tag>
              </div>
            </div>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginTop: '16px' }}>
          <Col span={24}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>{t('memory.config.lastUpdate')}</Text>
              <div style={{ marginTop: '4px' }}>
                <Text type="secondary">
                  {config?.updated_at ? new Date(config.updated_at).toLocaleString() : 'N/A'}
                </Text>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 记忆配置 */}
      <Card
        title={t('memory.config.memoryConfig')}
        style={{ marginBottom: '24px' }}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => form.submit()}
              loading={saving}
              disabled={!config?.enabled}
            >
              {t('memory.config.saveConfig')}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => form.resetFields()}
              disabled={saving}
            >
              {t('memory.config.reset')}
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          disabled={loading || !config?.enabled}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="partition_strategy"
                label={t('memory.config.partitionStrategy')}
                rules={[{ required: true, message: t('memory.config.selectStrategy') }]}
                extra={t('memory.config.strategyHint')}
              >
                <Select
                  placeholder={t('memory.config.selectStrategyPlaceholder')}
                  optionLabelProp="label"
                >
                  {strategies.map(strategy => (
                    <Option
                      key={strategy.key}
                      value={strategy.key}
                      label={strategy.name}
                    >
                      <div style={{ padding: '4px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                          <Text strong>{strategy.name}</Text>
                          {strategy.default && (
                            <Tag color="blue" style={{ marginLeft: 8 }}>
                              {t('common.recommended')}
                            </Tag>
                          )}
                        </div>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {strategy.description}
                        </Text>
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="message_sync_strategy"
                label={t('memory.config.syncStrategy')}
                rules={[{ required: true, message: t('memory.config.selectSyncStrategy') }]}
                extra={t('memory.config.syncStrategyHint')}
              >
                <Select
                  placeholder={t('memory.config.selectSyncStrategy')}
                  optionLabelProp="label"
                >
                  <Option
                    value="disabled"
                    label={t('memory.config.syncDisabled')}
                  >
                    <div style={{ padding: '4px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                        <Text strong>{t('memory.config.syncDisabled')}</Text>
                        <Tag color="orange" style={{ marginLeft: 8 }}>
                          {t('common.default')}
                        </Tag>
                      </div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {t('memory.config.syncDisabledDesc')}
                      </Text>
                    </div>
                  </Option>
                  <Option
                    value="message_complete"
                    label={t('memory.config.syncMessageComplete')}
                  >
                    <div style={{ padding: '4px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                        <Text strong>{t('memory.config.syncMessageComplete')}</Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {t('memory.config.syncMessageCompleteDesc')}
                      </Text>
                    </div>
                  </Option>
                  <Option
                    value="round_complete"
                    label={t('memory.config.syncRoundComplete')}
                  >
                    <div style={{ padding: '4px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                        <Text strong>{t('memory.config.syncRoundComplete')}</Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {t('memory.config.syncRoundCompleteDesc')}
                      </Text>
                    </div>
                  </Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {!config?.enabled && (
            <Alert
              message={t('memory.config.graphNotEnabledTitle')}
              description={t('memory.config.graphNotEnabledDesc')}
              type="warning"
              showIcon
            />
          )}
        </Form>
      </Card>


    </div>
  );
};

export default PartitionSettingsTab;
