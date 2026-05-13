import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Tabs, Descriptions, Tag, Statistic, Row, Col,
  Button, Spin, message, Typography, Space, Avatar, Divider
} from 'antd';
import {
  RobotOutlined, RollbackOutlined, EditOutlined,
  DatabaseOutlined, MessageOutlined, HistoryOutlined
} from '@ant-design/icons';
import { agentAPI } from '../../../services/api/agent';
import AgentVariables from '../../../components/agent/AgentVariables';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const AgentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  // 获取代理详情
  const fetchAgentDetail = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const response = await agentAPI.get(id);
      setAgent(response);
    } catch (error) {
      console.error('获取代理详情失败:', error);
      message.error('获取代理详情失败');
      // 导航回上一页
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentDetail();
  }, [id]);

  // 返回列表页
  const handleBack = () => {
    navigate(-1);
  };

  // 编辑代理
  const handleEdit = () => {
    // 导航到编辑页面
    navigate(`/agents/edit/${id}`);
  };

  if (loading) {
    return (
      <div>
        {/* 显示页面框架 */}
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button icon={<RollbackOutlined />} onClick={handleBack} disabled={true}>
              返回
            </Button>
            <Title level={4} style={{ margin: 0 }}>
              <Space>
                <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1677ff' }} />
                加载中...
              </Space>
            </Title>
          </Space>
          <Button type="primary" icon={<EditOutlined />} disabled={true}>
            编辑代理
          </Button>
        </div>

        <div style={{ position: 'relative' }}>
          {/* 加载指示器 - 绝对定位，不影响布局 */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Spin size="large" />
            <div style={{ color: '#1677ff', fontSize: '14px' }}>加载代理详情</div>
          </div>

          {/* 页面框架 - 完全透明背景 */}
          <div style={{ opacity: 0.3 }}>
            <Card style={{ marginBottom: '20px', minHeight: '200px' }}>
              {/* 基本信息框架 */}
            </Card>

            <Tabs defaultActiveKey="variables">
              <TabPane
                tab={<span><DatabaseOutlined />代理变量</span>}
                key="variables"
              >
                <div style={{ minHeight: '200px' }} />
              </TabPane>
              <TabPane
                tab={<span><MessageOutlined />消息记录</span>}
                key="messages"
              >
                <div style={{ minHeight: '200px' }} />
              </TabPane>
              <TabPane
                tab={<span><HistoryOutlined />活动历史</span>}
                key="history"
              >
                <div style={{ minHeight: '200px' }} />
              </TabPane>
            </Tabs>
          </div>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <Title level={3}>未找到代理</Title>
        <Button onClick={handleBack} icon={<RollbackOutlined />}>
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<RollbackOutlined />} onClick={handleBack}>
            返回
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            <Space>
              <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1677ff' }} />
              {agent.name}
            </Space>
          </Title>
        </Space>
        <Button type="primary" icon={<EditOutlined />} onClick={handleEdit}>
          编辑代理
        </Button>
      </div>

      <Card style={{ marginBottom: '20px' }}>
        <Descriptions title="代理基本信息" bordered column={2}>
          <Descriptions.Item label="ID">{agent.id}</Descriptions.Item>
          <Descriptions.Item label="名称">{agent.name}</Descriptions.Item>
          <Descriptions.Item label="角色">{agent.role?.name || '未设置'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={
              agent.status === 'active' ? 'success' :
              agent.status === 'idle' ? 'default' :
              agent.status === 'busy' ? 'processing' :
              'error'
            }>
              {
                agent.status === 'active' ? '活跃' :
                agent.status === 'idle' ? '空闲' :
                agent.status === 'busy' ? '忙碌' :
                '离线'
              }
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {agent.description || '无描述'}
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        <Row gutter={16}>
          <Col span={8}>
            <Statistic title="总会话数" value={agent.conversation_count || 0} />
          </Col>
          <Col span={8}>
            <Statistic title="总消息数" value={agent.message_count || 0} />
          </Col>
          <Col span={8}>
            <Statistic title="平均响应时间" value={agent.avg_response_time || 0} suffix="ms" />
          </Col>
        </Row>
      </Card>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={<span><DatabaseOutlined />代理变量</span>}
          key="variables"
        >
          <AgentVariables agentId={id} />
        </TabPane>
        <TabPane
          tab={<span><MessageOutlined />消息记录</span>}
          key="messages"
        >
          <Card>
            <Text>暂无消息记录</Text>
          </Card>
        </TabPane>
        <TabPane
          tab={<span><HistoryOutlined />活动历史</span>}
          key="history"
        >
          <Card>
            <Text>暂无活动历史</Text>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default AgentDetail;