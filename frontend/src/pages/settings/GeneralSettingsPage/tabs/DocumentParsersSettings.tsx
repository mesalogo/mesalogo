import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Card, Tag, Space, Tooltip, Button, Divider, App, Modal, Spin } from 'antd';
import { FilePdfOutlined, InfoCircleOutlined, SaveOutlined, ReloadOutlined, ExperimentOutlined, CheckCircleOutlined, CloseCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { settingsAPI } from '../../../../services/api/settings';
import api from '../../../../services/api/axios';
import { MarkdownRenderer } from '../../../actiontask/components/ConversationExtraction';

// 文档解析器元数据定义
const DOCUMENT_PARSERS_META = [
  {
    name: 'mineru',
    display_name: 'MinerU',
    description: '基于AI的多格式文档解析工具，支持PDF、Word、PowerPoint、Excel、图片等格式',
    status: 'available',
    supported_formats: ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'],
    config_fields: [
      {
        name: 'backend_type',
        label: 'settings.backendType',
        type: 'select',
        options: [
          { value: 'local', label: 'settings.backendType.local' },
          { value: 'remote', label: 'settings.backendType.remote' }
        ],
        defaultValue: 'local'
      },
      {
        name: 'executable_path',
        label: 'settings.executablePath',
        type: 'input',
        placeholder: (config) => {
          const backendType = config?.backend_type || 'local';
          return backendType === 'local'
            ? '/opt/homebrew/.../mineru'
            : '/opt/homebrew/.../mineru';
        }
      },
      {
        name: 'server_url',
        label: 'settings.serverUrl',
        type: 'input',
        placeholder: 'http://127.0.0.1:30000',
        showWhen: (config) => config?.backend_type === 'remote'
      },
      {
        name: 'extra_args',
        label: 'settings.extraArgs',
        type: 'textarea',
        placeholder: '--source modelscope',
        tooltip: '额外的命令行参数，例如：--source modelscope',
        showWhen: (config) => config?.backend_type === 'local'
      },
      { name: 'timeout', label: 'settings.timeout', type: 'number', placeholder: '300', addonAfter: '秒' }
    ]
  },
  {
    name: 'paddleocr_vl',
    display_name: 'PaddleOCR-VL',
    description: '百度 PaddlePaddle 团队开发的超轻量级视觉语言模型（采用远程服务架构），专门用于多语言文档解析，支持109种语言',
    status: 'available',
    supported_formats: ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.bmp', '.tiff'],
    config_fields: [
      {
        name: 'executable_path',
        label: 'settings.executablePath',
        type: 'input',
        placeholder: 'paddleocr'
      },
      {
        name: 'vl_rec_backend',
        label: 'settings.backendType',
        type: 'select',
        options: [
          { value: 'vllm-server', label: 'vLLM Server' }
        ],
        defaultValue: 'vllm-server',
        tooltip: '推理后端类型（目前仅支持 vLLM Server）'
      },
      {
        name: 'server_url',
        label: 'settings.serverUrl',
        type: 'input',
        placeholder: 'http://127.0.0.1:8118/v1',
        tooltip: '远程 vLLM 服务地址'
      },
      {
        name: 'extra_args',
        label: 'settings.extraArgs',
        type: 'textarea',
        placeholder: '--use_doc_orientation_classify True --use_doc_unwarp True',
        tooltip: '额外的命令行参数，例如：--use_doc_orientation_classify True --use_doc_unwarp True'
      },
      {
        name: 'timeout',
        label: 'settings.timeout',
        type: 'number',
        placeholder: '120',
        addonAfter: '秒'
      }
    ]
  }
];

// 文档解析器配置组件
const DocumentParsersConfig = ({ color, renderLabel }: any) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();

  const selectedTool = Form.useWatch('document_parser_tool', form);
  const currentParser = DOCUMENT_PARSERS_META.find(p => p.name === selectedTool) || DOCUMENT_PARSERS_META[0];
  const mineruConfig = Form.useWatch(['document_parser_mineru_config'], form);
  const paddleocrConfig = Form.useWatch(['document_parser_paddleocr_vl_config'], form);
  const currentConfig = selectedTool === 'mineru' ? mineruConfig : paddleocrConfig;
  const backendType = Form.useWatch(['document_parser_mineru_config', 'backend_type'], form);

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="large">
      {/* PDF 转换器配置 */}
      <Form.Item
        label={renderLabel(
          <FilePdfOutlined />,
          t('settings.pdfConverter'),
          t('settings.pdfConverter.tooltip')
        )}
        style={{ marginBottom: '16px' }}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Form.Item
            label={t('settings.sofficeExecutablePath')}
            name={['pdf_converter_config', 'executable_path']}
            style={{ marginBottom: '8px' }}
          >
            <Input placeholder="soffice" />
          </Form.Item>

          <Form.Item
            label={t('settings.timeout')}
            name={['pdf_converter_config', 'timeout']}
            style={{ marginBottom: 0 }}
          >
            <Input
              type="number"
              placeholder="120"
              addonAfter="秒"
            />
          </Form.Item>
        </Space>
      </Form.Item>

      {/* 解析器配置 */}
      <Form.Item
        label={renderLabel(
          <FileTextOutlined />,
          t('settings.parserConfig'),
          t('settings.parserConfig.tooltip')
        )}
        style={{ marginBottom: '16px' }}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Form.Item 
            label={t('settings.selectParser')}
            name="document_parser_tool"
            style={{ marginBottom: '8px' }}
          >
            <Select
              placeholder={t('settings.selectParserPlaceholder')}
              options={DOCUMENT_PARSERS_META.map(p => ({
                value: p.name,
                label: (
                  <Space>
                    {p.display_name}
                    <Tag color={p.status === 'available' ? 'green' : 'orange'} style={{ marginLeft: 8 }}>
                      {p.status === 'available' ? t('settings.available') : t('settings.pending')}
                    </Tag>
                  </Space>
                )
              }))}
            />
          </Form.Item>

          {currentParser && (
            <>
              <div style={{ fontSize: 12, color: 'var(--custom-text-secondary)', marginBottom: 12 }}>
                {currentParser.description}
              </div>

              {currentParser.config_fields.map(field => {
                const configToCheck = currentParser.name === 'mineru' 
                  ? { ...currentConfig, backend_type: backendType }
                  : currentConfig;
                
                if (field.showWhen && !field.showWhen(configToCheck)) {
                  return null;
                }

                return (
                  <Form.Item
                    key={field.name}
                    label={t(field.label)}
                    name={[`document_parser_${currentParser.name}_config`, field.name]}
                    tooltip={field.tooltip}
                    style={{ marginBottom: '8px' }}
                  >
                    {field.type === 'select' ? (
                      <Select
                        disabled={currentParser.status !== 'available'}
                        options={field.options?.map(opt => ({
                          value: opt.value,
                          label: typeof opt.label === 'string' && opt.label.startsWith('settings.') ? t(opt.label) : opt.label
                        }))}
                      />
                    ) : field.type === 'number' ? (
                      <Input
                        type="number"
                        placeholder={field.placeholder}
                        disabled={currentParser.status !== 'available'}
                        addonAfter={field.addonAfter}
                      />
                    ) : field.type === 'textarea' ? (
                      <Input.TextArea
                        rows={3}
                        placeholder={field.placeholder}
                        disabled={currentParser.status !== 'available'}
                      />
                    ) : (
                      <Input
                        placeholder={
                          typeof field.placeholder === 'function'
                            ? field.placeholder(configToCheck)
                            : field.placeholder
                        }
                        disabled={currentParser.status !== 'available'}
                      />
                    )}
                  </Form.Item>
                );
              })}

              <div style={{ fontSize: 12, color: 'var(--custom-text-secondary)' }}>
                {t('settings.supportedFormats')}: {currentParser.supported_formats?.join(', ')}
              </div>
            </>
          )}
        </Space>
      </Form.Item>
    </Space>
  );
};

const DocumentParsersSettings = ({ color, initialValues }: any) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showTestModal, setShowTestModal] = useState(false);

  const selectedTool = Form.useWatch('document_parser_tool', form);

  const renderLabel = (icon, label, tooltip) => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
      <span style={{ color, marginRight: '8px', fontSize: '14px' }}>
        {icon}
      </span>
      <span style={{ fontSize: '14px', fontWeight: '500' }}>
        {label}
      </span>
      <Tooltip title={tooltip}>
        <InfoCircleOutlined
          style={{
            marginLeft: '6px',
            color: 'var(--custom-text-secondary)',
            fontSize: '12px'
          }}
        />
      </Tooltip>
    </div>
  );

  // 初始化表单值
  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        document_parser_tool: initialValues.document_parser_tool || 'mineru',
        document_parser_mineru_config: {
          backend_type: 'local',
          executable_path: '',
          server_url: '',
          extra_args: '--source modelscope',
          timeout: 300,
          ...(initialValues.document_parser_mineru_config || {})
        },
        document_parser_paddleocr_vl_config: {
          executable_path: 'paddleocr',
          vl_rec_backend: 'vllm-server',
          server_url: 'http://127.0.0.1:8118/v1',
          extra_args: '',
          timeout: 120,
          ...(initialValues.document_parser_paddleocr_vl_config || {})
        },
        pdf_converter_config: {
          executable_path: 'soffice',
          timeout: 120,
          ...(initialValues.pdf_converter_config || {})
        }
      });
    }
  }, [initialValues, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // 只保存文档解析器相关的字段
      await settingsAPI.updateSettings({
        document_parser_tool: values.document_parser_tool,
        document_parser_mineru_config: values.document_parser_mineru_config,
        document_parser_paddleocr_vl_config: values.document_parser_paddleocr_vl_config,
        pdf_converter_config: values.pdf_converter_config
      });

      message.success(t('settings.saveSuccess'));
      setLoading(false);
    } catch (error) {
      console.error('Save document parsers settings failed:', error);
      if (error.errorFields) {
        message.error(t('message.validationFailed'));
      } else {
        message.error(t('message.operationFailed') + ': ' + (error.message || t('message.unknownError')));
      }
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (initialValues) {
      form.setFieldsValue({
        document_parser_tool: initialValues.document_parser_tool || 'mineru',
        document_parser_mineru_config: {
          backend_type: 'local',
          executable_path: '',
          server_url: '',
          extra_args: '--source modelscope',
          timeout: 300,
          ...(initialValues.document_parser_mineru_config || {})
        },
        document_parser_paddleocr_vl_config: {
          executable_path: 'paddleocr',
          vl_rec_backend: 'vllm-server',
          server_url: 'http://127.0.0.1:8118/v1',
          extra_args: '',
          timeout: 120,
          ...(initialValues.document_parser_paddleocr_vl_config || {})
        },
        pdf_converter_config: {
          executable_path: 'soffice',
          timeout: 120,
          ...(initialValues.pdf_converter_config || {})
        }
      });
      message.success(t('settings.resetSuccess'));
    }
  };

  // 测试解析器
  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);

      const response = await api.post('/document-parser/test', {
        parser_name: selectedTool
      });

      if (response.data.success) {
        setTestResult(response.data.data);
        setShowTestModal(true);
        message.success(t('settings.testSuccess'));
      } else {
        setTestResult(response.data.data);
        setShowTestModal(true);
        message.error(response.data.message || t('settings.testFailed'));
      }
    } catch (error) {
      console.error('Test parser failed:', error);
      const errorData = error.response?.data?.data || {};
      setTestResult({
        success: false,
        parser_name: selectedTool,
        duration: 0,
        message: error.response?.data?.message || error.message || t('settings.testFailed'),
        details: errorData.details || {}
      });
      setShowTestModal(true);
      message.error(error.response?.data?.message || t('settings.testFailed'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <Form form={form} layout="vertical">
      <DocumentParsersConfig color={color} renderLabel={renderLabel} />

      <Divider />

      <Space>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={loading}
        >
          {t('settings.save')}
        </Button>
        <Button
          icon={<ExperimentOutlined />}
          onClick={handleTest}
          loading={testing}
        >
          {t('settings.testParser')}
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleReset}
        >
          {t('settings.reset')}
        </Button>
      </Space>

      {/* 测试结果弹窗 */}
      <Modal
        title={
          <Space>
            {testResult?.success ? (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            ) : (
              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
            )}
            <span>{t('settings.testResult')}</span>
          </Space>
        }
        open={showTestModal}
        onCancel={() => setShowTestModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowTestModal(false)}>
            {t('close')}
          </Button>
        ]}
        width={900}
        style={{ top: 20 }}
      >
        {testResult && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}>
                <strong>{t('settings.parser')}:</strong> {testResult.parser_name}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>{t('settings.status')}:</strong>{' '}
                <Tag color={testResult.success ? 'success' : 'error'}>
                  {testResult.success ? t('settings.success') : t('settings.failed')}
                </Tag>
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>{t('settings.duration')}:</strong> {testResult.duration?.toFixed(2)} {t('settings.seconds')}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>{t('settings.message')}:</strong> {testResult.message}
              </div>
            </div>

            {testResult.details && Object.keys(testResult.details).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <strong>{t('settings.details')}:</strong>
                <pre style={{
                  background: 'var(--custom-hover-bg)',
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 12,
                  maxHeight: 200,
                  overflow: 'auto'
                }}>
                  {JSON.stringify(testResult.details, null, 2)}
                </pre>
              </div>
            )}

            {testResult.output_preview && (
              <div>
                <strong>{t('settings.outputPreview')}:</strong>
                <div style={{
                  background: 'var(--custom-header-bg)',
                  padding: 16,
                  borderRadius: 6,
                  border: '1px solid var(--custom-border)',
                  maxHeight: '60vh',
                  overflow: 'auto'
                }}>
                  <MarkdownRenderer content={testResult.output_preview} />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Form>
  );
};

export default DocumentParsersSettings;

