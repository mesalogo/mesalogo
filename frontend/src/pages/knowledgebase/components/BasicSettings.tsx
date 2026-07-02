import React, { useState, useEffect } from 'react';
import { App, Card, Form, Input, Button, Space, Typography, Alert } from 'antd';
import { SaveOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import knowledgeAPI from '../../../services/api/knowledge';

const { Text } = Typography;
const { TextArea } = Input;

const BasicSettings = ({ knowledgeId, knowledgeData, onUpdate }) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const [basicForm] = Form.useForm();

  // 设置表单初始值
  useEffect(() => {
    if (knowledgeData) {
      basicForm.setFieldsValue({
        name: knowledgeData.name,
        description: knowledgeData.description || '',
      });
    }
  }, [knowledgeData, basicForm]);

  // 保存基本信息
  const handleBasicSubmit = async (values) => {
    try {
      setSaving(true);
      const response = await knowledgeAPI.update(knowledgeId, values);
      if (response.success) {
        message.success(t('kbBasic.saveSuccess'));
        if (onUpdate) {
          onUpdate(); // 刷新父组件数据
        }
      } else {
        message.error(t('kbBasic.saveFailed', { error: response.message }));
      }
    } catch (error) {
      message.error(t('kbBasic.saveFailed', { error: error.message }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title={
        <Space>
          <InfoCircleOutlined />
          <span>{t('kbBasic.basicInfo')}</span>
        </Space>
      }
      extra={
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={() => basicForm.submit()}
        >
          {t('kbBasic.save')}
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
          label={t('kbBasic.name')}
          rules={[
            { required: true, message: t('kbBasic.nameRequired') },
            { max: 100, message: t('kbBasic.nameMaxLength') }
          ]}
        >
          <Input placeholder={t('kbBasic.namePlaceholder')} />
        </Form.Item>

        <Form.Item
          name="description"
          label={t('kbBasic.description')}
          rules={[
            { max: 500, message: t('kbBasic.descriptionMaxLength') }
          ]}
        >
          <TextArea
            rows={4}
            placeholder={t('kbBasic.descriptionPlaceholder')}
            showCount
            maxLength={500}
          />
        </Form.Item>

        {knowledgeData && (
          <Alert
            message={t('kbBasic.kbInfo')}
            description={
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Text type="secondary">ID: {knowledgeData.id}</Text>
                <Text type="secondary">
                  {t('kbBasic.createdAt', { time: knowledgeData.created_at ? new Date(knowledgeData.created_at).toLocaleString() : '-' })}
                </Text>
                <Text type="secondary">
                  {t('kbBasic.updatedAt', { time: knowledgeData.updated_at ? new Date(knowledgeData.updated_at).toLocaleString() : '-' })}
                </Text>
              </Space>
            }
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Form>
    </Card>
  );
};

export default BasicSettings;
