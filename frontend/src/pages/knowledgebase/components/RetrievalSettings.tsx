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
      console.error('加载Reranker模型失败:', error);
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
      console.error('获取检索配置失败:', error);
      message.error('获取检索配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const values = await form.validateFields();
      
      // 额外校验：如果启用Reranker但未选择模型，提示错误
      if (values.enable_reranker && !values.reranker_model_id) {
        message.error('请选择Reranker模型，或关闭Reranker功能');
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
        message.success('检索配置保存成功');
        // 通知父组件刷新数据
        if (onSettingsSaved) {
          onSettingsSaved();
        }
      } else {
        message.error(response.message || '保存失败');
      }
    } catch (error) {
      console.error('保存检索配置失败:', error);
      message.error('保存检索配置失败');
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
            <span>检索配置</span>
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

          {/* BM25参数固定为学术界推荐值（k1=1.5, b=0.75），不在UI暴露 */}

          {/* 混合检索权重配置 */}
          {searchMode === 'hybrid' && (
            <>
              <Divider>
                <Space>
                  <MergeCellsOutlined />
                  <Text strong>混合检索权重</Text>
                </Space>
              </Divider>

              <Form.Item
                name="vector_weight"
                label={
                  <Space>
                    <Text strong>检索权重配比</Text>
                    <Text type="secondary">
                      (向量 {vectorWeight}% : 关键字 {100 - vectorWeight}%)
                    </Text>
                  </Space>
                }
                tooltip="调整向量检索和关键字检索的权重比例。70%向量+30%关键字是推荐值，平衡语义理解和精确匹配"
              >
                <div style={{ width: '80%', margin: '0 auto' }}>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={vectorWeight}
                    marks={{
                      0: '纯关键字',
                      50: '均衡',
                      70: '推荐',
                      100: '纯向量'
                    }}
                    onChange={(value) => {
                      setVectorWeight(value);
                      form.setFieldValue('vector_weight', value);
                    }}
                    tooltip={{
                      formatter: (value) => `向量${value}% : 关键字${100-value}%`
                    }}
                  />
                </div>
              </Form.Item>
            </>
          )}

          <Divider />

          {/* 通用检索参数 - 对所有模式生效 */}
          <Title level={5}>
            <Space>
              <NumberOutlined />
              通用检索参数
              <Text type="secondary" style={{ fontSize: '12px', fontWeight: 'normal' }}>
                (适用于所有检索模式)
              </Text>
            </Space>
          </Title>

          <Form.Item
            name="top_k"
            label={
              <Space>
                <Text strong>TopK</Text>
                <Text type="secondary">(返回最相关的结果数量)</Text>
              </Space>
            }
            tooltip="控制检索时返回的最相关文档片段数量。适用于向量检索、BM25检索和混合检索"
          >
            <InputNumber
              min={1}
              max={100}
              style={{ width: '200px' }}
              placeholder="请输入TopK值"
            />
          </Form.Item>

          <Form.Item
            name="score_threshold"
            label={
              <Space>
                <FilterOutlined />
                <Text strong>相似度过滤阈值</Text>
                <Text type="secondary">(0-1之间)</Text>
              </Space>
            }
            tooltip="只返回相似度分数高于此阈值的结果。适用于所有检索模式，0为不过滤，1为最严格"
          >
            <InputNumber
              min={0}
              max={1}
              step={0.05}
              style={{ width: '200px' }}
              placeholder="请输入阈值"
            />
          </Form.Item>

          <Divider />

          {/* 高级功能 */}
          <Title level={5}>
            <Space>
              <ShareAltOutlined />
              高级功能
            </Space>
          </Title>

          <Form.Item
            name="enable_reranker"
            valuePropName="checked"
            tooltip="使用Reranker模型对检索结果进行二次排序，提升准确度（会增加0.5-2秒延迟）。支持API服务（有base_url）和本地模型（无base_url）两种模式"
          >
            <Checkbox onChange={(e) => {
              const checked = e.target.checked;
              setEnableReranker(checked);
              // 如果启用但没有可用模型，提示用户
              if (checked && rerankModels.length === 0) {
                message.warning('暂无可用的Reranker模型，请先在「模型配置」页面添加');
              }
            }}>
              Reranker重排序
            </Checkbox>
          </Form.Item>

          {/* Reranker模型选择 */}
          {enableReranker && (
            <>
              <Form.Item
                name="reranker_model_id"
                label={
                  <Space>
                    <Text strong>Reranker模型</Text>
                  </Space>
                }
                tooltip="选择用于重排序的模型"
                rules={[{ required: true, message: '请选择Reranker模型' }]}
              >
                <Select
                  placeholder="选择Reranker模型"
                  style={{ width: '100%' }}
                  options={rerankModels.map(model => ({
                    label: `${model.name} (${model.provider})`,
                    value: model.id
                  }))}
                  notFoundContent={
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <Text type="secondary">暂无可用的Reranker模型</Text>
                      <div style={{ marginTop: '8px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          请先在「模型配置」页面添加Reranker模型（modalities需包含rerank_output）
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
                <Text strong>图谱增强</Text>
              </Space>
            }
            tooltip="启用图谱增强可以通过知识图谱技术提升检索准确性和上下文理解能力"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="启用"
              unCheckedChildren="禁用"
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
                <Text strong>💡 配置说明</Text>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
                <li><Text strong>检索模式：</Text>向量检索（语义理解）、关键字检索（精确匹配）或混合检索（推荐）</li>
                <li><Text strong>混合权重：</Text>推荐70%向量+30%关键字，平衡语义和精确</li>
                <li><Text strong>TopK：</Text>建议3-10，控制返回结果数量（Reranker也使用此值）</li>
                <li><Text strong>相似度阈值：</Text>建议0.0-0.3，过高可能过滤掉相关结果</li>
                <li><Text strong>Reranker：</Text>对TopK*2个候选进行二次排序，返回TopK个结果，提升准确度10-15%</li>
                <li><Text strong>图谱增强：</Text>利用知识图谱关系提升检索理解</li>
                <li><Text type="secondary">BM25参数(k1=1.5, b=0.75)和融合算法(加权融合)已优化为业界推荐值</Text></li>
              </ul>
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default RetrievalSettings;
