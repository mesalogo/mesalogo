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
import api from '../../../services/api/axios';

const { Text } = Typography;
const { Option } = Select;

const PartitionSettingsTab = ({ config, onConfigUpdate, loading }: any) => {
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
        console.error('加载分区策略失败:', data.message);
      }
    } catch (error) {
      console.error('加载分区策略失败:', error);
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
        message.success('分区配置保存成功');
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
        message.error(`保存失败: ${data.message}`);
      }
    } catch (error) {
      console.error('保存分区配置失败:', error);
      message.error('保存分区配置失败');
    } finally {
      setSaving(false);
    }
  };







  return (
    <div>
      {/* 当前配置状态 */}
      <Card
        title="当前配置状态"
        style={{ marginBottom: '24px' }}
      >
        <Row gutter={16}>
          <Col span={6}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>图谱增强状态</Text>
              <div style={{ marginTop: '4px' }}>
                <Tag color={config?.enabled ? 'success' : 'error'}>
                  {config?.enabled ? '已启用' : '未启用'}
                </Tag>
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>当前框架</Text>
              <div style={{ marginTop: '4px' }}>
                <Text strong>{config?.framework || 'N/A'}</Text>
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>分区策略</Text>
              <div style={{ marginTop: '4px' }}>
                <Text strong>
                  {strategies.find(s => s.key === config?.partition_strategy)?.name || config?.partition_strategy || 'N/A'}
                </Text>
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>消息同步</Text>
              <div style={{ marginTop: '4px' }}>
                <Tag color={config?.message_sync_strategy === 'disabled' ? 'default' : 'blue'}>
                  {config?.message_sync_strategy === 'disabled' ? '已关闭' :
                   config?.message_sync_strategy === 'message_complete' ? '消息完成' :
                   config?.message_sync_strategy === 'round_complete' ? '轮次完成' : '未配置'}
                </Tag>
              </div>
            </div>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginTop: '16px' }}>
          <Col span={24}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>最后更新</Text>
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
        title="记忆配置"
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
              保存配置
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => form.resetFields()}
              disabled={saving}
            >
              重置
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
                label="分区策略"
                rules={[{ required: true, message: '请选择分区策略' }]}
                extra="选择记忆数据的分区方式，影响智能体间的记忆共享范围"
              >
                <Select
                  placeholder="选择记忆分区策略"
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
                              推荐
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
                label="消息自动同步策略"
                rules={[{ required: true, message: '请选择消息同步策略' }]}
                extra="控制何时将对话消息自动同步到图谱记忆"
              >
                <Select
                  placeholder="选择消息同步策略"
                  optionLabelProp="label"
                >
                  <Option
                    value="disabled"
                    label="关闭"
                  >
                    <div style={{ padding: '4px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                        <Text strong>关闭</Text>
                        <Tag color="orange" style={{ marginLeft: 8 }}>
                          默认
                        </Tag>
                      </div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        不自动同步消息到图谱记忆
                      </Text>
                    </div>
                  </Option>
                  <Option
                    value="message_complete"
                    label="消息完成"
                  >
                    <div style={{ padding: '4px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                        <Text strong>消息完成</Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        每条智能体消息完成后立即同步
                      </Text>
                    </div>
                  </Option>
                  <Option
                    value="round_complete"
                    label="轮次完成"
                  >
                    <div style={{ padding: '4px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                        <Text strong>轮次完成</Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        完整对话轮次（用户+智能体）完成后同步
                      </Text>
                    </div>
                  </Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {!config?.enabled && (
            <Alert
              message="图谱增强未启用"
              description="请先在图谱增强设置中启用图谱增强功能，才能配置分区策略。"
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
