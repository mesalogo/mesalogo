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

const { Text, Paragraph } = Typography;

// 测试查询Modal组件
const GraphEnhancementTestQuery = ({ visible, onCancel, onQuery, loading, result, config }: any) => {
  const { message } = App.useApp();
  const [queryForm] = Form.useForm();
  const [advancedMode, setAdvancedMode] = useState(false);
  const selectedSearchMode = Form.useWatch('search_mode', queryForm);

  const handleQuery = () => {
    queryForm.validateFields().then(values => {
      // 检查查询内容是否为空
      if (!values.query || values.query.trim() === '') {
        message.error('请输入查询内容');
        return;
      }

      // 根据模式添加额外参数
      const queryData = {
        ...values,
        advanced_mode: advancedMode
      };
      onQuery(queryData);
    }).catch(errorInfo => {
      console.log('表单验证失败:', errorInfo);

      // 提取具体的验证错误信息
      if (errorInfo.errorFields && errorInfo.errorFields.length > 0) {
        const firstError = errorInfo.errorFields[0];
        message.error(firstError.errors[0] || '请检查输入内容');
      } else {
        message.error('请检查输入内容');
      }
    });
  };

  // 根据框架类型显示不同的参数界面
  const isGraphiti = config?.framework === 'graphiti';

  // 统一的搜索模式配置
  const searchModes = [
    // 基于搜索策略的配置
    {
      value: 'cross_encoder',
      label: 'Cross-Encoder',
      description: '交叉编码器重排序 - 最高精度，适合复杂查询',
      category: '搜索策略'
    },
    {
      value: 'rrf',
      label: 'RRF',
      description: '倒数排名融合 - 平衡性能和质量',
      category: '搜索策略'
    },
    {
      value: 'mmr',
      label: 'MMR',
      description: '最大边际相关性 - 多样性结果',
      category: '搜索策略'
    },
    // 基于查询类型的特化配置
    {
      value: 'factual',
      label: '事实查询',
      description: '专门用于"什么是"、"谁是"类问题',
      category: '查询类型'
    },
    {
      value: 'temporal',
      label: '时间查询',
      description: '专门用于"最近发生"、"历史变化"类问题',
      category: '查询类型'
    }
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SearchOutlined />
          图谱查询测试
          {isGraphiti && (
            <Switch
             
              checked={advancedMode}
              onChange={setAdvancedMode}
              checkedChildren="高级"
              unCheckedChildren="简单"
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
          关闭
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
          {/* 查询内容 */}
          <Form.Item
            name="query"
            label="查询内容"
            rules={[{ required: true, message: '请输入查询内容' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="请输入要查询的内容..."
            />
          </Form.Item>

          {isGraphiti ? (
            advancedMode ? (
              // 高级模式界面
              <Tabs
                defaultActiveKey="search"
                items={[
                  {
                    key: 'search',
                    label: '搜索配置',
                    children: (
                      <>
                        <Form.Item name="search_mode" label="搜索模式">
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
                            配置说明：{(searchModes.find(m => m.value === selectedSearchMode)?.description) || '请选择上方的搜索模式以查看说明'}
                          </Text>
                        </div>
                      </>
                    )
                  },
                  {
                    key: 'params',
                    label: '参数配置',
                    children: (
                      <>
                        <Row gutter={16}>
                          <Col span={8}>
                            <Form.Item name="max_facts" label="最大结果数">
                              <InputNumber min={1} max={50} placeholder="默认15" style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item name="reranker_min_score" label="重排序阈值">
                              <InputNumber min={0} max={1} step={0.1} placeholder="默认0.6" style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item name="sim_min_score" label="相似度阈值">
                              <InputNumber min={0} max={1} step={0.1} placeholder="默认0.5" style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                        </Row>

                        <Form.Item name="group_ids" label="组ID (可选)">
                          <Select mode="tags" placeholder="输入组ID，支持多个" style={{ width: '100%' }} />
                        </Form.Item>
                      </>
                    )
                  },
                  {
                    key: 'filters',
                    label: '过滤器',
                    children: (
                      <>
                        <Form.Item name="enable_filters" valuePropName="checked">
                          <Checkbox>启用搜索过滤器</Checkbox>
                        </Form.Item>

                        <Form.Item name="node_labels" label="节点标签">
                          <Select mode="tags" placeholder="选择或输入节点标签" style={{ width: '100%' }}>
                            <Select.Option value="User">用户</Select.Option>
                            <Select.Option value="Product">产品</Select.Option>
                            <Select.Option value="Event">事件</Select.Option>
                            <Select.Option value="Organization">组织</Select.Option>
                          </Select>
                        </Form.Item>

                        <Form.Item name="edge_types" label="关系类型">
                          <Select mode="tags" placeholder="选择或输入关系类型" style={{ width: '100%' }}>
                            <Select.Option value="KNOWS">认识</Select.Option>
                            <Select.Option value="LIKES">喜欢</Select.Option>
                            <Select.Option value="PURCHASED">购买</Select.Option>
                            <Select.Option value="WORKS_FOR">工作于</Select.Option>
                          </Select>
                        </Form.Item>
                      </>
                    )
                  }
                ]}
              />
            ) : (
              // 简单模式界面（保持原有的Graphiti简化界面）
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="max_facts" label="最大结果数">
                    <InputNumber
                      min={1}
                      max={100}
                     
                      style={{ width: '100%' }}
                      placeholder="默认10"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="group_ids" label="组ID (可选)">
                    <Select
                      mode="tags"
                     
                      placeholder="输入组ID，支持多个"
                      style={{ width: '100%' }}
                      tokenSeparators={[',']}
                    />
                  </Form.Item>
                </Col>
              </Row>
            )
          ) : (
            // LightRAG 等其他框架的完整参数界面
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="mode" label="查询模式">
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
                <Form.Item name="response_type" label="响应类型">
                  <Radio.Group>
                    <Radio.Button value="Multiple Paragraphs">多段落</Radio.Button>
                    <Radio.Button value="Single Paragraph">单段落</Radio.Button>
                  </Radio.Group>
                </Form.Item>
              </Col>
            </Row>
          )}
        </Form>

        {/* 执行查询按钮 */}
        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <Button
            type="primary"
            onClick={handleQuery}
            loading={loading}
            icon={<SearchOutlined />}
            size="large"
            block
          >
            执行查询
          </Button>
        </div>

        {/* 结果显示区域 */}
        {result && (
          <div style={{ marginTop: 16 }}>
            <Divider>查询结果</Divider>
            <Alert
              message={
                <Space wrap>
                  <Text strong>响应时间:</Text> {result.response_time?.toFixed(2)}s
                  {isGraphiti && advancedMode ? (
                    <>
                      <Text strong>搜索模式:</Text> {result.search_config}
                      <Text strong>结果数量:</Text> {result.total_results}
                    </>
                  ) : (
                    <>
                      <Text strong>查询模式:</Text> {result.query_params?.mode || result.search_config || 'N/A'}
                      <Text strong>结果数量:</Text> {result.total_results || 0}
                    </>
                  )}
                  <Text strong>框架:</Text> {result.framework}
                </Space>
              }
              type="info"
              style={{ marginBottom: 16 }}
            />
            
            {/* 根据结果类型显示不同的界面 */}
            {result.result && typeof result.result === 'object' && result.result.facts && Array.isArray(result.result.facts) ? (
              // 结构化facts结果 - 列表显示
              <List
                dataSource={result.result.facts}
                renderItem={(fact, index) => (
                  <List.Item>
                    <Card
                     
                      style={{ width: '100%' }}
                      title={
                        <Space>
                          <Badge count={index + 1} style={{ backgroundColor: '#1677ff' }} />
                          <Text strong>事实 {index + 1}</Text>
                          {(fact as any).score && (
                            <Tag color="blue">相关度: {(Number((fact as any).score) * 100).toFixed(1)}%</Tag>
                          )}
                        </Space>
                      }
                    >
                      <Paragraph
                        ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
                        style={{ marginBottom: 8 }}
                      >
                        {(fact as any).fact || (fact as any).content || '无内容'}
                      </Paragraph>

                      {/* 显示时间信息 */}
                      {(fact as any).created_at && (
                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            创建时间: {new Date((fact as any).created_at).toLocaleString()}
                          </Text>
                          {(fact as any).expired_at && (
                            <Text type="secondary" style={{ fontSize: '12px', marginLeft: 16 }}>
                              过期时间: {new Date((fact as any).expired_at).toLocaleString()}
                            </Text>
                          )}
                          {(fact as any).invalid_at && (
                            <Text type="secondary" style={{ fontSize: '12px', marginLeft: 16 }}>
                              失效时间: {new Date((fact as any).invalid_at).toLocaleString()}
                            </Text>
                          )}
                        </div>
                      )}

                      {/* 显示其他元数据 */}
                      <div style={{ marginTop: 8 }}>
                        <Space wrap>
                          {(fact as any).name && (
                            <Tag color="blue">类型: {(fact as any).name}</Tag>
                          )}
                          {(fact as any).entity_name && (
                            <Tag color="green">实体: {(fact as any).entity_name}</Tag>
                          )}
                          {(fact as any).relation_name && (
                            <Tag color="orange">关系: {(fact as any).relation_name}</Tag>
                          )}
                          {(fact as any).expired_at && (
                            <Tag color="red">已过期</Tag>
                          )}
                          {(fact as any).invalid_at && (
                            <Tag color="volcano">已失效</Tag>
                          )}
                        </Space>
                      </div>
                    </Card>
                  </List.Item>
                )}
                locale={{ emptyText: '未找到相关事实' }}
              />
            ) : (
              // 传统文本结果 - 卡片显示
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
