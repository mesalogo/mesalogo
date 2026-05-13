// JointSpaceManagement.js
// 此文件包含联合空间管理组件，从ActionSpaceOverview.js拆分出来
// 功能：管理不同行动空间之间的联合关系，支持创建、查看和删除联合关系

import React, { useState, useEffect } from 'react';
import {
  Card, Button, Table, Empty,
  Space, Modal, Form, Input, message,
  Typography, Tag, Select, Spin,
  Divider, Tooltip, Progress
} from 'antd';
import {
  PlusOutlined, LinkOutlined,
  ArrowRightOutlined, SwapOutlined,
  InfoCircleOutlined, BarChartOutlined
} from '@ant-design/icons';
import { actionSpaceAPI } from '../../services/api/actionspace';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

// 模拟企业供应链关系数据
const mockJointRelationships = [
  {
    id: '1',
    name: '芯片供应关系',
    source_name: '半导体制造空间',
    target_name: '手机制造空间',
    type: '供应链关系',
    influence: '双向',
    active: true,
    confidence: 95,
    last_update: '2023-11-15'
  },
  {
    id: '2',
    name: '原材料供应链',
    source_name: '矿产资源空间',
    target_name: '半导体制造空间',
    type: '供应链关系',
    influence: '单向',
    active: true,
    confidence: 87,
    last_update: '2023-12-02'
  },
  {
    id: '3',
    name: '制造与组装关系',
    source_name: '手机制造空间',
    target_name: '消费电子销售空间',
    type: '供应链关系',
    influence: '单向',
    active: true,
    confidence: 92,
    last_update: '2023-10-25'
  },
  {
    id: '4',
    name: '电池供应链',
    source_name: '电池制造空间',
    target_name: '手机制造空间',
    type: '供应链关系',
    influence: '双向',
    active: true,
    confidence: 89,
    last_update: '2023-11-23'
  },
  {
    id: '5',
    name: '汽车零部件供应',
    source_name: '汽车零部件空间',
    target_name: '汽车制造空间',
    type: '供应链关系',
    influence: '双向',
    active: true,
    confidence: 94,
    last_update: '2023-12-10'
  },
  {
    id: '6',
    name: '智能家居制造链',
    source_name: '电子元件空间',
    target_name: '智能家居空间',
    type: '供应链关系',
    influence: '单向',
    active: false,
    confidence: 76,
    last_update: '2023-09-18'
  },
  {
    id: '7',
    name: '物流配送关系',
    source_name: '物流供应链空间',
    target_name: '电商平台空间',
    type: '供应链关系',
    influence: '双向',
    active: true,
    confidence: 91,
    last_update: '2023-10-30'
  },
  {
    id: '8',
    name: '医药原料供应',
    source_name: '医药原料空间',
    target_name: '制药企业空间',
    type: '供应链关系',
    influence: '单向',
    active: true,
    confidence: 88,
    last_update: '2023-11-05'
  }
];

// 模拟环境变量示例数据
const mockEnvironmentVariables = [
  {
    id: 'var-001',
    name: '芯片供应量',
    source: '半导体制造空间',
    affects: ['手机制造空间', '智能家居空间', '汽车制造空间'],
    propagation: '芯片产能下降导致下游电子产品生产延迟，影响终端供应和价格上涨',
    impact_level: '高',
    trend: '上升'
  },
  {
    id: 'var-002',
    name: '原材料价格',
    source: '矿产资源空间',
    affects: ['半导体制造空间', '电池制造空间'],
    propagation: '稀有金属价格上涨导致电子元件成本增加，最终传导至终端产品价格上升',
    impact_level: '中',
    trend: '上升'
  },
  {
    id: 'var-003',
    name: '运输成本',
    source: '物流供应链空间',
    affects: ['消费电子销售空间', '电商平台空间'],
    propagation: '运输成本增加导致终端产品配送价格上涨，影响消费者购买决策',
    impact_level: '中',
    trend: '稳定'
  },
  {
    id: 'var-004',
    name: '质量控制标准',
    source: '汽车制造空间',
    affects: ['汽车零部件空间'],
    propagation: '整车制造商提高零部件质量要求，倒逼上游供应商提升生产标准',
    impact_level: '高',
    trend: '上升'
  },
  {
    id: 'var-005',
    name: '消费者需求',
    source: '电商平台空间',
    affects: ['手机制造空间', '智能家居空间'],
    propagation: '消费者偏好变化影响终端产品设计和功能，进而影响上游制造环节',
    impact_level: '高',
    trend: '波动'
  },
  {
    id: 'var-006',
    name: '医药监管政策',
    source: '医药监管空间',
    affects: ['医药原料空间', '制药企业空间'],
    propagation: '监管政策变化影响药品研发和生产标准，改变整个医药供应链的合规成本',
    impact_level: '高',
    trend: '稳定'
  }
];

// 模拟供应链风险评估数据
const mockSupplyChainRisks = [
  {
    id: 'risk-001',
    name: '关键原材料供应中断',
    affected_spaces: ['半导体制造空间', '手机制造空间'],
    impact: '高',
    probability: '中',
    mitigation: '多元化供应商策略、增加库存缓冲'
  },
  {
    id: 'risk-002',
    name: '国际物流延迟',
    affected_spaces: ['物流供应链空间', '电商平台空间'],
    impact: '中',
    probability: '高',
    mitigation: '增加物流渠道选择、调整库存策略'
  },
  {
    id: 'risk-003',
    name: '质量控制问题',
    affected_spaces: ['汽车零部件空间', '汽车制造空间'],
    impact: '高',
    probability: '低',
    mitigation: '加强质检环节、建立追溯系统'
  },
  {
    id: 'risk-004',
    name: '市场需求波动',
    affected_spaces: ['消费电子销售空间', '手机制造空间'],
    impact: '中',
    probability: '中',
    mitigation: '加强需求预测、弹性生产能力'
  }
];

const JointSpaceManagement = () => {
  const navigate = useNavigate();
  const [actionSpaces, setActionSpaces] = useState([]);
  const [loading, setLoading] = useState(false);

  // 联合空间相关状态和方法
  const [jointRelationships, setJointRelationships] = useState(mockJointRelationships); // 使用模拟数据
  const [jointLoading, setJointLoading] = useState(false);
  const [jointModalVisible, setJointModalVisible] = useState(false);
  const [jointForm] = Form.useForm();

  // 获取行动空间列表
  useEffect(() => {
    fetchActionSpaces();
    // 使用模拟数据，不需要调用fetchJointRelationships
  }, []);

  const fetchActionSpaces = async () => {
    setLoading(true);
    try {
      const spacesResponse = await actionSpaceAPI.getAll();
      setActionSpaces(spacesResponse);
    } catch (error) {
      console.error('获取行动空间数据失败:', error);
      message.error('获取行动空间数据失败');
      setActionSpaces([]);
    } finally {
      setLoading(false);
    }
  };

  // 获取联合空间关系列表 (保留但不调用，使用模拟数据)
  const fetchJointRelationships = async () => {
    setJointLoading(true);
    try {
      const relationships = await actionSpaceAPI.getJointSpaces();
      setJointRelationships(relationships);
    } catch (error) {
      console.error('获取联合空间关系失败:', error);
      message.error('获取联合空间关系失败');
      setJointRelationships([]);
    } finally {
      setJointLoading(false);
    }
  };

  // 打开创建联合关系对话框
  const handleCreateJointRelation = () => {
    jointForm.resetFields();
    setJointModalVisible(true);
  };

  // 关闭创建联合关系对话框
  const handleJointModalCancel = () => {
    setJointModalVisible(false);
  };

  // 提交创建联合关系
  const handleJointModalSubmit = async () => {
    try {
      const values = await jointForm.validateFields();
      setJointLoading(true);

      // 获取源空间和目标空间的名称
      const sourceSpace = actionSpaces.find(space => space.id === values.source_id);
      const targetSpace = actionSpaces.find(space => space.id === values.target_id);

      // 构建联合关系数据
      const jointData: any = {
        id: `${jointRelationships.length + 1}`,
        name: values.name,
        source_id: values.source_id,
        target_id: values.target_id,
        type: values.type,
        influence: values.influence,
        active: true,
        confidence: Math.floor(Math.random() * 20) + 80, // 随机生成80-100的置信度
        last_update: new Date().toISOString().split('T')[0]
      };

      if (sourceSpace && targetSpace) {
        jointData.source_name = sourceSpace.name;
        jointData.target_name = targetSpace.name;
      }

      // 模拟API调用，直接添加到本地状态
      setJointRelationships([...jointRelationships, jointData]);
      message.success('联合关系创建成功');
      setJointModalVisible(false);
    } catch (error) {
      console.error('创建联合关系失败:', error);
      message.error('创建联合关系失败');
    } finally {
      setJointLoading(false);
    }
  };

  // 删除联合关系
  const handleDeleteJointRelation = async (id) => {
    try {
      // 模拟API调用
      setJointRelationships(jointRelationships.filter(relation => relation.id !== id));
      message.success('联合关系删除成功');
    } catch (error) {
      console.error('删除联合关系失败:', error);
      message.error('删除联合关系失败');
    }
  };

  // 渲染影响力进度条
  const renderConfidence = (confidence) => {
    let color = 'green';
    if (confidence < 80) color = 'orange';
    if (confidence < 70) color = 'red';

    return (
      <Tooltip title={`关系置信度: ${confidence}%`}>
        <Progress
          percent={confidence}
         
          status="active"
          strokeColor={color}
          style={{ width: 120 }}
        />
      </Tooltip>
    );
  };

  return (
    <div className="joint-space-container">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
      }}>
        <div>
          <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>联合空间管理</Title>
          <Text type="secondary">
            管理行动空间之间的联合关系，实现跨空间交互和影响传导
          </Text>
        </div>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>企业供应链联合空间管理</Title>
          <Paragraph>
            联合空间允许不同行动空间之间建立连接和互动关系，模拟真实世界中的复杂系统交互。
            企业供应链模型展示了从原材料供应商到终端销售的完整价值链，体现各环节之间的资源流动和信息传递。
          </Paragraph>
        </div>

        {jointLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <Spin>
              <div style={{ padding: '20px' }}>加载中...</div>
            </Spin>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Title level={5}>已建立的供应链关系</Title>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateJointRelation}>
                创建联合关系
              </Button>
            </div>

            {jointRelationships.length > 0 ? (
              <Table
                dataSource={jointRelationships}
                rowKey="id"
                columns={[
                  {
                    title: '关系名称',
                    dataIndex: 'name',
                    key: 'name',
                    render: (text) => <a href="javascript:void(0);">{text}</a>
                  },
                  {
                    title: '源空间',
                    dataIndex: 'source_name',
                    key: 'source_name',
                    render: (text) => (
                      <Tag color="blue">{text}</Tag>
                    )
                  },
                  {
                    title: '联系',
                    key: 'connection',
                    width: 80,
                    align: 'center' as const,
                    render: (_, record) => (
                      record.influence === '双向' ?
                        <SwapOutlined style={{ color: '#722ed1' }} /> :
                        <ArrowRightOutlined style={{ color: '#1677ff' }} />
                    )
                  },
                  {
                    title: '目标空间',
                    dataIndex: 'target_name',
                    key: 'target_name',
                    render: (text) => (
                      <Tag color="green">{text}</Tag>
                    )
                  },
                  {
                    title: '关系类型',
                    dataIndex: 'type',
                    key: 'type',
                    render: (type) => {
                      const tagColors = {
                        '投资关系': 'green',
                        '供应链关系': 'blue',
                        '监管关系': 'orange',
                        '竞争关系': 'red',
                        '合作关系': 'purple'
                      };
                      return <Tag color={tagColors[type] || 'default'}>{type}</Tag>;
                    }
                  },
                  {
                    title: '置信度',
                    dataIndex: 'confidence',
                    key: 'confidence',
                    render: renderConfidence
                  },
                  {
                    title: '状态',
                    dataIndex: 'active',
                    key: 'active',
                    render: (active) => active ?
                      <Tag color="success">活跃</Tag> :
                      <Tag color="default">停用</Tag>
                  },
                  {
                    title: '最近更新',
                    dataIndex: 'last_update',
                    key: 'last_update',
                  },
                  {
                    title: '操作',
                    key: 'action',
                    render: (_, record) => (
                      <Space>
                        <Button type="link" icon={<BarChartOutlined />}>分析</Button>
                        <Button type="link" danger onClick={() => handleDeleteJointRelation(record.id)}>删除</Button>
                      </Space>
                    )
                  }
                ]}
              />
            ) : (
              <Empty
                description="暂无联合空间关系"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}

            <Divider />

            <Title level={5} style={{ marginTop: 24 }}>供应链环境变量影响</Title>
            <Paragraph>
              <InfoCircleOutlined style={{ marginRight: 8 }} />
              以下变量展示供应链各环节间的关键影响因素，及其变化如何沿供应链传导
            </Paragraph>

            <Table
              dataSource={mockEnvironmentVariables}
              rowKey="id"
              style={{ marginBottom: 24 }}
              columns={[
                {
                  title: '变量名称',
                  dataIndex: 'name',
                  key: 'name',
                  render: (text) => <b>{text}</b>
                },
                {
                  title: '源空间',
                  dataIndex: 'source',
                  key: 'source',
                  render: (text) => <Tag color="blue">{text}</Tag>
                },
                {
                  title: '影响空间',
                  dataIndex: 'affects',
                  key: 'affects',
                  render: (affects) => (
                    <>
                      {affects.map(item => (
                        <Tag color="green" key={item} style={{ marginBottom: 4 }}>{item}</Tag>
                      ))}
                    </>
                  )
                },
                {
                  title: '影响程度',
                  dataIndex: 'impact_level',
                  key: 'impact_level',
                  render: (text) => {
                    const colors = { '高': 'red', '中': 'orange', '低': 'green' };
                    return <Tag color={colors[text]}>{text}</Tag>;
                  }
                },
                {
                  title: '变化趋势',
                  dataIndex: 'trend',
                  key: 'trend',
                  render: (text) => {
                    const colors = { '上升': 'red', '下降': 'green', '稳定': 'blue', '波动': 'purple' };
                    return <Tag color={colors[text]}>{text}</Tag>;
                  }
                },
                {
                  title: '传导机制',
                  dataIndex: 'propagation',
                  key: 'propagation',
                  ellipsis: {
                    showTitle: false,
                  },
                  render: (text) => (
                    <Tooltip placement="topLeft" title={text}>
                      {text}
                    </Tooltip>
                  ),
                }
              ]}
            />

            <Divider />

            <Title level={5}>供应链风险评估</Title>
            <Table
              dataSource={mockSupplyChainRisks}
              rowKey="id"
              size="middle"
              columns={[
                {
                  title: '风险点',
                  dataIndex: 'name',
                  key: 'name',
                  render: (text) => <b>{text}</b>
                },
                {
                  title: '影响空间',
                  dataIndex: 'affected_spaces',
                  key: 'affected_spaces',
                  render: (spaces) => (
                    <>
                      {spaces.map(space => (
                        <Tag color="purple" key={space} style={{ marginBottom: 4 }}>{space}</Tag>
                      ))}
                    </>
                  )
                },
                {
                  title: '影响程度',
                  dataIndex: 'impact',
                  key: 'impact',
                  render: (text) => {
                    const colors = { '高': 'red', '中': 'orange', '低': 'green' };
                    return <Tag color={colors[text]}>{text}</Tag>;
                  }
                },
                {
                  title: '发生概率',
                  dataIndex: 'probability',
                  key: 'probability',
                  render: (text) => {
                    const colors = { '高': 'red', '中': 'orange', '低': 'green' };
                    return <Tag color={colors[text]}>{text}</Tag>;
                  }
                },
                {
                  title: '缓解措施',
                  dataIndex: 'mitigation',
                  key: 'mitigation'
                }
              ]}
            />
          </>
        )}
      </Card>

      {/* 创建联合关系对话框 */}
      <Modal
        title="创建联合关系"
        visible={jointModalVisible}
        onCancel={handleJointModalCancel}
        onOk={handleJointModalSubmit}
        confirmLoading={jointLoading}
        width={600}
      >
        <Form
          form={jointForm}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="关系名称"
            rules={[{ required: true, message: '请输入关系名称' }]}
          >
            <Input placeholder="输入关系名称" />
          </Form.Item>

          <Form.Item
            name="source_id"
            label="源空间"
            rules={[{ required: true, message: '请选择源空间' }]}
          >
            <Select placeholder="选择源空间">
              {actionSpaces.map(space => (
                <Select.Option key={space.id} value={space.id}>{space.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="target_id"
            label="目标空间"
            rules={[{ required: true, message: '请选择目标空间' }]}
          >
            <Select placeholder="选择目标空间">
              {actionSpaces.map(space => (
                <Select.Option key={space.id} value={space.id}>{space.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="type"
            label="关系类型"
            rules={[{ required: true, message: '请选择关系类型' }]}
          >
            <Select placeholder="选择关系类型">
              <Select.Option value="投资关系">投资关系</Select.Option>
              <Select.Option value="供应链关系">供应链关系</Select.Option>
              <Select.Option value="监管关系">监管关系</Select.Option>
              <Select.Option value="竞争关系">竞争关系</Select.Option>
              <Select.Option value="合作关系">合作关系</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="influence"
            label="影响方向"
            rules={[{ required: true, message: '请选择影响方向' }]}
          >
            <Select placeholder="选择影响方向">
              <Select.Option value="双向">双向影响</Select.Option>
              <Select.Option value="单向">单向影响</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default JointSpaceManagement;