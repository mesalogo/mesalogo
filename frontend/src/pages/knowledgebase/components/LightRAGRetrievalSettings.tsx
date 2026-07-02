import React, { useState, useEffect } from 'react';
import { Form, InputNumber, Divider, Space, Typography, App, Button, Card, Radio, Alert, Select } from 'antd';
import { SearchOutlined, ThunderboltOutlined, GlobalOutlined, AimOutlined, BranchesOutlined, MergeCellsOutlined, NumberOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import knowledgeAPI from '../../../services/api/knowledge';

const { Text, Title } = Typography;

interface LightRAGRetrievalSettingsProps {
  knowledgeId: string;
  onSettingsSaved?: () => void;
}

const LightRAGRetrievalSettings: React.FC<LightRAGRetrievalSettingsProps> = ({ knowledgeId, onSettingsSaved }) => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [queryMode, setQueryMode] = useState('hybrid');

  useEffect(() => {
    if (knowledgeId) {
      fetchSettings();
    }
  }, [knowledgeId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await knowledgeAPI.getSearchConfig(knowledgeId);
      
      if (response.success) {
        const config = response.data || {};
        const mode = config.query_mode || 'hybrid';
        
        setQueryMode(mode);
        
        form.setFieldsValue({
          query_mode: mode,
          top_k: config.top_k || 10,
          response_type: config.response_type || 'Multiple Paragraphs'
        });
      }
    } catch (error) {
      console.error('Failed to fetch LightRAG retrieval configuration:', error);
      message.error(t('lightragRetrieval.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const values = await form.validateFields();
      
      const response = await knowledgeAPI.updateSearchConfig(knowledgeId, {
        query_mode: values.query_mode,
        top_k: values.top_k,
        response_type: values.response_type
      });
      
      if (response.success) {
        message.success(t('lightragRetrieval.saveSuccess'));
        if (onSettingsSaved) {
          onSettingsSaved();
        }
      } else {
        message.error(response.message || t('lightragRetrieval.saveFailedDefault'));
      }
    } catch (error) {
      console.error('Failed to save LightRAG retrieval configuration:', error);
      message.error(t('lightragRetrieval.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const getModeIcon = (m: string) => {
    switch (m) {
      case 'naive': return <ThunderboltOutlined />;
      case 'local': return <AimOutlined />;
      case 'global': return <GlobalOutlined />;
      case 'hybrid': return <BranchesOutlined />;
      case 'mix': return <MergeCellsOutlined />;
      default: return <SearchOutlined />;
    }
  };

  return (
    <div style={{ padding: '0' }}>
      <Card 
        title={
          <Space>
            <SearchOutlined />
            <span>{t('lightragRetrieval.cardTitle')}</span>
          </Space>
        }
        extra={
          <Button 
            type="primary" 
            onClick={handleSave}
            loading={saving}
          >
            {t('lightragRetrieval.saveConfig')}
          </Button>
        }
        loading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            query_mode: 'hybrid',
            top_k: 10,
            response_type: 'Multiple Paragraphs'
          }}
        >
          <Alert
            message={t('lightragRetrieval.infoTitle')}
            description={t('lightragRetrieval.infoDesc')}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          {/* 查询模式 */}
          <Divider>
            <Space>
              <ThunderboltOutlined />
              <Text strong>{t('lightragRetrieval.queryModeDivider')}</Text>
            </Space>
          </Divider>

          <Form.Item
            name="query_mode"
            label={t('lightragRetrieval.queryModeLabel')}
            tooltip={t('lightragRetrieval.queryModeTooltip')}
          >
            <Radio.Group onChange={(e) => setQueryMode(e.target.value)}>
              <Space direction="vertical">
                <Radio value="naive">
                  <Space>
                    {getModeIcon('naive')}
                    <Text strong>Naive</Text>
                    <Text type="secondary">{t('lightragRetrieval.mode.naiveDesc')}</Text>
                  </Space>
                </Radio>
                <Radio value="local">
                  <Space>
                    {getModeIcon('local')}
                    <Text strong>Local</Text>
                    <Text type="secondary">{t('lightragRetrieval.mode.localDesc')}</Text>
                  </Space>
                </Radio>
                <Radio value="global">
                  <Space>
                    {getModeIcon('global')}
                    <Text strong>Global</Text>
                    <Text type="secondary">{t('lightragRetrieval.mode.globalDesc')}</Text>
                  </Space>
                </Radio>
                <Radio value="hybrid">
                  <Space>
                    {getModeIcon('hybrid')}
                    <Text strong>Hybrid</Text>
                    <Text type="secondary">{t('lightragRetrieval.mode.hybridDesc')}</Text>
                  </Space>
                </Radio>
                <Radio value="mix">
                  <Space>
                    {getModeIcon('mix')}
                    <Text strong>Mix</Text>
                    <Text type="secondary">{t('lightragRetrieval.mode.mixDesc')}</Text>
                  </Space>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          <Divider />

          {/* 检索参数 */}
          <Title level={5}>
            <Space>
              <NumberOutlined />
              {t('lightragRetrieval.paramsTitle')}
            </Space>
          </Title>

          <Form.Item
            name="top_k"
            label={
              <Space>
                <Text strong>{t('lightragRetrieval.topKLabel')}</Text>
                <Text type="secondary">{t('lightragRetrieval.topKSuffix')}</Text>
              </Space>
            }
            tooltip={t('lightragRetrieval.topKTooltip')}
          >
            <InputNumber
              min={1}
              max={50}
              style={{ width: '200px' }}
              placeholder={t('lightragRetrieval.topKPlaceholder')}
            />
          </Form.Item>

          <Form.Item
            name="response_type"
            label={
              <Space>
                <Text strong>{t('lightragRetrieval.responseTypeLabel')}</Text>
                <Text type="secondary">{t('lightragRetrieval.responseTypeSuffix')}</Text>
              </Space>
            }
            tooltip={t('lightragRetrieval.responseTypeTooltip')}
          >
            <Select style={{ width: '300px' }}>
              <Select.Option value="Multiple Paragraphs">{t('lightragRetrieval.responseType.multipleParagraphs')} (Multiple Paragraphs)</Select.Option>
              <Select.Option value="Single Paragraph">{t('lightragRetrieval.responseType.singleParagraph')} (Single Paragraph)</Select.Option>
              <Select.Option value="List">{t('lightragRetrieval.responseType.list')} (List)</Select.Option>
            </Select>
          </Form.Item>

          <Divider />

          <div style={{ 
            backgroundColor: 'var(--custom-hover-bg)', 
            padding: '16px', 
            borderRadius: '4px',
            marginTop: '16px'
          }}>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              <div style={{ marginBottom: '8px' }}>
                <Text strong>{t('lightragRetrieval.modeExplainTitle')}</Text>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
                <li><Text strong>Naive：</Text>{t('lightragRetrieval.modeExplain.naive')}</li>
                <li><Text strong>Local：</Text>{t('lightragRetrieval.modeExplain.local')}</li>
                <li><Text strong>Global：</Text>{t('lightragRetrieval.modeExplain.global')}</li>
                <li><Text strong>Hybrid：</Text>{t('lightragRetrieval.modeExplain.hybrid')}</li>
                <li><Text strong>Mix：</Text>{t('lightragRetrieval.modeExplain.mix')}</li>
              </ul>
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LightRAGRetrievalSettings;
