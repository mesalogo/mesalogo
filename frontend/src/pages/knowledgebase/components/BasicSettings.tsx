import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Space, Typography, message, Alert } from 'antd';
import { SaveOutlined, InfoCircleOutlined } from '@ant-design/icons';
import knowledgeAPI from '../../../services/api/knowledge';

const { Text } = Typography;
const { TextArea } = Input;

const BasicSettings = ({ knowledgeId, knowledgeData, onUpdate }) => {
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
        message.success('保存成功');
        if (onUpdate) {
          onUpdate(); // 刷新父组件数据
        }
      } else {
        message.error('保存失败: ' + response.message);
      }
    } catch (error) {
      message.error('保存失败: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title={
        <Space>
          <InfoCircleOutlined />
          <span>基本信息</span>
        </Space>
      }
      extra={
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={() => basicForm.submit()}
        >
          保存
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
          label="知识库名称"
          rules={[
            { required: true, message: '请输入知识库名称' },
            { max: 100, message: '名称不能超过100个字符' }
          ]}
        >
          <Input placeholder="请输入知识库名称" />
        </Form.Item>

        <Form.Item
          name="description"
          label="描述"
          rules={[
            { max: 500, message: '描述不能超过500个字符' }
          ]}
        >
          <TextArea
            rows={4}
            placeholder="请输入知识库描述（可选）"
            showCount
            maxLength={500}
          />
        </Form.Item>

        {knowledgeData && (
          <Alert
            message="知识库信息"
            description={
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Text type="secondary">ID: {knowledgeData.id}</Text>
                <Text type="secondary">
                  创建时间: {knowledgeData.created_at ? new Date(knowledgeData.created_at).toLocaleString() : '-'}
                </Text>
                <Text type="secondary">
                  更新时间: {knowledgeData.updated_at ? new Date(knowledgeData.updated_at).toLocaleString() : '-'}
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
