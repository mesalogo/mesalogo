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
            message.success(response.message || t('externalRole.testSuccess'));
          } else {
            message.error(response.error || t('externalRole.testFailed'));
          }
        }
      } catch (error) {
        setTestConnectionLoading(false);
        setTestConnectionResult({
          success: false,
          error: error.message || t('externalRole.networkError'),
          platform: platform
        });
        message.error(t('externalRole.testFailed') + ': ' + (error.message || t('externalRole.networkError')));
      }
    } catch (error) {
      message.error(t('externalRole.fillRequired'));
    }
  };

  const handleStreamingTestConnection = async (testData) => {
    try {
      setTestConnectionResult({
        success: false,
        message: t('externalRole.connecting'),
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
                message.error(t('externalRole.testFailed') + ': ' + data.error);
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
                  message: data.message || t('externalRole.streamingTestSuccess'),
                  test_output: data.full_content || collectedContent,
                  streaming: false,
                  platform: testData.platform,
                  test_input: t('externalRole.testInputDefault')
                });
                message.success(t('externalRole.streamingTestSuccess'));
                return;
              }
            } catch (e) {
              console.error('parse streaming data failed:', e);
            }
          }
        }
      }

      setTestConnectionLoading(false);
      if (collectedContent) {
        setTestConnectionResult({
          success: true,
          message: t('externalRole.streamingTestDone'),
          test_output: collectedContent,
          streaming: false
        });
        message.success(t('externalRole.streamingTestDone'));
      } else {
        setTestConnectionResult({
          success: false,
          error: t('externalRole.noResponse'),
          test_output: ''
        });
        message.error(t('externalRole.noResponse'));
      }
    } catch (error) {
      console.error('streaming test failed:', error);
      setTestConnectionLoading(false);
      setTestConnectionResult({
        success: false,
        error: error.message || t('externalRole.streamingTestFailed'),
        test_output: ''
      });
      message.error(t('externalRole.streamingTestFailed') + ': ' + (error.message || t('externalRole.networkError')));
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
            message.warning(t('externalRole.headersParseFailed'));
          }
        }
      }

      await onOk(apiValues, selectedRole);

      form.resetFields();
      setImportPlatform(null);
      setTestConnectionLoading(false);
      setTestConnectionResult(null);
    } catch (error) {
      console.error('form validate/submit failed:', error);

      if (error.errorFields && error.errorFields.length > 0) {
        const firstError = error.errorFields[0];
        const fieldName = firstError.name[0];
        const errorMessage = firstError.errors[0];
        message.error(`${fieldName}: ${errorMessage}`);
      } else {
        message.error(t('externalRole.importFailed') + ': ' + (error.message || t('externalRole.unknownError')));
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
            <Form.Item name="apiKey" label={t('externalRole.field.apiKey')} rules={[{ required: true, message: t('externalRole.req.openaiApiKey') }]}>
              <Input.Password placeholder="sk-..." />
            </Form.Item>
            <Form.Item name="assistantId" label="Assistant ID" rules={[{ required: true, message: t('externalRole.req.openaiAssistantId') }]}>
              <Input placeholder="asst_..." />
            </Form.Item>
            <Form.Item name="model" label={t('externalRole.field.model')} rules={[{ required: true, message: t('externalRole.req.model') }]}>
              <Select placeholder={t('externalRole.placeholder.model')}>
                <Option value="gpt-4">GPT-4</Option>
                <Option value="gpt-4-turbo">GPT-4 Turbo</Option>
                <Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Option>
              </Select>
            </Form.Item>
            <Form.Item name="instructions" label={t('externalRole.field.instructions')}>
              <TextArea rows={4} placeholder={t('externalRole.placeholder.openaiInstructions')} />
            </Form.Item>
          </>
        );

      case 'dify':
        return (
          <>
            <Form.Item name="apiServer" label={t('externalRole.field.apiServer')} rules={[
              { required: true, message: t('externalRole.req.difyServer') },
              { pattern: /^https?:\/\//, message: t('externalRole.req.urlPattern') }
            ]} extra={t('externalRole.extra.urlPattern')}>
              <Input placeholder="https://cloud.dify.ai/v1"/>
            </Form.Item>
            <Form.Item name="apiKey" label={t('externalRole.field.apiKey')} rules={[{ required: true, message: t('externalRole.req.difyKey') }]}>
              <Input.Password placeholder="app-..." />
            </Form.Item>
            <Form.Item name="applicationType" label={t('externalRole.field.applicationType')} rules={[{ required: true, message: t('externalRole.req.difyAppType') }]}>
              <Select placeholder={t('externalRole.placeholder.difyAppType')}>
                <Option value="chatbot">{t('externalRole.dify.chatbot')}</Option>
                <Option value="text_generator">{t('externalRole.dify.textGenerator')}</Option>
                <Option value="agent">{t('externalRole.dify.agent')}</Option>
                <Option value="chatflow">{t('externalRole.dify.chatflow')}</Option>
                <Option value="workflow">{t('externalRole.dify.workflow')}</Option>
              </Select>
            </Form.Item>
          </>
        );

      case 'fastgpt':
        return (
          <>
            <Form.Item name="apiServer" label={t('externalRole.field.apiServer')} rules={[
              { required: true, message: t('externalRole.req.fastgptServer') },
              { pattern: /^https?:\/\//, message: t('externalRole.req.urlPattern') }
            ]} extra={t('externalRole.extra.urlPattern')}>
              <Input placeholder="https://cloud.fastgpt.cn" />
            </Form.Item>
            <Form.Item name="apiKey" label={t('externalRole.field.apiKey')} rules={[
              { required: true, message: t('externalRole.req.fastgptKey') },
              { pattern: /^(fastgpt-|app-)/, message: t('externalRole.req.fastgptKeyPattern') }
            ]}>
              <Input.Password placeholder={t('externalRole.placeholder.fastgptKey')} />
            </Form.Item>
            <Form.Item name="assistantId" label={t('externalRole.field.fastgptAppId')} rules={[{ required: true, message: t('externalRole.req.fastgptAppId') }]} extra={t('externalRole.extra.fastgptAppId')}>
              <Input placeholder="6752884ba42075b220241c0c" />
            </Form.Item>
          </>
        );

      case 'coze':
        return (
          <>
            <Form.Item name="apiServer" label={t('externalRole.field.apiServer')} rules={[
              { required: true, message: t('externalRole.req.cozeServer') },
              { pattern: /^https?:\/\//, message: t('externalRole.req.urlPattern') }
            ]} extra={t('externalRole.extra.cozeServer')} initialValue="https://api.coze.cn">
              <Input placeholder="https://api.coze.cn" />
            </Form.Item>
            <Form.Item name="apiKey" label={t('externalRole.field.apiKey')} rules={[{ required: true, message: t('externalRole.req.cozeKey') }]} extra={t('externalRole.extra.cozePat')}>
              <Input.Password placeholder="pat_..." />
            </Form.Item>
            <Form.Item name="botId" label="Bot ID" rules={[{ required: true, message: t('externalRole.req.cozeBotId') }]} extra={t('externalRole.extra.cozeBotId')}>
              <Input placeholder="7447441851466366987" />
            </Form.Item>
            <Form.Item name="userIdentifier" label={t('externalRole.field.userId')} rules={[{ required: true, message: t('externalRole.req.userId') }]} extra={t('externalRole.extra.userId')}>
              <Input placeholder="1234567" />
            </Form.Item>
          </>
        );

      case 'custom':
        return (
          <>
            <Form.Item name="platformName" label={t('externalRole.field.platformName')} rules={[{ required: true, message: t('externalRole.req.platformName') }]}>
              <Input placeholder={t('externalRole.placeholder.platformName')} />
            </Form.Item>
            <Form.Item name="apiServer" label={t('externalRole.field.apiServer')} rules={[{ required: true, message: t('externalRole.req.customServer') }]}>
              <Input placeholder={t('externalRole.placeholder.customServer')} />
            </Form.Item>
            <Form.Item name="apiKey" label={t('externalRole.field.apiKey')} rules={[{ required: true, message: t('externalRole.req.customKey') }]}>
              <Input.Password placeholder={t('externalRole.placeholder.customKey')} />
            </Form.Item>
            <Form.Item name="assistantId" label={t('externalRole.field.agentId')}>
              <Input placeholder={t('externalRole.placeholder.customAgentId')} />
            </Form.Item>
            <Form.Item name="model" label={t('externalRole.field.modelId')}>
              <Input placeholder={t('externalRole.placeholder.customModelId')} />
            </Form.Item>
            <Form.Item name="instructions" label={t('externalRole.field.sysInstructions')}>
              <TextArea rows={4} placeholder={t('externalRole.placeholder.sysInstructions')} />
            </Form.Item>
            <Form.Item name="headers" label={t('externalRole.field.customHeaders')}>
              <TextArea rows={3} placeholder={t('externalRole.placeholder.customHeaders')} />
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
          <span>{selectedRole && selectedRole.source === 'external' ? t('externalRole.editTitle') : t('externalRole.importTitle')}</span>
          <Tooltip
            title={
              <div>
                <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>{t('externalRole.note.title')}</div>
                <ul style={{ margin: 0, paddingLeft: '16px' }}>
                  <li><strong>{t('externalRole.note.standaloneTitle')}</strong>{t('externalRole.note.standalone')}</li>
                  <li><strong>{t('externalRole.note.noLocalToolsTitle')}</strong>{t('externalRole.note.noLocalTools')}</li>
                  <li><strong>{t('externalRole.note.dependsTitle')}</strong>{t('externalRole.note.depends')}</li>
                  <li><strong>{t('externalRole.note.latencyTitle')}</strong>{t('externalRole.note.latency')}</li>
                  <li><strong>{t('externalRole.note.privacyTitle')}</strong>{t('externalRole.note.privacy')}</li>
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
        <Button key="cancel" onClick={onCancel} disabled={importing}>{t('externalRole.cancel')}</Button>,
        <Button key="submit" type="primary" onClick={handleOk} loading={importing}>
          {selectedRole && selectedRole.source === 'external' ? t('externalRole.update') : t('externalRole.import')}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label={t('externalRole.field.roleName')} rules={[{ required: true, message: t('externalRole.req.roleName') }]}>
          <Input placeholder={t('externalRole.placeholder.roleName')} />
        </Form.Item>

        <Form.Item name="description" label={t('externalRole.field.description')} rules={[{ required: true, message: t('externalRole.req.description') }]}>
          <TextArea rows={2} placeholder={t('externalRole.placeholder.description')} />
        </Form.Item>

        <Form.Item name="source" label={t('externalRole.field.roleType')} initialValue="external">
          <div><Tag color="green">{t('externalRole.external')}</Tag></div>
        </Form.Item>

        <Form.Item name="platform" label={t('externalRole.field.platform')} rules={[{ required: true, message: t('externalRole.req.platform') }]}>
          <Select placeholder={t('externalRole.placeholder.platform')} onChange={(value) => setImportPlatform(value)}>
            <Option value="openai">OpenAI</Option>
            <Option value="dify">Dify</Option>
            <Option value="fastgpt">FastGPT</Option>
            <Option value="coze">Coze</Option>
            <Option value="custom">{t('externalRole.custom')}</Option>
          </Select>
        </Form.Item>

        {renderPlatformFields()}

        {importPlatform && (
          <>
            <Collapse ghost style={{ marginTop: '16px' }} items={[
              {
                key: 'advanced',
                label: t('externalRole.advancedConfig'),
                children: (
                  <div>
                    <Form.Item name="timeout" label={t('externalRole.field.timeout')} rules={[{ required: true, message: t('externalRole.req.timeout') }]} initialValue={60} extra={t('externalRole.extra.timeout')}>
                      <InputNumber min={1} max={300} placeholder="60" />
                    </Form.Item>
                    <Form.Item name="responseMode" label={t('externalRole.field.responseMode')} initialValue={globalSettings.streamingEnabled ? 'streaming' : 'blocking'} extra={t('externalRole.extra.responseMode')}>
                      <Select placeholder={t('externalRole.placeholder.responseMode')}>
                        <Option value="blocking">{t('externalRole.responseMode.blocking')}</Option>
                        <Option value="streaming">{t('externalRole.responseMode.streaming')}</Option>
                      </Select>
                    </Form.Item>
                    <Form.Item name="userIdentifier" label={t('externalRole.field.userIdentifier')} extra={t('externalRole.extra.userIdentifier')}>
                      <Input placeholder="user-123" />
                    </Form.Item>
                  </div>
                )
              }
            ]} />

            <div style={{ marginTop: '24px', padding: '16px', background: 'var(--custom-header-bg)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--custom-border)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>{t('externalRole.connectionTest')}</span>
                <Button type="primary" onClick={handleTestConnection} loading={testConnectionLoading}>
                  {t('externalRole.testButton')}
                </Button>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>{t('externalRole.testInputLabel')}</div>
                <div style={{ color: 'var(--custom-text-secondary)', fontSize: '12px' }}>
                  {testConnectionResult?.test_input || t('externalRole.testInputDefault')}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>{t('externalRole.responseLabel')}</div>
                <div style={{ background: 'var(--custom-card-bg)', padding: '12px', borderRadius: '4px', border: '1px solid var(--custom-border)', minHeight: '120px', maxHeight: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                  {testConnectionLoading && !testConnectionResult ? (
                    <div style={{ padding: '10px 0', color: 'var(--custom-text-secondary)', fontSize: '13px' }}>
                      <div style={{ marginBottom: '8px' }}>
                        <Tag color="blue">{t('externalRole.status.testing')}</Tag>
                        <span style={{ marginLeft: '8px' }}>{t('externalRole.status.testingMsg')}</span>
                      </div>
                      <div style={{ background: 'var(--tree-hover-bg)', padding: '8px', borderRadius: '4px', border: '1px dashed #1677ff', minHeight: '60px', color: 'var(--custom-text-secondary)' }}>
                        {t('externalRole.status.awaitingResponse')}
                      </div>
                    </div>
                  ) : testConnectionResult ? (
                    <div>
                      {testConnectionResult.success || testConnectionResult.streaming ? (
                        <div>
                          <div style={{ marginBottom: '8px' }}>
                            {testConnectionResult.streaming ? (
                              <Tag color="blue">{t('externalRole.status.receiving')}</Tag>
                            ) : (
                              <Tag color="green">{t('externalRole.status.connected')}</Tag>
                            )}
                            <span style={{ marginLeft: '8px', color: testConnectionResult.streaming ? '#1677ff' : '#52c41a' }}>
                              {testConnectionResult.message}
                            </span>
                            {testConnectionResult.streaming && testConnectionLoading && (
                              <span style={{ marginLeft: '8px', color: 'var(--custom-text-secondary)', fontSize: '12px' }}>{t('externalRole.status.streaming')}</span>
                            )}
                          </div>
                          <div style={{ color: 'var(--custom-text)' }}>
                            {testConnectionResult.test_output || (testConnectionResult.streaming ? t('externalRole.status.awaitingContent') : '')}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <Tag color="red">{t('externalRole.status.failed')}</Tag>
                          <span style={{ marginLeft: '8px', color: '#ff4d4f' }}>
                            {testConnectionResult.error || t('externalRole.testFailed')}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--custom-text-secondary)', textAlign: 'center', padding: '20px 0' }}>
                      {t('externalRole.status.clickToTest')}
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
