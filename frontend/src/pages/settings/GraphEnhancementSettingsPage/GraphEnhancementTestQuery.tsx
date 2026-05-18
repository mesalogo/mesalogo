import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Alert,
  Select,
  Tooltip,
  Tabs,
  Switch,
  Radio,
  Checkbox,
  Divider,
  List,
  Card,
  Badge,
  Tag,
  App
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text, Paragraph } = Typography;

// graph enhancement test-query modal
const GraphEnhancementTestQuery = ({ visible, onCancel, onQuery, loading, result, config }: any) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [queryForm] = Form.useForm();
  const [advancedMode, setAdvancedMode] = useState(false);
  const selectedSearchMode = Form.useWatch('search_mode', queryForm);

  const handleQuery = () => {
    queryForm.validateFields().then(values => {
      if (!values.query || values.query.trim() === '') {
        message.error(t('graphTest.msg.enterQuery'));
        return;
      }

      const queryData = {
        ...values,
        advanced_mode: advancedMode
      };
      onQuery(queryData);
    }).catch(errorInfo => {
      console.log('form validation failed:', errorInfo);

      if (errorInfo.errorFields && errorInfo.errorFields.length > 0) {
        const firstError = errorInfo.errorFields[0];
        message.error(firstError.errors[0] || t('graphTest.msg.checkInput'));
      } else {
        message.error(t('graphTest.msg.checkInput'));
      }
    });
  };

  const isGraphiti = config?.framework === 'graphiti';

  // search-mode configuration
  const searchModes = [
    {
      value: 'cross_encoder',
      label: 'Cross-Encoder',
      description: t('graphTest.mode.crossEncoderDesc'),
      category: t('graphTest.mode.cat.strategy')
    },
    {
      value: 'rrf',
      label: 'RRF',
      description: t('graphTest.mode.rrfDesc'),
      category: t('graphTest.mode.cat.strategy')
    },
    {
      value: 'mmr',
      label: 'MMR',
      description: t('graphTest.mode.mmrDesc'),
      category: t('graphTest.mode.cat.strategy')
    },
    {
      value: 'factual',
      label: t('graphTest.mode.factualLabel'),
      description: t('graphTest.mode.factualDesc'),
      category: t('graphTest.mode.cat.queryType')
    },
    {
      value: 'temporal',
      label: t('graphTest.mode.temporalLabel'),
      description: t('graphTest.mode.temporalDesc'),
      category: t('graphTest.mode.cat.queryType')
    }
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SearchOutlined />
          {t('graphTest.title')}
          {isGraphiti && (
            <Switch

              checked={advancedMode}
              onChange={setAdvancedMode}
              checkedChildren={t('graphTest.mode.advanced')}
              unCheckedChildren={t('graphTest.mode.simple')}
            />
          )}
        </div>
      }
      open={visible}
      onCancel={onCancel}
      width={900}
      destroyOnHidden={true}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          {t('graphTest.close')}
        </Button>
      ]}
    >
      <div>
        <Form
          form={queryForm}
          layout="vertical"
          initialValues={isGraphiti ? (advancedMode ? {
            max_facts: 15,
            group_ids: [],
            search_mode: 'cross_encoder',
            reranker_min_score: 0.6,
            sim_min_score: 0.5,
            enable_filters: false,
            node_labels: [],
            edge_types: []
          } : {
            max_facts: 10,
            group_ids: []
          }) : {
            mode: config?.default_query_mode || 'hybrid',
            top_k: config?.top_k || 60,
            chunk_top_k: config?.chunk_top_k || 10,
            response_type: 'Multiple Paragraphs'
          }}
        >
          {/* query content */}
          <Form.Item
            name="query"
            label={t('graphTest.field.query')}
            rules={[{ required: true, message: t('graphTest.msg.enterQuery') }]}
          >
            <Input.TextArea
              rows={3}
              placeholder={t('graphTest.ph.query')}
            />
          </Form.Item>

          {isGraphiti ? (
            advancedMode ? (
              // advanced mode
              <Tabs
                defaultActiveKey="search"
                items={[
                  {
                    key: 'search',
                    label: t('graphTest.tab.search'),
                    children: (
                      <>
                        <Form.Item name="search_mode" label={t('graphTest.field.searchMode')}>
                          <Radio.Group>
                            {searchModes.map(mode => (
                              <Radio.Button key={mode.value} value={mode.value}>
                                <Tooltip title={`${mode.category}: ${mode.description}`}>
                                  {mode.label}
                                </Tooltip>
                              </Radio.Button>
                            ))}
                          </Radio.Group>
                        </Form.Item>

                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {t('graphTest.configHintPrefix')}{(searchModes.find(m => m.value === selectedSearchMode)?.description) || t('graphTest.pickModeHint')}
                          </Text>
                        </div>
                      </>
                    )
                  },
                  {
                    key: 'params',
                    label: t('graphTest.tab.params'),
                    children: (
                      <>
                        <Row gutter={16}>
                          <Col span={8}>
                            <Form.Item name="max_facts" label={t('graphTest.field.maxResults')}>
                              <InputNumber min={1} max={50} placeholder={t('graphTest.ph.default15')} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item name="reranker_min_score" label={t('graphTest.field.rerankerThreshold')}>
                              <InputNumber min={0} max={1} step={0.1} placeholder={t('graphTest.ph.default06')} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item name="sim_min_score" label={t('graphTest.field.simThreshold')}>
                              <InputNumber min={0} max={1} step={0.1} placeholder={t('graphTest.ph.default05')} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                        </Row>

                        <Form.Item name="group_ids" label={t('graphTest.field.groupIds')}>
                          <Select mode="tags" placeholder={t('graphTest.ph.groupIds')} style={{ width: '100%' }} />
                        </Form.Item>
                      </>
                    )
                  },
                  {
                    key: 'filters',
                    label: t('graphTest.tab.filters'),
                    children: (
                      <>
                        <Form.Item name="enable_filters" valuePropName="checked">
                          <Checkbox>{t('graphTest.enableFilters')}</Checkbox>
                        </Form.Item>

                        <Form.Item name="node_labels" label={t('graphTest.field.nodeLabels')}>
                          <Select mode="tags" placeholder={t('graphTest.ph.nodeLabels')} style={{ width: '100%' }}>
                            <Select.Option value="User">{t('graphTest.nodeLabel.user')}</Select.Option>
                            <Select.Option value="Product">{t('graphTest.nodeLabel.product')}</Select.Option>
                            <Select.Option value="Event">{t('graphTest.nodeLabel.event')}</Select.Option>
                            <Select.Option value="Organization">{t('graphTest.nodeLabel.organization')}</Select.Option>
                          </Select>
                        </Form.Item>

                        <Form.Item name="edge_types" label={t('graphTest.field.edgeTypes')}>
                          <Select mode="tags" placeholder={t('graphTest.ph.edgeTypes')} style={{ width: '100%' }}>
                            <Select.Option value="KNOWS">{t('graphTest.edge.knows')}</Select.Option>
                            <Select.Option value="LIKES">{t('graphTest.edge.likes')}</Select.Option>
                            <Select.Option value="PURCHASED">{t('graphTest.edge.purchased')}</Select.Option>
                            <Select.Option value="WORKS_FOR">{t('graphTest.edge.worksFor')}</Select.Option>
                          </Select>
                        </Form.Item>
                      </>
                    )
                  }
                ]}
              />
            ) : (
              // simple Graphiti mode
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="max_facts" label={t('graphTest.field.maxResults')}>
                    <InputNumber
                      min={1}
                      max={100}

                      style={{ width: '100%' }}
                      placeholder={t('graphTest.ph.default10')}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="group_ids" label={t('graphTest.field.groupIds')}>
                    <Select
                      mode="tags"

                      placeholder={t('graphTest.ph.groupIds')}
                      style={{ width: '100%' }}
                      tokenSeparators={[',']}
                    />
                  </Form.Item>
                </Col>
              </Row>
            )
          ) : (
            // LightRAG / other frameworks
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="mode" label={t('graphTest.field.queryMode')}>
                  <Radio.Group>
                    <Radio.Button value="hybrid">Hybrid</Radio.Button>
                    <Radio.Button value="local">Local</Radio.Button>
                    <Radio.Button value="global">Global</Radio.Button>
                    <Radio.Button value="mix">Mix</Radio.Button>
                  </Radio.Group>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="top_k" label="Top-K">
                  <InputNumber min={1} max={200} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="response_type" label={t('graphTest.field.responseType')}>
                  <Radio.Group>
                    <Radio.Button value="Multiple Paragraphs">{t('graphTest.respType.multi')}</Radio.Button>
                    <Radio.Button value="Single Paragraph">{t('graphTest.respType.single')}</Radio.Button>
                  </Radio.Group>
                </Form.Item>
              </Col>
            </Row>
          )}
        </Form>

        {/* execute button */}
        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <Button
            type="primary"
            onClick={handleQuery}
            loading={loading}
            icon={<SearchOutlined />}
            size="large"
            block
          >
            {t('graphTest.execute')}
          </Button>
        </div>

        {/* results */}
        {result && (
          <div style={{ marginTop: 16 }}>
            <Divider>{t('graphTest.queryResult')}</Divider>
            <Alert
              message={
                <Space wrap>
                  <Text strong>{t('graphTest.result.responseTime')}</Text> {result.response_time?.toFixed(2)}s
                  {isGraphiti && advancedMode ? (
                    <>
                      <Text strong>{t('graphTest.result.searchMode')}</Text> {result.search_config}
                      <Text strong>{t('graphTest.result.count')}</Text> {result.total_results}
                    </>
                  ) : (
                    <>
                      <Text strong>{t('graphTest.result.queryMode')}</Text> {result.query_params?.mode || result.search_config || 'N/A'}
                      <Text strong>{t('graphTest.result.count')}</Text> {result.total_results || 0}
                    </>
                  )}
                  <Text strong>{t('graphTest.result.framework')}</Text> {result.framework}
                </Space>
              }
              type="info"
              style={{ marginBottom: 16 }}
            />

            {result.result && typeof result.result === 'object' && result.result.facts && Array.isArray(result.result.facts) ? (
              <List
                dataSource={result.result.facts}
                renderItem={(fact, index) => (
                  <List.Item>
                    <Card

                      style={{ width: '100%' }}
                      title={
                        <Space>
                          <Badge count={index + 1} style={{ backgroundColor: '#1677ff' }} />
                          <Text strong>{t('graphTest.fact.title', { n: index + 1 })}</Text>
                          {(fact as any).score && (
                            <Tag color="blue">{t('graphTest.fact.relevance', { pct: (Number((fact as any).score) * 100).toFixed(1) })}</Tag>
                          )}
                        </Space>
                      }
                    >
                      <Paragraph
                        ellipsis={{ rows: 3, expandable: true, symbol: t('graphTest.expand') }}
                        style={{ marginBottom: 8 }}
                      >
                        {(fact as any).fact || (fact as any).content || t('graphTest.fact.noContent')}
                      </Paragraph>

                      {(fact as any).created_at && (
                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {t('graphTest.fact.createdAt')} {new Date((fact as any).created_at).toLocaleString()}
                          </Text>
                          {(fact as any).expired_at && (
                            <Text type="secondary" style={{ fontSize: '12px', marginLeft: 16 }}>
                              {t('graphTest.fact.expiredAt')} {new Date((fact as any).expired_at).toLocaleString()}
                            </Text>
                          )}
                          {(fact as any).invalid_at && (
                            <Text type="secondary" style={{ fontSize: '12px', marginLeft: 16 }}>
                              {t('graphTest.fact.invalidAt')} {new Date((fact as any).invalid_at).toLocaleString()}
                            </Text>
                          )}
                        </div>
                      )}

                      <div style={{ marginTop: 8 }}>
                        <Space wrap>
                          {(fact as any).name && (
                            <Tag color="blue">{t('graphTest.fact.tagType', { v: (fact as any).name })}</Tag>
                          )}
                          {(fact as any).entity_name && (
                            <Tag color="green">{t('graphTest.fact.tagEntity', { v: (fact as any).entity_name })}</Tag>
                          )}
                          {(fact as any).relation_name && (
                            <Tag color="orange">{t('graphTest.fact.tagRelation', { v: (fact as any).relation_name })}</Tag>
                          )}
                          {(fact as any).expired_at && (
                            <Tag color="red">{t('graphTest.fact.expired')}</Tag>
                          )}
                          {(fact as any).invalid_at && (
                            <Tag color="volcano">{t('graphTest.fact.invalid')}</Tag>
                          )}
                        </Space>
                      </div>
                    </Card>
                  </List.Item>
                )}
                locale={{ emptyText: t('graphTest.fact.empty') }}
              />
            ) : (
              <Card>
                <Paragraph>
                  {typeof result.result === 'object' ? result.result.message : result.result}
                </Paragraph>
              </Card>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default GraphEnhancementTestQuery;
