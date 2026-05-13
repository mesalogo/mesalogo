import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Space, Typography, message, Alert, Empty, Tabs, Spin } from 'antd';
import { SaveOutlined, InfoCircleOutlined, LockOutlined } from '@ant-design/icons';
import ChunkSettings from './components/ChunkSettings';
import knowledgeAPI from '../../services/api/knowledge';

const { Title, Text } = Typography;
const { TextArea } = Input;

const KnowledgeSettings = ({ selectedKnowledgeId: propKnowledgeId }) => {
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
        message.error('获取知识库信息失败: ' + response.message);
      }
    } catch (error) {
      message.error('获取知识库信息失败: ' + error.message);
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
        message.success('保存成功');
        fetchKnowledgeData(); // 刷新数据
      } else {
        message.error('保存失败: ' + response.message);
      }
    } catch (error) {
      message.error('保存失败: ' + error.message);
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
            <>
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
            <span>访问控制</span>
          </Space>
        }
      >
        <Alert
          message="功能开发中"
          description="访问控制功能正在开发中，敬请期待。将支持：权限管理、用户分享、团队协作等功能。"
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
              <Text type="secondary">请先选择一个知识库</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                从知识库列表中选择一个知识库后，即可查看和修改其设置
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
        <Spin tip="加载中..." />
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
            label: '基本设置',
            children: renderBasicSettings()
          },
          {
            key: 'chunking',
            label: '分段设置',
            children: <ChunkSettings knowledgeId={selectedKnowledgeId} />
          },
          {
            key: 'access',
            label: '访问控制',
            children: renderAccessControl()
          }
        ]}
      />
    </div>
  );
};

export default KnowledgeSettings;
