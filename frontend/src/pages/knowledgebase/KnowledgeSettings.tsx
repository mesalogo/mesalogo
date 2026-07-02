import React, { useState, useEffect } from 'react';
import { App, Card, Form, Input, Button, Space, Typography, Alert, Empty, Tabs, Spin } from 'antd';
import { SaveOutlined, InfoCircleOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import ChunkSettings from './components/ChunkSettings';
import knowledgeAPI from '../../services/api/knowledge';

const { Title, Text } = Typography;
const { TextArea } = Input;

const KnowledgeSettings = ({ selectedKnowledgeId: propKnowledgeId }) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [basicForm] = Form.useForm();
  const [knowledgeData, setKnowledgeData] = useState(null);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState(propKnowledgeId || null);

  // 当父组件传递的知识库ID变化时，更新本地状态
  useEffect(() => {
    if (propKnowledgeId) {
      setSelectedKnowledgeId(propKnowledgeId);
    }
  }, [propKnowledgeId]);

  // 获取知识库详情
  useEffect(() => {
    if (selectedKnowledgeId) {
      fetchKnowledgeData();
    }
  }, [selectedKnowledgeId]);

  const fetchKnowledgeData = async () => {
    try {
      setLoading(true);
      const response = await knowledgeAPI.getById(selectedKnowledgeId);
      if (response.success) {
        setKnowledgeData(response.data);
        // 设置基本信息表单
        basicForm.setFieldsValue({
          name: response.data.name,
          description: response.data.description || '',
        });
      } else {
        message.error(t('knowledgeSettings.fetchFailed', { reason: response.message }));
      }
    } catch (error) {
      message.error(t('knowledgeSettings.fetchFailed', { reason: error.message }));
    } finally {
      setLoading(false);
    }
  };

  // 保存基本信息
  const handleBasicSubmit = async (values) => {
    try {
      setSaving(true);
      const response = await knowledgeAPI.update(selectedKnowledgeId, values);
      if (response.success) {
        message.success(t('knowledgeSettings.saveSuccess'));
        fetchKnowledgeData(); // 刷新数据
      } else {
        message.error(t('knowledgeSettings.saveFailed', { reason: response.message }));
      }
    } catch (error) {
      message.error(t('knowledgeSettings.saveFailed', { reason: error.message }));
    } finally {
      setSaving(false);
    }
  };

  // 渲染基本设置
  const renderBasicSettings = () => {
    return (
      <Card
        title={
          <Space>
            <InfoCircleOutlined />
            <span>{t('knowledgeSettings.basicInfoTitle')}</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={() => basicForm.submit()}
          >
            {t('knowledgeSettings.save')}
          </Button>
        }
      >
        <Form
          form={basicForm}
          layout="vertical"
          onFinish={handleBasicSubmit}
        >
          <Form.Item
            name="name"
            label={t('knowledgeSettings.nameLabel')}
            rules={[
              { required: true, message: t('knowledgeSettings.nameRequired') },
              { max: 100, message: t('knowledgeSettings.nameMaxLength') }
            ]}
          >
            <Input placeholder={t('knowledgeSettings.namePlaceholder')} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('knowledgeSettings.descriptionLabel')}
            rules={[
              { max: 500, message: t('knowledgeSettings.descriptionMaxLength') }
            ]}
          >
            <TextArea
              rows={4}
              placeholder={t('knowledgeSettings.descriptionPlaceholder')}
              showCount
              maxLength={500}
            />
          </Form.Item>

          {knowledgeData && (
            <>
              <Alert
                message={t('knowledgeSettings.infoTitle')}
                description={
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    <Text type="secondary">ID: {knowledgeData.id}</Text>
                    <Text type="secondary">
                      {t('knowledgeSettings.createdAt', { value: knowledgeData.created_at ? new Date(knowledgeData.created_at).toLocaleString() : '-' })}
                    </Text>
                    <Text type="secondary">
                      {t('knowledgeSettings.updatedAt', { value: knowledgeData.updated_at ? new Date(knowledgeData.updated_at).toLocaleString() : '-' })}
                    </Text>
                  </Space>
                }
                type="info"
                showIcon
                style={{ marginTop: 16 }}
              />
            </>
          )}
        </Form>
      </Card>
    );
  };

  // 渲染访问控制（暂未实现，显示占位）
  const renderAccessControl = () => {
    return (
      <Card
        title={
          <Space>
            <LockOutlined />
            <span>{t('knowledgeSettings.accessControlTitle')}</span>
          </Space>
        }
      >
        <Alert
          message={t('knowledgeSettings.featureInDev')}
          description={t('knowledgeSettings.featureInDevDesc')}
          type="info"
          showIcon
        />
      </Card>
    );
  };

  // 如果没有选中知识库
  if (!selectedKnowledgeId) {
    return (
      <Card>
        <Empty
          description={
            <Space orientation="vertical" align="center">
              <Text type="secondary">{t('knowledgeSettings.selectFirst')}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('knowledgeSettings.selectFirstHint')}
              </Text>
            </Space>
          }
        />
      </Card>
    );
  }

  // 加载中
  if (loading && !knowledgeData) {
    return (
      <Card>
        <Spin tip={t('knowledgeSettings.loading')} />
      </Card>
    );
  }

  return (
    <div>
      {knowledgeData && (
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            {knowledgeData.name}
          </Title>
          {knowledgeData.description && (
            <Text type="secondary">{knowledgeData.description}</Text>
          )}
        </div>
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'basic',
            label: t('knowledgeSettings.tab.basic'),
            children: renderBasicSettings()
          },
          {
            key: 'chunking',
            label: t('knowledgeSettings.tab.chunking'),
            children: <ChunkSettings knowledgeId={selectedKnowledgeId} />
          },
          {
            key: 'access',
            label: t('knowledgeSettings.tab.access'),
            children: renderAccessControl()
          }
        ]}
      />
    </div>
  );
};

export default KnowledgeSettings;
