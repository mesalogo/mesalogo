import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Switch,
  Input,
  InputNumber,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Tag,
  App,
  Select,
  Tooltip,
  Descriptions,
  Divider
} from 'antd';
import {
  SaveOutlined,
  InfoCircleOutlined,
  CloudOutlined,
  BarChartOutlined,
  ReloadOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined
} from '@ant-design/icons';
import { useLightRAG } from './useLightRAG';

const { Text } = Typography;

const LightragTab = () => {
  const { message } = App.useApp();
  const [lightragForm] = Form.useForm();
  
  const {
    config,
    loading,
    status,
    textModels,
    embeddingModels,
    rerankModels,
    defaultTextModel,
    defaultEmbeddingModel,
    defaultRerankModel,
    defaultTextModelInfo,
    defaultEmbeddingModelInfo,
    defaultRerankModelInfo,
    loadConfig,
    saveConfig,
    loadStatus,
    loadModelConfigs,
    controlService
  } = useLightRAG();
  
  const [lightragEnabled, setLightragEnabled] = useState(false);

  useEffect(() => {
    const loadLightragConfig = async () => {
      await loadModelConfigs();
      
      const configData = await loadConfig();
      if (configData && configData.framework === 'lightrag') {
        setLightragEnabled(configData.enabled || false);
        
        const formValues = {
          ...configData,
          framework: 'lightrag'
        };

        if (configData.enabled) {
          lightragForm.setFieldsValue(formValues);
        }
      }
    };

    loadLightragConfig();
    loadStatus();
  }, [loadConfig, loadStatus, loadModelConfigs, lightragForm]);

  const handleSaveLightragConfig = async (values) => {
    try {
      let processedValues = { ...values };

      try {
        const textModelId = values.framework_config?.text_model_id;
        if (textModelId && textModelId !== 'default') {
          const textModel = textModels.find(m => m.id.toString() === textModelId.toString());
          if (!textModel) {
            processedValues.framework_config.text_model_id = 'default';
          }
        } else {
          processedValues.framework_config.text_model_id = 'default';
        }

        const embeddingModelId = values.framework_config?.embedding_model_id;
        if (embeddingModelId && embeddingModelId !== 'default') {
          const embeddingModel = embeddingModels.find(m => m.id.toString() === embeddingModelId.toString());
          if (!embeddingModel) {
            processedValues.framework_config.embedding_model_id = 'default';
          }
        } else {
          processedValues.framework_config.embedding_model_id = 'default';
        }

        const rerankModelId = values.framework_config?.rerank_model_id;
        if (rerankModelId && rerankModelId !== 'default') {
          const rerankModel = rerankModels.find(m => m.id.toString() === rerankModelId.toString());
          if (!rerankModel) {
            processedValues.framework_config.rerank_model_id = 'default';
          }
        } else {
          processedValues.framework_config.rerank_model_id = 'default';
        }

        delete processedValues.framework_config.text_model;
        delete processedValues.framework_config.embedding_model;
        delete processedValues.framework_config.rerank_model;

      } catch (error) {
        message.error('处理模型配置失败: ' + error.message);
        return;
      }

      const configData = {
        ...processedValues,
        enabled: lightragEnabled,
        framework: 'lightrag'
      };

      const result = await saveConfig(configData);
      
      if (!result) {
        message.error('配置保存失败');
      } else {
        // 后端会自动同步配置到 LightRAG 容器
        if (result.sync_result?.synced) {
          message.success('配置已保存并同步到 LightRAG');
        } else if (result.sync_result) {
          message.warning(`配置已保存，但同步失败: ${result.sync_result.message}`);
        } else {
          message.success('配置已保存');
        }
        // 刷新状态
        loadStatus();
      }
    } catch (error) {
      message.error('配置保存失败: ' + error.message);
    }
  };

  const handleControlService = async (action: 'start' | 'stop') => {
    await controlService(action);
  };

  const renderStatusTag = (status) => {
    const statusConfig = {
      healthy: { color: 'green', text: '运行中' },
      unhealthy: { color: 'orange', text: '异常' },
      unreachable: { color: 'red', text: '未连接' }
    };
    const cfg = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={cfg.color}>{cfg.text}</Tag>;
  };

  return (
    <>
      {/* 启用开关 */}
      <Card title="启用LightRAG知识库系统" style={{ marginBottom: 24 }}>
        <Row align="middle" gutter={16}>
          <Col>
            <Switch
              checked={lightragEnabled}
              checkedChildren="开启"
              unCheckedChildren="关闭"
              loading={loading}
              onChange={async (checked) => {
                if (checked) {
                  setLightragEnabled(true);
                  message.info('请先完成配置，然后点击保存按钮');
                } else {
                  const success = await saveConfig({
                    ...config,
                    framework: 'lightrag',
                    enabled: false
                  });
                  if (success) {
                    setLightragEnabled(false);
                    message.success('LightRAG已禁用');
                  } else {
                    setLightragEnabled(true);
                  }
                }
              }}
            />
          </Col>
          <Col flex={1}>
            <Text type="secondary">轻量级RAG框架，用于文档知识检索和知识图谱构建</Text>
          </Col>
        </Row>
      </Card>

      {lightragEnabled && (
        <Form
          form={lightragForm}
          layout="vertical"
          onFinish={handleSaveLightragConfig}
          initialValues={{
            ...config,
            framework: 'lightrag',
            framework_config: {
              partition_strategy: 'by_knowledge',
              chunk_size: 1200,
              chunk_overlap: 100,
              summary_language: 'Chinese',
              top_k: 40,
              enable_rerank: true,
              ...config?.framework_config
            }
          }}
        >
          {/* 主配置卡片 */}
          <Card
            title={
              <Space>
                <BarChartOutlined />
                服务状态与配置
                {status?.status === 'healthy' ? <Tag color="success">运行中</Tag> : <Tag color="default">未启动</Tag>}
              </Space>
            }
            extra={
              <Button icon={<ReloadOutlined />} onClick={loadStatus} loading={loading}>
                刷新
              </Button>
            }
            style={{ marginBottom: 24 }}
          >
            {/* 状态信息 */}
            {status && (
              <>
                <Descriptions column={4} size="small">
                  <Descriptions.Item label="服务状态">{renderStatusTag(status.status)}</Descriptions.Item>
                  <Descriptions.Item label="服务地址">{config?.framework_config?.service_url || 'http://localhost:9621'}</Descriptions.Item>
                  <Descriptions.Item label="知识库数量">{status.statistics?.workspace_count || 0}</Descriptions.Item>
                  <Descriptions.Item label="文档数量">{status.statistics?.document_count || 0}</Descriptions.Item>
                </Descriptions>
                <Divider style={{ margin: '16px 0' }} />
              </>
            )}

            {/* 服务配置 */}
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name={['framework_config', 'service_url']}
                  label="服务地址"
                  rules={[{ required: true, message: '请输入服务地址' }]}
                  tooltip="LightRAG容器化服务的访问地址"
                >
                  <Input placeholder="http://localhost:9621" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="服务控制" style={{ marginBottom: 0 }}>
                  <Button
                    type={status?.status === 'healthy' ? "default" : "primary"}
                    icon={status?.status === 'healthy' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                    onClick={() => handleControlService(status?.status === 'healthy' ? 'stop' : 'start')}
                    loading={loading}
                  >
                    {status?.status === 'healthy' ? '停止服务' : '启动服务'}
                  </Button>
                </Form.Item>
              </Col>
            </Row>

            {/* 模型配置 */}
            <Divider orientationMargin={0} style={{ margin: '8px 0 16px' }}>
              <Space>
                <CloudOutlined />
                模型配置
              </Space>
            </Divider>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'text_model_id']}
                  label={
                    <Space>
                      文本生成模型
                      <Tooltip title="用于LLM推理和知识提取">
                        <InfoCircleOutlined style={{ color: '#1677ff' }} />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: '请选择文本生成模型' }]}
                >
                  <Select
                    placeholder="选择文本生成模型"
                    showSearch
                    filterOption={(input, option) => option?.label?.toLowerCase().includes(input.toLowerCase())}
                    options={[
                      { value: 'default', label: `默认 ${defaultTextModelInfo ? `(${defaultTextModelInfo.name})` : ''}` },
                      ...(textModels || []).filter(m => m.id !== defaultTextModel).map(model => ({
                        value: model.id.toString(),
                        label: `${model.name} (${model.provider})`,
                      }))
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'embedding_model_id']}
                  label={
                    <Space>
                      嵌入模型
                      <Tooltip title="用于生成向量表示">
                        <InfoCircleOutlined style={{ color: '#1677ff' }} />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: '请选择嵌入模型' }]}
                >
                  <Select
                    placeholder="选择嵌入模型"
                    showSearch
                    filterOption={(input, option) => option?.label?.toLowerCase().includes(input.toLowerCase())}
                    options={[
                      { value: 'default', label: `默认 ${defaultEmbeddingModelInfo ? `(${defaultEmbeddingModelInfo.name})` : ''}` },
                      ...(embeddingModels || []).filter(m => m.id !== defaultEmbeddingModel).map(model => ({
                        value: model.id.toString(),
                        label: `${model.name} (${model.provider})`,
                      }))
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'embedding_dimension']}
                  label="嵌入维度"
                  tooltip="嵌入向量的维度大小"
                >
                  <InputNumber min={128} max={4096} placeholder="如：1536" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'enable_rerank']}
                  label="启用重排序"
                  valuePropName="checked"
                  tooltip="启用后将使用重排序模型对检索结果进行二次排序"
                >
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) =>
                    prevValues?.framework_config?.enable_rerank !== currentValues?.framework_config?.enable_rerank
                  }
                >
                  {({ getFieldValue }) => {
                    const enableRerank = getFieldValue(['framework_config', 'enable_rerank']);
                    return enableRerank ? (
                      <Form.Item
                        name={['framework_config', 'rerank_model_id']}
                        label={
                          <Space>
                            重排序模型
                            <Tooltip title="用于搜索结果重排序">
                              <InfoCircleOutlined style={{ color: '#1677ff' }} />
                            </Tooltip>
                          </Space>
                        }
                      >
                        <Select
                          placeholder="选择重排序模型"
                          showSearch
                          filterOption={(input, option) => option?.label?.toLowerCase().includes(input.toLowerCase())}
                          options={[
                            { value: 'default', label: `默认 ${defaultRerankModelInfo ? `(${defaultRerankModelInfo.name})` : ''}` },
                            ...(rerankModels || []).filter(m => m.id !== defaultRerankModel).map(model => ({
                              value: model.id.toString(),
                              label: `${model.name} (${model.provider})`,
                            }))
                          ]}
                        />
                      </Form.Item>
                    ) : null;
                  }}
                </Form.Item>
              </Col>
            </Row>

            {/* 文档处理配置 */}
            <Divider orientationMargin={0} style={{ margin: '8px 0 16px' }}>
              <Space>
                <SettingOutlined />
                文档处理配置
              </Space>
            </Divider>

            <Row gutter={16}>
              <Col span={6}>
                <Form.Item
                  name={['framework_config', 'chunk_size']}
                  label="文档块大小"
                  tooltip="文档分块的大小，推荐500-1500"
                >
                  <InputNumber min={100} max={2000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name={['framework_config', 'chunk_overlap']}
                  label="文档块重叠"
                  tooltip="相邻文档块的重叠大小"
                >
                  <InputNumber min={0} max={500} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name={['framework_config', 'summary_language']}
                  label="摘要语言"
                  tooltip="文档摘要的输出语言"
                >
                  <Select>
                    <Select.Option value="Chinese">中文</Select.Option>
                    <Select.Option value="English">英文</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name={['framework_config', 'top_k']}
                  label="Top K"
                  tooltip="检索时返回的最大结果数"
                >
                  <InputNumber min={1} max={100} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            {/* 底部操作按钮 */}
            <Divider style={{ margin: '16px 0' }} />
            <Space wrap style={{ width: '100%', justifyContent: 'center' }}>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={loading}>
                保存配置
              </Button>
              <Button
                type={status?.status === 'healthy' ? "default" : "primary"}
                icon={status?.status === 'healthy' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={() => handleControlService(status?.status === 'healthy' ? 'stop' : 'start')}
                loading={loading}
              >
                {status?.status === 'healthy' ? '停止服务' : '启动服务'}
              </Button>
            </Space>
          </Card>
        </Form>
      )}
    </>
  );
};

export default LightragTab;
