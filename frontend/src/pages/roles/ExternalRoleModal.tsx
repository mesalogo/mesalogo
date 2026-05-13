import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Tooltip,
  Tag,
  Collapse,
  InputNumber,
  Button,
  App
} from 'antd';
import {
  InfoCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { roleAPI } from '../../services/api/role';
import api from '../../services/api/axios';

const { TextArea } = Input;
const { Option } = Select;

const ExternalRoleModal = ({
  visible,
  selectedRole,
  globalSettings,
  onOk,
  onCancel
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [importing, setImporting] = useState(false);
  const [importPlatform, setImportPlatform] = useState(null);
  const [testConnectionLoading, setTestConnectionLoading] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState(null);

  useEffect(() => {
    if (visible && selectedRole && selectedRole.source === 'external') {
      const externalConfig = selectedRole.external_config || selectedRole.settings?.external_config || {};
      const apiConfig = externalConfig.api_config || {};
      const platformSpecific = externalConfig.platform_specific || {};
      const platform = externalConfig.platform || selectedRole.external_type || 'custom';
      
      setImportPlatform(platform);
      
      form.setFieldsValue({
        name: selectedRole.name,
        description: selectedRole.description,
        source: 'external',
        platform: platform,
        apiKey: apiConfig.api_key || '',
        apiServer: apiConfig.base_url || '',
        model: apiConfig.model || '',
        timeout: apiConfig.timeout || 60,
        instructions: platformSpecific.instructions || '',
        applicationType: platformSpecific.application_type || '',
        platformName: platformSpecific.platform_name || '',
        assistantId: externalConfig.external_id || selectedRole.external_id || '',
        botId: externalConfig.external_id || selectedRole.external_id || '',
        responseMode: apiConfig.response_mode || (globalSettings.streamingEnabled ? 'streaming' : 'blocking'),
        userIdentifier: apiConfig.user_identifier || '',
        headers: apiConfig.headers ? JSON.stringify(apiConfig.headers, null, 2) : ''
      });
    } else if (visible && !selectedRole) {
      form.resetFields();
      setImportPlatform(null);
    }
    setTestConnectionLoading(false);
    setTestConnectionResult(null);
  }, [visible, selectedRole, form, globalSettings]);

  const handleTestConnection = async () => {
    try {
      let fieldsToValidate = ['platform'];
      const platform = form.getFieldValue('platform');
      
      if (platform === 'openai') {
        fieldsToValidate.push('apiKey', 'assistantId');
      } else if (platform === 'dify') {
        fieldsToValidate.push('apiKey', 'apiServer', 'applicationType');
      } else if (platform === 'fastgpt') {
        fieldsToValidate.push('apiKey', 'apiServer', 'assistantId');
      } else if (platform === 'coze') {
        fieldsToValidate.push('apiKey', 'apiServer', 'botId', 'userIdentifier');
      } else if (platform === 'custom') {
        fieldsToValidate.push('apiKey', 'apiServer', 'platformName');
      }

      const values = await form.validateFields(fieldsToValidate);
      const allValues = form.getFieldsValue();
      const testData = {
        ...values,
        responseMode: allValues.responseMode || (globalSettings.streamingEnabled ? 'streaming' : 'blocking'),
        timeout: allValues.timeout || 60,
        userIdentifier: allValues.userIdentifier || ''
      };

      setTestConnectionLoading(true);
      setTestConnectionResult(null);

      try {
        if (testData.responseMode === 'streaming') {
          await handleStreamingTestConnection(testData);
        } else {
          const response = await roleAPI.testExternalConnection(testData);
          setTestConnectionLoading(false);
          setTestConnectionResult(response);

          if (response.success) {
            message.success(response.message || '连接测试成功');
          } else {
            message.error(response.error || '连接测试失败');
          }
        }
      } catch (error) {
        setTestConnectionLoading(false);
        setTestConnectionResult({
          success: false,
          error: error.message || '网络错误',
          platform: platform
        });
        message.error('连接测试失败: ' + (error.message || '网络错误'));
      }
    } catch (error) {
      message.error('请填写必要的连接信息');
    }
  };

  const handleStreamingTestConnection = async (testData) => {
    try {
      setTestConnectionResult({
        success: false,
        message: '正在连接...',
        test_output: '',
        streaming: true
      });

      const response = await fetch(`${api.defaults.baseURL}/roles/test-external-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let collectedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.trim() === '') continue;

          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.error) {
                setTestConnectionLoading(false);
                setTestConnectionResult({
                  success: false,
                  error: data.error,
                  test_output: collectedContent,
                  platform: testData.platform
                });
                message.error('连接测试失败: ' + data.error);
                return;
              } else if (data.status === 'connected') {
                setTestConnectionResult({
                  success: false,
                  message: data.message,
                  test_output: '',
                  streaming: true,
                  platform: testData.platform
                });
              } else if (data.type === 'content' || data.type === 'chunk') {
                const content = data.content || '';
                collectedContent += content;
                setTestConnectionResult(prev => ({
                  ...prev,
                  test_output: prev.test_output + content,
                  streaming: true
                }));
              } else if (data.type === 'done' || data.status === 'completed') {
                setTestConnectionLoading(false);
                setTestConnectionResult({
                  success: true,
                  message: data.message || '流式连接测试成功',
                  test_output: data.full_content || collectedContent,
                  streaming: false,
                  platform: testData.platform,
                  test_input: '你好！请简单介绍一下你自己，这是一个连接测试。'
                });
                message.success('流式连接测试成功');
                return;
              }
            } catch (e) {
              console.error('解析流式数据失败:', e);
            }
          }
        }
      }

      setTestConnectionLoading(false);
      if (collectedContent) {
        setTestConnectionResult({
          success: true,
          message: '流式连接测试完成',
          test_output: collectedContent,
          streaming: false
        });
        message.success('流式连接测试完成');
      } else {
        setTestConnectionResult({
          success: false,
          error: '未收到响应内容',
          test_output: ''
        });
        message.error('未收到响应内容');
      }
    } catch (error) {
      console.error('流式连接测试失败:', error);
      setTestConnectionLoading(false);
      setTestConnectionResult({
        success: false,
        error: error.message || '流式连接测试失败',
        test_output: ''
      });
      message.error('流式连接测试失败: ' + (error.message || '网络错误'));
    }
  };

  const handleOk = async () => {
    setImporting(true);
    try {
      const values = await form.validateFields();
      const apiValues = {
        name: values.name,
        description: values.description,
        source: 'external',
        external_type: values.platform,
        external_id: values.assistantId || values.botId || '',
        external_config: {
          api_key: values.apiKey,
          model: values.model,
          application_type: values.applicationType,
          base_url: values.apiServer,
          instructions: values.instructions,
          timeout: values.timeout || 60,
          response_mode: values.responseMode || 'blocking',
          user_identifier: values.userIdentifier || ''
        }
      };

      if (values.platform === 'custom') {
        apiValues.external_type = values.platformName || 'custom';
        (apiValues.external_config as any).platform_name = values.platformName;

        if (values.headers) {
          try {
            (apiValues.external_config as any).headers = JSON.parse(values.headers);
          } catch(err) {
            message.warning('自定义请求头解析失败，将被忽略');
          }
        }
      }

      await onOk(apiValues, selectedRole);
      
      form.resetFields();
      setImportPlatform(null);
      setTestConnectionLoading(false);
      setTestConnectionResult(null);
    } catch (error) {
      console.error('表单验证或提交失败:', error);

      if (error.errorFields && error.errorFields.length > 0) {
        const firstError = error.errorFields[0];
        const fieldName = firstError.name[0];
        const errorMessage = firstError.errors[0];
        message.error(`${fieldName}: ${errorMessage}`);
      } else {
        message.error('导入失败: ' + (error.message || '未知错误'));
      }
    } finally {
      setImporting(false);
    }
  };

  const renderPlatformFields = () => {
    switch (importPlatform) {
      case 'openai':
        return (
          <>
            <Form.Item name="apiKey" label="API密钥" rules={[{ required: true, message: '请输入OpenAI API密钥' }]}>
              <Input.Password placeholder="sk-..." />
            </Form.Item>
            <Form.Item name="assistantId" label="Assistant ID" rules={[{ required: true, message: '请输入OpenAI Assistant ID' }]}>
              <Input placeholder="asst_..." />
            </Form.Item>
            <Form.Item name="model" label="模型" rules={[{ required: true, message: '请选择使用的模型' }]}>
              <Select placeholder="请选择模型">
                <Option value="gpt-4">GPT-4</Option>
                <Option value="gpt-4-turbo">GPT-4 Turbo</Option>
                <Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Option>
              </Select>
            </Form.Item>
            <Form.Item name="instructions" label="指令集">
              <TextArea rows={4} placeholder="可选，Assistant的系统指令" />
            </Form.Item>
          </>
        );

      case 'dify':
        return (
          <>
            <Form.Item name="apiServer" label="API服务器地址" rules={[
              { required: true, message: '请输入Dify API服务器地址' },
              { pattern: /^https?:\/\//, message: '请输入完整的URL地址，必须以http://或https://开头' }
            ]} extra="请输入完整的API地址，必须以http://或https://开头">
              <Input placeholder="https://cloud.dify.ai/v1"/>
            </Form.Item>
            <Form.Item name="apiKey" label="API密钥" rules={[{ required: true, message: '请输入Dify应用的API密钥' }]}>
              <Input.Password placeholder="app-..." />
            </Form.Item>
            <Form.Item name="applicationType" label="应用类型" rules={[{ required: true, message: '请选择Dify应用类型' }]}>
              <Select placeholder="请选择应用类型">
                <Option value="chatbot">Chatbot - 对话助手</Option>
                <Option value="text_generator">Text Generator - 文本生成</Option>
                <Option value="agent">Agent - 智能助手</Option>
                <Option value="chatflow">Chatflow - 对话流</Option>
                <Option value="workflow">Workflow - 工作流</Option>
              </Select>
            </Form.Item>
          </>
        );

      case 'fastgpt':
        return (
          <>
            <Form.Item name="apiServer" label="API服务器地址" rules={[
              { required: true, message: '请输入FastGPT API服务器地址' },
              { pattern: /^https?:\/\//, message: '请输入完整的URL地址，必须以http://或https://开头' }
            ]} extra="请输入完整的API地址，必须以http://或https://开头">
              <Input placeholder="https://cloud.fastgpt.cn" />
            </Form.Item>
            <Form.Item name="apiKey" label="API密钥" rules={[
              { required: true, message: '请输入FastGPT应用的API密钥' },
              { pattern: /^(fastgpt-|app-)/, message: 'API密钥格式不正确，应以"fastgpt-"或"app-"开头' }
            ]}>
              <Input.Password placeholder="app-xxxxxx (应用特定密钥)" />
            </Form.Item>
            <Form.Item name="assistantId" label="应用ID" rules={[{ required: true, message: '请输入FastGPT应用ID' }]} extra="FastGPT应用的唯一标识符">
              <Input placeholder="6752884ba42075b220241c0c" />
            </Form.Item>
          </>
        );

      case 'coze':
        return (
          <>
            <Form.Item name="apiServer" label="API服务器地址" rules={[
              { required: true, message: '请输入Coze API服务器地址' },
              { pattern: /^https?:\/\//, message: '请输入完整的URL地址，必须以http://或https://开头' }
            ]} extra="Coze API服务器地址" initialValue="https://api.coze.cn">
              <Input placeholder="https://api.coze.cn" />
            </Form.Item>
            <Form.Item name="apiKey" label="API密钥" rules={[{ required: true, message: '请输入Coze平台的API密钥' }]} extra="从Coze开发者平台获取的Personal Access Token">
              <Input.Password placeholder="pat_..." />
            </Form.Item>
            <Form.Item name="botId" label="Bot ID" rules={[{ required: true, message: '请输入Coze平台的Bot ID' }]} extra="Coze智能体的唯一标识符">
              <Input placeholder="7447441851466366987" />
            </Form.Item>
            <Form.Item name="userIdentifier" label="用户ID" rules={[{ required: true, message: '请输入用户ID' }]} extra="用于标识API调用用户，可以是任意字符串">
              <Input placeholder="1234567" />
            </Form.Item>
          </>
        );

      case 'custom':
        return (
          <>
            <Form.Item name="platformName" label="平台名称" rules={[{ required: true, message: '请输入平台名称' }]}>
              <Input placeholder="例如：Claude, Gemini, Xinference等" />
            </Form.Item>
            <Form.Item name="apiServer" label="API服务器地址" rules={[{ required: true, message: '请输入API服务器地址' }]}>
              <Input placeholder="例如：https://api.example.com/v1" />
            </Form.Item>
            <Form.Item name="apiKey" label="API密钥" rules={[{ required: true, message: '请输入API密钥' }]}>
              <Input.Password placeholder="请输入API密钥" />
            </Form.Item>
            <Form.Item name="assistantId" label="智能体ID">
              <Input placeholder="如平台支持，请输入智能体ID" />
            </Form.Item>
            <Form.Item name="model" label="模型标识符">
              <Input placeholder="如平台支持，请输入模型标识符" />
            </Form.Item>
            <Form.Item name="instructions" label="系统指令">
              <TextArea rows={4} placeholder="可选，智能体的系统指令" />
            </Form.Item>
            <Form.Item name="headers" label="自定义请求头">
              <TextArea rows={3} placeholder='可选，JSON格式，例如：{"x-api-key": "value", "Authorization": "Bearer xxx"}' />
            </Form.Item>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{selectedRole && selectedRole.source === 'external' ? '编辑外部智能体' : '导入外部智能体'}</span>
          <Tooltip
            title={
              <div>
                <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>外部智能体说明：</div>
                <ul style={{ margin: 0, paddingLeft: '16px' }}>
                  <li><strong>独立运行</strong>：外部智能体在第三方平台上运行，本系统仅作为接口调用</li>
                  <li><strong>无法调用本地工具</strong>：无法使用系统内置的工具和能力</li>
                  <li><strong>依赖外部平台</strong>：功能完全依赖于所选外部平台的能力和限制</li>
                  <li><strong>网络延迟</strong>：响应速度受网络状况和外部平台性能影响</li>
                  <li><strong>数据隐私</strong>：对话数据会发送到外部平台，请注意数据安全</li>
                </ul>
              </div>
            }
            placement="bottomLeft"
            overlayStyle={{ maxWidth: '400px' }}
          >
            <InfoCircleOutlined style={{ color: '#1677ff', cursor: 'help' }} />
          </Tooltip>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      onOk={handleOk}
      width={800}
      style={{ top: 20 }}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={importing}>取消</Button>,
        <Button key="submit" type="primary" onClick={handleOk} loading={importing}>
          {selectedRole && selectedRole.source === 'external' ? '更新' : '导入'}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
          <Input placeholder="请输入角色名称" />
        </Form.Item>

        <Form.Item name="description" label="描述" rules={[{ required: true, message: '请输入描述' }]}>
          <TextArea rows={2} placeholder="请简要描述该角色的功能和特点" />
        </Form.Item>

        <Form.Item name="source" label="角色类型" initialValue="external">
          <div><Tag color="green">外部</Tag></div>
        </Form.Item>

        <Form.Item name="platform" label="平台类型" rules={[{ required: true, message: '请选择平台类型' }]}>
          <Select placeholder="请选择平台类型" onChange={(value) => setImportPlatform(value)}>
            <Option value="openai">OpenAI</Option>
            <Option value="dify">Dify</Option>
            <Option value="fastgpt">FastGPT</Option>
            <Option value="coze">Coze</Option>
            <Option value="custom">自定义</Option>
          </Select>
        </Form.Item>

        {renderPlatformFields()}

        {importPlatform && (
          <>
            <Collapse ghost style={{ marginTop: '16px' }} items={[
              {
                key: 'advanced',
                label: '高级配置',
                children: (
                  <div>
                    <Form.Item name="timeout" label="超时时间" rules={[{ required: true, message: '请输入超时时间' }]} initialValue={60} extra="API请求超时时间（秒）">
                      <InputNumber min={1} max={300} placeholder="60" />
                    </Form.Item>
                    <Form.Item name="responseMode" label="响应模式" initialValue={globalSettings.streamingEnabled ? 'streaming' : 'blocking'} extra="选择API响应模式，默认跟随全局流式响应设置">
                      <Select placeholder="选择响应模式">
                        <Option value="blocking">阻塞模式</Option>
                        <Option value="streaming">流式模式</Option>
                      </Select>
                    </Form.Item>
                    <Form.Item name="userIdentifier" label="用户标识" extra="用于标识API调用用户（可选）">
                      <Input placeholder="user-123" />
                    </Form.Item>
                  </div>
                )
              }
            ]} />

            <div style={{ marginTop: '24px', padding: '16px', background: 'var(--custom-header-bg)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--custom-border)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>连接测试</span>
                <Button type="primary" onClick={handleTestConnection} loading={testConnectionLoading}>
                  测试连接
                </Button>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>测试输入:</div>
                <div style={{ color: 'var(--custom-text-secondary)', fontSize: '12px' }}>
                  {testConnectionResult?.test_input || '你好！请简单介绍一下你自己，这是一个连接测试。'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>响应内容:</div>
                <div style={{ background: 'var(--custom-card-bg)', padding: '12px', borderRadius: '4px', border: '1px solid var(--custom-border)', minHeight: '120px', maxHeight: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                  {testConnectionLoading && !testConnectionResult ? (
                    <div style={{ padding: '10px 0', color: 'var(--custom-text-secondary)', fontSize: '13px' }}>
                      <div style={{ marginBottom: '8px' }}>
                        <Tag color="blue">正在测试</Tag>
                        <span style={{ marginLeft: '8px' }}>正在测试连接，请稍候...</span>
                      </div>
                      <div style={{ background: 'var(--tree-hover-bg)', padding: '8px', borderRadius: '4px', border: '1px dashed #1677ff', minHeight: '60px', color: 'var(--custom-text-secondary)' }}>
                        等待响应中...
                      </div>
                    </div>
                  ) : testConnectionResult ? (
                    <div>
                      {testConnectionResult.success || testConnectionResult.streaming ? (
                        <div>
                          <div style={{ marginBottom: '8px' }}>
                            {testConnectionResult.streaming ? (
                              <Tag color="blue">正在接收</Tag>
                            ) : (
                              <Tag color="green">连接成功</Tag>
                            )}
                            <span style={{ marginLeft: '8px', color: testConnectionResult.streaming ? '#1677ff' : '#52c41a' }}>
                              {testConnectionResult.message}
                            </span>
                            {testConnectionResult.streaming && testConnectionLoading && (
                              <span style={{ marginLeft: '8px', color: 'var(--custom-text-secondary)', fontSize: '12px' }}>(流式响应中...)</span>
                            )}
                          </div>
                          <div style={{ color: 'var(--custom-text)' }}>
                            {testConnectionResult.test_output || (testConnectionResult.streaming ? '等待响应内容...' : '')}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <Tag color="red">连接失败</Tag>
                          <span style={{ marginLeft: '8px', color: '#ff4d4f' }}>
                            {testConnectionResult.error || '连接测试失败'}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--custom-text-secondary)', textAlign: 'center', padding: '20px 0' }}>
                      点击"测试连接"按钮开始测试
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </Form>
    </Modal>
  );
};

export default ExternalRoleModal;
