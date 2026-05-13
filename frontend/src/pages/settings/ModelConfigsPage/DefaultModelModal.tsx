import React, { useEffect } from 'react';
import { Modal, Form, Select, Row, Col, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;
const { Option } = Select;

// 获取provider翻译名称的函数
const getProviderName = (provider, t) => {
  const key = `modelConfig.provider.${provider}`;
  const translated = t(key);
  // 如果翻译key不存在，返回原始provider名称
  return translated === key ? provider : translated;
};

const DefaultModelModal = ({
  visible,
  onOk,
  onCancel,
  loading,
  form,
  modelConfigs,
  currentDefaults
}) => {
  const { t } = useTranslation();
  
  // 当模态框打开时，设置表单默认值
  useEffect(() => {
    if (visible && currentDefaults) {
      form.setFieldsValue({
        textModelId: currentDefaults.text_model?.id,
        embeddingModelId: currentDefaults.embedding_model?.id,
        rerankModelId: currentDefaults.rerank_model?.id
      });
    }
  }, [visible, currentDefaults, form]);
  
  return (
    <Modal
      title="设置默认模型"
      open={visible}
      onOk={onOk}
      onCancel={onCancel}
      confirmLoading={loading}
      width={600}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="textModelId"
              label={t('modelConfig.defaultModal.textModel')}
              tooltip={t('modelConfig.defaultModal.textModelTooltip')}
            >
              <Select
                placeholder={t('modelConfig.defaultModal.textModelPlaceholder')}
                allowClear
                showSearch
                filterOption={(input: any, option: any) =>
                  String(option?.label || '').toLowerCase().includes(input.toLowerCase())
                }
                options={modelConfigs
                  .filter(model => {
                    const modalities = model.modalities || [];
                    return modalities.includes('text_output');
                  })
                  .map(model => ({
                    value: model.id,
                    label: `${model.name} (${getProviderName(model.provider, t)})`,
                    model: model
                  }))
                }
                optionRender={(option) => (
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{option.data.model.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                      {getProviderName(option.data.model.provider, t)} - {option.data.model.model_id}
                    </div>
                  </div>
                )}
              />
            </Form.Item>
          </Col>
          
          <Col span={12}>
            <Form.Item
              name="embeddingModelId"
              label={t('modelConfig.defaultModal.embeddingModel')}
              tooltip={t('modelConfig.defaultModal.embeddingModelTooltip')}
            >
              <Select
                placeholder={t('modelConfig.defaultModal.embeddingModelPlaceholder')}
                allowClear
                showSearch
                filterOption={(input: any, option: any) =>
                  String(option?.label || '').toLowerCase().includes(input.toLowerCase())
                }
                options={modelConfigs
                  .filter(model => {
                    const modalities = model.modalities || [];
                    return modalities.includes('vector_output');
                  })
                  .map(model => ({
                    value: model.id,
                    label: `${model.name} (${getProviderName(model.provider, t)})`,
                    model: model
                  }))
                }
                optionRender={(option) => (
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{option.data.model.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                      {getProviderName(option.data.model.provider, t)} - {option.data.model.model_id}
                    </div>
                  </div>
                )}
              />
            </Form.Item>
          </Col>
        </Row>
        
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="rerankModelId"
              label={t('modelConfig.defaultModal.rerankModel')}
              tooltip={t('modelConfig.defaultModal.rerankModelTooltip')}
            >
              <Select
                placeholder={t('modelConfig.defaultModal.rerankModelPlaceholder')}
                allowClear
                showSearch
                filterOption={(input: any, option: any) =>
                  String(option?.label || '').toLowerCase().includes(input.toLowerCase())
                }
                options={modelConfigs
                  .filter(model => {
                    const modalities = model.modalities || [];
                    return modalities.includes('rerank_output');
                  })
                  .map(model => ({
                    value: model.id,
                    label: `${model.name} (${getProviderName(model.provider, t)})`,
                    model: model
                  }))
                }
                optionRender={(option) => (
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{option.data.model.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                      {getProviderName(option.data.model.provider, t)} - {option.data.model.model_id}
                    </div>
                  </div>
                )}
              />
            </Form.Item>
          </Col>
        </Row>
        
        {/* 显示当前默认模型信息 */}
        {(currentDefaults.text_model || currentDefaults.embedding_model || currentDefaults.rerank_model) && (
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--custom-hover-bg)', borderRadius: '6px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{t('modelConfig.defaultModal.currentDefaults')}:</div>
            {currentDefaults.text_model && (
              <div style={{ marginBottom: '4px' }}>
                <Text type="secondary">{t('modelConfig.defaultModal.textGeneration')}：</Text>
                <Text>
                  {currentDefaults.text_model.name} 
                  ({getProviderName(currentDefaults.text_model.provider, t)})
                </Text>
              </div>
            )}
            {currentDefaults.embedding_model && (
              <div style={{ marginBottom: '4px' }}>
                <Text type="secondary">{t('modelConfig.defaultModal.embedding')}：</Text>
                <Text>
                  {currentDefaults.embedding_model.name} 
                  ({getProviderName(currentDefaults.embedding_model.provider, t)})
                </Text>
              </div>
            )}
            {currentDefaults.rerank_model && (
              <div>
                <Text type="secondary">{t('modelConfig.defaultModal.rerank')}：</Text>
                <Text>
                  {currentDefaults.rerank_model.name} 
                  ({getProviderName(currentDefaults.rerank_model.provider, t)})
                </Text>
              </div>
            )}
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default React.memo(DefaultModelModal);
