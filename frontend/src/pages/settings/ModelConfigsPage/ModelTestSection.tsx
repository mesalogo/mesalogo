import React from 'react';
import {
  Form,
  Select,
  Input,
  Button,
  Space,
  Alert,
  Row,
  Col,
  Typography,
  Tooltip,
  Tag
} from 'antd';
import {
  ThunderboltOutlined,
  SendOutlined,
  UndoOutlined,
  CopyOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// 获取provider翻译名称的函数
const getProviderName = (provider, t) => {
  const key = `modelConfig.provider.${provider}`;
  const translated = t(key);
  // 如果翻译key不存在，返回原始provider名称
  return translated === key ? provider : translated;
};

const ModelTestSection = ({
  form,
  modelConfigs,
  loading,
  status,
  result,
  onTest,
  onCopy,
  onReset
}) => {
  const { t } = useTranslation();
  
  return (
    <div className="model-test-section">
      {/* 测试区域标题 */}
      <div style={{ marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          <ThunderboltOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          {t('modelConfig.test.title')}
        </Title>
      </div>
      <Row gutter={24}>
        {/* 左侧：测试表单 */}
        <Col xs={24} md={12}>
          <Form form={form} layout="vertical">
            <Form.Item
              name="modelId"
              label={t('modelConfig.test.selectModel')}
              rules={[{ required: true, message: t('modelConfig.test.selectModelRequired') }]}
            >
              <Select placeholder={t('modelConfig.test.selectModelPlaceholder')} showSearch optionFilterProp="children">
                {/* 按 provider 分组显示模型 */}
                {(() => {
                  const groups: Record<string, any[]> = {};
                  modelConfigs.forEach(model => {
                    const provider = model.provider || 'other';
                    if (!groups[provider]) groups[provider] = [];
                    groups[provider].push(model);
                  });
                  return Object.entries(groups).map(([provider, models]) => (
                    <Select.OptGroup key={provider} label={getProviderName(provider, t)}>
                      {models.map(model => (
                      <Option key={model.id} value={model.id}>
                        {model.name} ({model.model_id})
                        {model.is_default_text && (
                          <Tag color="blue" style={{ marginLeft: 8 }}>
                            {t('modelConfig.tags.defaultText')}
                          </Tag>
                        )}
                        {model.is_default_embedding && (
                          <Tag color="green" style={{ marginLeft: 8 }}>
                            {t('modelConfig.tags.defaultEmbedding')}
                          </Tag>
                        )}
                        {model.is_default_rerank && (
                          <Tag color="orange" style={{ marginLeft: 8 }}>
                            {t('modelConfig.tags.defaultRerank')}
                          </Tag>
                        )}
                      </Option>
                      ))}
                    </Select.OptGroup>
                  ));
                })()}
              </Select>
            </Form.Item>
            
            <Form.Item
              name="systemPrompt"
              label={
                <span>
                  {t('modelConfig.test.systemPrompt.label')}
                  <Tooltip title={t('modelConfig.test.systemPrompt.tooltip')}>
                    <InfoCircleOutlined style={{ marginLeft: 8 }} />
                  </Tooltip>
                </span>
              }
            >
              <TextArea
                rows={2}
                placeholder={t('modelConfig.test.systemPrompt.placeholder')}
              />
            </Form.Item>
            
            <Form.Item
              name="prompt"
              label={t('modelConfig.test.testPrompt.label')}
              rules={[{ required: true, message: t('modelConfig.test.testPromptRequired') }]}
            >
              <TextArea
                rows={3}
                placeholder={t('modelConfig.test.testPrompt.placeholder')}
              />
            </Form.Item>
            
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={onTest}
                  loading={loading}
                >
                  {t('modelConfig.test.send')}
                </Button>
                <Button icon={<UndoOutlined />} onClick={onReset}>
                  {t('common.reset')}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Col>
        
        {/* 右侧：测试结果 */}
        <Col xs={24} md={12}>
          <div style={{ marginBottom: 16 }}>
            <Title level={5}>{t('modelConfig.test.resultTitle')}</Title>
          </div>
          
          {result || status === 'loading' ? (
            <div>
              <div style={{
                border: '1px solid var(--custom-border)',
                borderRadius: '4px',
                padding: '12px',
                minHeight: '200px',
                maxHeight: '300px',
                overflowY: 'auto',
                backgroundColor: 'var(--custom-header-bg)',
                marginBottom: '16px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                position: 'relative'
              }}>
                {result}
                {(status === 'streaming' || status === 'loading') && (
                  <span style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '14px',
                    backgroundColor: '#1677ff',
                    animation: 'blink 1s infinite',
                    marginLeft: '2px',
                    verticalAlign: 'middle',
                    position: 'absolute'
                  }} />
                )}
              </div>
              
              <Space>
                <Button icon={<CopyOutlined />} onClick={onCopy}>
                  {t('modelConfig.test.copyResult')}
                </Button>
              </Space>
            </div>
          ) : (
            <Alert
              title={t('modelConfig.test.waitingTitle')}
              description={t('modelConfig.test.waitingDescription')}
              type="info"
              showIcon
            />
          )}
        </Col>
      </Row>
      
      {/* CSS动画样式 */}
      <style>{`
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default React.memo(ModelTestSection);
