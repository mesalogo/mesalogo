import React, { useState, useEffect } from 'react';
import { Form, Switch, InputNumber, Divider, Space, Typography, App, Button, Card, Radio, Alert, Slider, Select, Checkbox } from 'antd';
import { SearchOutlined, ShareAltOutlined, FilterOutlined, NumberOutlined, ThunderboltOutlined, ExperimentOutlined, MergeCellsOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import knowledgeAPI from '../../../services/api/knowledge';
import { modelConfigAPI } from '../../../services/api/model';

const { Text, Title } = Typography;

const RetrievalSettings = ({ knowledgeId, onSettingsSaved }) => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchMode, setSearchMode] = useState('hybrid');
  const [vectorWeight, setVectorWeight] = useState(70); // 默认70%向量+30%关键字
  const [rerankModels, setRerankModels] = useState([]); // Reranker模型列表
  const [enableReranker, setEnableReranker] = useState(false); // 是否启用Reranker

  useEffect(() => {
    if (knowledgeId) {
      fetchSettings();
    }
    // 加载Reranker模型列表
    loadRerankModels();
  }, [knowledgeId]);

  const loadRerankModels = async () => {
    try {
      const configs = await modelConfigAPI.getAll();
      // 过滤出支持rerank_output的模型
      const rerankList = configs.filter(model =>
        model.modalities && model.modalities.includes('rerank_output')
      );
      setRerankModels(rerankList);
    } catch (error) {
      console.error('load reranker models failed:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await knowledgeAPI.getById(knowledgeId);
      
      if (response.success) {
        const settings = response.data.settings || {};
        const retrieval = settings.retrieval || {};
        const searchConfig = response.data.search_config || {};
        
        const mode = searchConfig.search_mode || 'hybrid';
        const weight = searchConfig.vector_weight !== undefined ? searchConfig.vector_weight * 100 : 70;
        const rerankerEnabled = searchConfig.enable_reranker || false;
        
        setSearchMode(mode);
        setVectorWeight(weight);
        setEnableReranker(rerankerEnabled);
        
        form.setFieldsValue({
          graph_enhancement_enabled: settings.graph_enhancement?.enabled || false,
          top_k: retrieval.top_k || 5,
          score_threshold: retrieval.score_threshold !== undefined ? retrieval.score_threshold : 0.0,
          search_mode: mode,
          vector_weight: weight,
          enable_reranker: rerankerEnabled,
          reranker_model_id: searchConfig.reranker_model_id || null
        });
      }
    } catch (error) {
      console.error('fetch retrieval settings failed:', error);
      message.error(t('retrievalSettings.msg.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const values = await form.validateFields();
      
      if (values.enable_reranker && !values.reranker_model_id) {
        message.error(t('retrievalSettings.msg.pickRerankerOrDisable'));
        setSaving(false);
        return;
      }
      
      // 构建 settings 对象
      const settings = {
        graph_enhancement: {
          enabled: values.graph_enhancement_enabled
        },
        retrieval: {
          top_k: values.top_k,
          score_threshold: values.score_threshold
        }
      };

      // 构建 search_config 对象
      const search_config = {
        search_mode: values.search_mode || 'hybrid',
        vector_weight: (values.vector_weight !== undefined ? values.vector_weight : 70) / 100, // 转换为0-1
        // 固定参数：对齐业界最佳实践
        fusion_method: 'weighted',  // 固定使用加权融合（业界主流）
        bm25_k1: 1.5,              // 学术界推荐值
        bm25_b: 0.75,              // 学术界推荐值
        // Reranker配置
        enable_reranker: values.enable_reranker || false,
        reranker_model_id: values.reranker_model_id || null
      };

      const response = await knowledgeAPI.update(knowledgeId, { settings, search_config });
      
      if (response.success) {
        message.success(t('retrievalSettings.msg.saveSuccess'));
        if (onSettingsSaved) {
          onSettingsSaved();
        }
      } else {
        message.error(response.message || t('retrievalSettings.msg.saveFailed'));
      }
    } catch (error) {
      console.error('save retrieval settings failed:', error);
      message.error(t('retrievalSettings.msg.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '0' }}>
      <Card 
        title={
          <Space>
            <SearchOutlined />
            <span>{t('retrievalSettings.title')}</span>
          </Space>
        }
        extra={
          <Button 
            type="primary" 
            onClick={handleSave}
            loading={saving}
          >
            {t('retrievalSettings.save')}
          </Button>
        }
        loading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            graph_enhancement_enabled: false,
            top_k: 5,
            score_threshold: 0.0,
            search_mode: 'hybrid',
            fusion_method: 'weighted',
            vector_weight: 70,
            bm25_k1: 1.5,
            bm25_b: 0.75,
            rrf_k: 60
          }}
        >
          <Alert
            message={t('knowledgeSearch.notice.title')}
            description={t('knowledgeSearch.notice.description')}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          {/* 检索模式 */}
          <Divider>
            <Space>
              <ThunderboltOutlined />
              <Text strong>{t('knowledgeSearch.searchMode.title')}</Text>
            </Space>
          </Divider>

          <Form.Item
            name="search_mode"
            label={t('knowledgeSearch.searchMode.label')}
            tooltip={t('knowledgeSearch.searchMode.tooltip')}
          >
            <Radio.Group onChange={(e) => setSearchMode(e.target.value)}>
              <Radio.Button value="vector">
                <Space>
                  {t('knowledgeSearch.searchMode.vector')}
                </Space>
              </Radio.Button>
              <Radio.Button value="bm25">
                <Space>
                  {t('knowledgeSearch.searchMode.bm25')}
                </Space>
              </Radio.Button>
              <Radio.Button value="hybrid">
                <Space>
                  {t('knowledgeSearch.searchMode.hybrid')}
                </Space>
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          {/* BM25 params fixed to academic recommended values; not exposed */}

          {/* hybrid search weight */}
          {searchMode === 'hybrid' && (
            <>
              <Divider>
                <Space>
                  <MergeCellsOutlined />
                  <Text strong>{t('retrievalSettings.hybridWeight')}</Text>
                </Space>
              </Divider>

              <Form.Item
                name="vector_weight"
                label={
                  <Space>
                    <Text strong>{t('retrievalSettings.weightRatio')}</Text>
                    <Text type="secondary">
                      {t('retrievalSettings.weightSuffix', { v: vectorWeight, k: 100 - vectorWeight })}
                    </Text>
                  </Space>
                }
                tooltip={t('retrievalSettings.weightTooltip')}
              >
                <div style={{ width: '80%', margin: '0 auto' }}>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={vectorWeight}
                    marks={{
                      0: t('retrievalSettings.mark.keywordOnly'),
                      50: t('retrievalSettings.mark.balanced'),
                      70: t('retrievalSettings.mark.recommended'),
                      100: t('retrievalSettings.mark.vectorOnly')
                    }}
                    onChange={(value) => {
                      setVectorWeight(value);
                      form.setFieldValue('vector_weight', value);
                    }}
                    tooltip={{
                      formatter: (value) => t('retrievalSettings.weightSliderTip', { v: value, k: 100 - value })
                    }}
                  />
                </div>
              </Form.Item>
            </>
          )}

          <Divider />

          {/* common retrieval params - applies to all modes */}
          <Title level={5}>
            <Space>
              <NumberOutlined />
              {t('retrievalSettings.commonParams')}
              <Text type="secondary" style={{ fontSize: '12px', fontWeight: 'normal' }}>
                {t('retrievalSettings.commonParamsHint')}
              </Text>
            </Space>
          </Title>

          <Form.Item
            name="top_k"
            label={
              <Space>
                <Text strong>TopK</Text>
                <Text type="secondary">{t('retrievalSettings.topKHint')}</Text>
              </Space>
            }
            tooltip={t('retrievalSettings.topKTooltip')}
          >
            <InputNumber
              min={1}
              max={100}
              style={{ width: '200px' }}
              placeholder={t('retrievalSettings.topKPh')}
            />
          </Form.Item>

          <Form.Item
            name="score_threshold"
            label={
              <Space>
                <FilterOutlined />
                <Text strong>{t('retrievalSettings.scoreThreshold')}</Text>
                <Text type="secondary">{t('retrievalSettings.scoreThresholdHint')}</Text>
              </Space>
            }
            tooltip={t('retrievalSettings.scoreThresholdTooltip')}
          >
            <InputNumber
              min={0}
              max={1}
              step={0.05}
              style={{ width: '200px' }}
              placeholder={t('retrievalSettings.scoreThresholdPh')}
            />
          </Form.Item>

          <Divider />

          {/* advanced */}
          <Title level={5}>
            <Space>
              <ShareAltOutlined />
              {t('retrievalSettings.advanced')}
            </Space>
          </Title>

          <Form.Item
            name="enable_reranker"
            valuePropName="checked"
            tooltip={t('retrievalSettings.rerankerTooltip')}
          >
            <Checkbox onChange={(e) => {
              const checked = e.target.checked;
              setEnableReranker(checked);
              if (checked && rerankModels.length === 0) {
                message.warning(t('retrievalSettings.msg.noRerankerModel'));
              }
            }}>
              {t('retrievalSettings.rerankerLabel')}
            </Checkbox>
          </Form.Item>

          {/* reranker model picker */}
          {enableReranker && (
            <>
              <Form.Item
                name="reranker_model_id"
                label={
                  <Space>
                    <Text strong>{t('retrievalSettings.rerankerModel')}</Text>
                  </Space>
                }
                tooltip={t('retrievalSettings.rerankerModelTooltip')}
                rules={[{ required: true, message: t('retrievalSettings.msg.pickRerankerModel') }]}
              >
                <Select
                  placeholder={t('retrievalSettings.pickRerankerModel')}
                  style={{ width: '100%' }}
                  options={rerankModels.map(model => ({
                    label: `${model.name} (${model.provider})`,
                    value: model.id
                  }))}
                  notFoundContent={
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <Text type="secondary">{t('retrievalSettings.noRerankerModelTitle')}</Text>
                      <div style={{ marginTop: '8px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {t('retrievalSettings.noRerankerModelDesc')}
                        </Text>
                      </div>
                    </div>
                  }
                />
              </Form.Item>


            </>
          )}

          <Form.Item
            name="graph_enhancement_enabled"
            label={
              <Space>
                <Text strong>{t('retrievalSettings.graphEnhance')}</Text>
              </Space>
            }
            tooltip={t('retrievalSettings.graphEnhanceTooltip')}
            valuePropName="checked"
          >
            <Switch
              checkedChildren={t('retrievalSettings.enabled')}
              unCheckedChildren={t('retrievalSettings.disabled')}
            />
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
                <Text strong>{t('retrievalSettings.help.title')}</Text>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
                <li><Text strong>{t('retrievalSettings.help.modeLabel')}</Text>{t('retrievalSettings.help.modeBody')}</li>
                <li><Text strong>{t('retrievalSettings.help.weightLabel')}</Text>{t('retrievalSettings.help.weightBody')}</li>
                <li><Text strong>{t('retrievalSettings.help.topkLabel')}</Text>{t('retrievalSettings.help.topkBody')}</li>
                <li><Text strong>{t('retrievalSettings.help.scoreLabel')}</Text>{t('retrievalSettings.help.scoreBody')}</li>
                <li><Text strong>{t('retrievalSettings.help.rerankerLabel')}</Text>{t('retrievalSettings.help.rerankerBody')}</li>
                <li><Text strong>{t('retrievalSettings.help.graphLabel')}</Text>{t('retrievalSettings.help.graphBody')}</li>
                <li><Text type="secondary">{t('retrievalSettings.help.bm25Note')}</Text></li>
              </ul>
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default RetrievalSettings;
