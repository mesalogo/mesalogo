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
import { useTranslation } from 'react-i18next';
import { agentAPI } from '../../../services/api/agent';
import AgentVariables from '../../../components/agent/AgentVariables';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const AgentDetail = () => {
  const { t } = useTranslation();
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
      console.error('Failed to fetch agent details:', error);
      message.error(t('agentDetail.fetchFailed'));
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
              {t('agentDetail.back')}
            </Button>
            <Title level={4} style={{ margin: 0 }}>
              <Space>
                <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1677ff' }} />
                {t('agentDetail.loading')}
              </Space>
            </Title>
          </Space>
          <Button type="primary" icon={<EditOutlined />} disabled={true}>
            {t('agentDetail.editAgent')}
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
            <div style={{ color: '#1677ff', fontSize: '14px' }}>{t('agentDetail.loadingDetail')}</div>
          </div>

          {/* 页面框架 - 完全透明背景 */}
          <div style={{ opacity: 0.3 }}>
            <Card style={{ marginBottom: '20px', minHeight: '200px' }}>
              {/* 基本信息框架 */}
            </Card>

            <Tabs defaultActiveKey="variables">
              <TabPane
                tab={<span><DatabaseOutlined />{t('agentDetail.tab.variables')}</span>}
                key="variables"
              >
                <div style={{ minHeight: '200px' }} />
              </TabPane>
              <TabPane
                tab={<span><MessageOutlined />{t('agentDetail.tab.messages')}</span>}
                key="messages"
              >
                <div style={{ minHeight: '200px' }} />
              </TabPane>
              <TabPane
                tab={<span><HistoryOutlined />{t('agentDetail.tab.history')}</span>}
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
        <Title level={3}>{t('agentDetail.notFound')}</Title>
        <Button onClick={handleBack} icon={<RollbackOutlined />}>
          {t('agentDetail.backToList')}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<RollbackOutlined />} onClick={handleBack}>
            {t('agentDetail.back')}
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            <Space>
              <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1677ff' }} />
              {agent.name}
            </Space>
          </Title>
        </Space>
        <Button type="primary" icon={<EditOutlined />} onClick={handleEdit}>
          {t('agentDetail.editAgent')}
        </Button>
      </div>

      <Card style={{ marginBottom: '20px' }}>
        <Descriptions title={t('agentDetail.basicInfoTitle')} bordered column={2}>
          <Descriptions.Item label={t('agentDetail.field.id')}>{agent.id}</Descriptions.Item>
          <Descriptions.Item label={t('agentDetail.field.name')}>{agent.name}</Descriptions.Item>
          <Descriptions.Item label={t('agentDetail.field.role')}>{agent.role?.name || t('agentDetail.roleNotSet')}</Descriptions.Item>
          <Descriptions.Item label={t('agentDetail.field.status')}>
            <Tag color={
              agent.status === 'active' ? 'success' :
              agent.status === 'idle' ? 'default' :
              agent.status === 'busy' ? 'processing' :
              'error'
            }>
              {
                agent.status === 'active' ? t('agentDetail.status.active') :
                agent.status === 'idle' ? t('agentDetail.status.idle') :
                agent.status === 'busy' ? t('agentDetail.status.busy') :
                t('agentDetail.status.offline')
              }
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('agentDetail.field.description')} span={2}>
            {agent.description || t('agentDetail.noDescription')}
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        <Row gutter={16}>
          <Col span={8}>
            <Statistic title={t('agentDetail.stat.totalConversations')} value={agent.conversation_count || 0} />
          </Col>
          <Col span={8}>
            <Statistic title={t('agentDetail.stat.totalMessages')} value={agent.message_count || 0} />
          </Col>
          <Col span={8}>
            <Statistic title={t('agentDetail.stat.avgResponseTime')} value={agent.avg_response_time || 0} suffix="ms" />
          </Col>
        </Row>
      </Card>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={<span><DatabaseOutlined />{t('agentDetail.tab.variables')}</span>}
          key="variables"
        >
          <AgentVariables agentId={id} />
        </TabPane>
        <TabPane
          tab={<span><MessageOutlined />{t('agentDetail.tab.messages')}</span>}
          key="messages"
        >
          <Card>
            <Text>{t('agentDetail.noMessages')}</Text>
          </Card>
        </TabPane>
        <TabPane
          tab={<span><HistoryOutlined />{t('agentDetail.tab.history')}</span>}
          key="history"
        >
          <Card>
            <Text>{t('agentDetail.noHistory')}</Text>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default AgentDetail;