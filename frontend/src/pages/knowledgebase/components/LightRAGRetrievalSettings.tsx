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
      console.error('获取 LightRAG 检索配置失败:', error);
      message.error('获取检索配置失败');
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
        message.success('LightRAG 检索配置保存成功');
        if (onSettingsSaved) {
          onSettingsSaved();
        }
      } else {
        message.error(response.message || '保存失败');
      }
    } catch (error) {
      console.error('保存 LightRAG 检索配置失败:', error);
      message.error('保存检索配置失败');
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
            <span>LightRAG 检索配置</span>
          </Space>
        }
        extra={
          <Button 
            type="primary" 
            onClick={handleSave}
            loading={saving}
          >
            保存配置
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
            message="LightRAG 检索说明"
            description="LightRAG 使用知识图谱增强的检索方式，支持多种查询模式。配置将在 Agent 查询知识库时自动应用。"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          {/* 查询模式 */}
          <Divider>
            <Space>
              <ThunderboltOutlined />
              <Text strong>查询模式</Text>
            </Space>
          </Divider>

          <Form.Item
            name="query_mode"
            label="默认查询模式"
            tooltip="选择 LightRAG 的默认查询模式，不同模式适用于不同场景"
          >
            <Radio.Group onChange={(e) => setQueryMode(e.target.value)}>
              <Space direction="vertical">
                <Radio value="naive">
                  <Space>
                    {getModeIcon('naive')}
                    <Text strong>Naive</Text>
                    <Text type="secondary">- 简单检索，直接匹配，速度最快</Text>
                  </Space>
                </Radio>
                <Radio value="local">
                  <Space>
                    {getModeIcon('local')}
                    <Text strong>Local</Text>
                    <Text type="secondary">- 局部检索，基于实体邻域，适合具体问题</Text>
                  </Space>
                </Radio>
                <Radio value="global">
                  <Space>
                    {getModeIcon('global')}
                    <Text strong>Global</Text>
                    <Text type="secondary">- 全局检索，基于社区摘要，适合宏观问题</Text>
                  </Space>
                </Radio>
                <Radio value="hybrid">
                  <Space>
                    {getModeIcon('hybrid')}
                    <Text strong>Hybrid</Text>
                    <Text type="secondary">- 混合检索，结合局部和全局（推荐）</Text>
                  </Space>
                </Radio>
                <Radio value="mix">
                  <Space>
                    {getModeIcon('mix')}
                    <Text strong>Mix</Text>
                    <Text type="secondary">- 综合模式，图谱+向量混合检索</Text>
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
              检索参数
            </Space>
          </Title>

          <Form.Item
            name="top_k"
            label={
              <Space>
                <Text strong>Top-K</Text>
                <Text type="secondary">(返回结果数量)</Text>
              </Space>
            }
            tooltip="控制检索时返回的最相关结果数量"
          >
            <InputNumber
              min={1}
              max={50}
              style={{ width: '200px' }}
              placeholder="请输入 Top-K 值"
            />
          </Form.Item>

          <Form.Item
            name="response_type"
            label={
              <Space>
                <Text strong>响应类型</Text>
                <Text type="secondary">(回答格式)</Text>
              </Space>
            }
            tooltip="控制 LightRAG 生成回答的格式"
          >
            <Select style={{ width: '300px' }}>
              <Select.Option value="Multiple Paragraphs">多段落 (Multiple Paragraphs)</Select.Option>
              <Select.Option value="Single Paragraph">单段落 (Single Paragraph)</Select.Option>
              <Select.Option value="List">列表形式 (List)</Select.Option>
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
                <Text strong>💡 查询模式说明</Text>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
                <li><Text strong>Naive：</Text>纯向量检索，速度最快，适合简单查询</li>
                <li><Text strong>Local：</Text>基于实体的图谱检索，适合查询具体实体相关信息</li>
                <li><Text strong>Global：</Text>基于关系的图谱检索，适合查询宏观概念和关系</li>
                <li><Text strong>Hybrid：</Text>结合 Local 和 Global，平衡精确性和全面性（推荐）</li>
                <li><Text strong>Mix：</Text>图谱+向量混合检索，综合多种策略</li>
              </ul>
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LightRAGRetrievalSettings;
