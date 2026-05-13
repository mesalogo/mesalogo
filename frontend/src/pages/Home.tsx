// 首页组件 - 展示系统概览信息的主页仪表盘
import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Typography, Space, Button, Spin, message
} from 'antd';
import {
  TeamOutlined, MessageOutlined, UserOutlined, DatabaseOutlined, RiseOutlined, SettingOutlined, RobotOutlined
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactECharts from 'echarts-for-react';
import statisticsAPI from '../services/api/statistics';
import OneClickModal from '../components/OneClickGeneration/OneClickModal';
import MetricGauge from '../components/MetricGauge';

const { Paragraph } = Typography;

const Home = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [oneClickModalVisible, setOneClickModalVisible] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    overview: {
      total_tasks: 0,
      active_tasks: 0,
      total_roles: 0,
      total_action_spaces: 0
    },
    activity_trends: {
      today_new_tasks: 0,
      week_completed_tasks: 0,
      avg_task_duration_hours: 0,
      daily_trends: []
    },
    interactions: {
      total_messages: 0,
      today_messages: 0,
      avg_messages_per_task: 0,
      tool_calls_count: 0,
      active_conversations: 0,
      agent_messages: 0,
      human_messages: 0
    },
    ecosystem: {
      agent_status_distribution: {},
      top_roles: [],
      role_usage_rate: 0,
      avg_agents_per_task: 0
    },
    resources: {
      total_knowledge: 0,
      total_rule_sets: 0,
      total_capabilities: 0,
      spaces_with_roles: 0,
      spaces_with_rules: 0
    },
    users: {
      total_users: 0,
      active_users: 0,
      today_active_users: 0,
      avg_tasks_per_user: 0,
      top_users: []
    },
    autonomous_tasks: {
      total_autonomous_tasks: 0,
      active_autonomous_tasks: 0,
      today_autonomous_tasks: 0,
      week_autonomous_tasks: 0,
      autonomous_status_distribution: {},
      autonomous_type_distribution: {},
      total_executions: 0,
      today_executions: 0,
      execution_status_distribution: {},
      success_rate: 0,
      avg_execution_duration: 0
    }
  });

  // 获取统计数据
  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const response = await statisticsAPI.getDashboardData();

      if (response.success) {
        setDashboardData(response.data);
      } else {
        message.error(t('message.operationFailed'));
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
      message.error(t('message.operationFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时获取数据
  useEffect(() => {
    fetchStatistics();
  }, []);

  // 核心指标柱状图配置
  const getCoreMetricsChartOption = () => {
    return {
      title: {
        text: t('chart.coreMetricsOverview'),
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: [t('data.actionTasks'), t('data.roleCount'), t('data.actionSpaces'), t('data.activeTasks')],
        axisLabel: {
          interval: 0,
          rotate: 0
        }
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: t('data.quantity'),
          type: 'bar',
          data: [
            {
              value: dashboardData.overview.total_tasks,
              itemStyle: { color: '#1677ff' }
            },
            {
              value: dashboardData.overview.total_roles,
              itemStyle: { color: '#52c41a' }
            },
            {
              value: dashboardData.overview.total_action_spaces,
              itemStyle: { color: '#fa8c16' }
            },
            {
              value: dashboardData.overview.active_tasks,
              itemStyle: { color: '#eb2f96' }
            }
          ],
          label: {
            show: true,
            position: 'top'
          }
        }
      ]
    };
  };

  // 智能体状态分布饼状图配置
  const getAgentStatusPieOption = () => {
    const statusData = Object.entries(dashboardData.ecosystem.agent_status_distribution || {}).map(([status, count]) => ({
      name: status === 'active' ? t('status.active') : status === 'inactive' ? t('status.inactive') : status === 'running' ? t('status.running') : status,
      value: count
    }));

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'center'
      },
      series: [
        {
          name: t('chart.agentStatusDistribution'),
          type: 'pie',
          radius: '50%',
          center: ['65%', '50%'],
          data: statusData,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };
  };

  // 活动趋势线图配置
  const getActivityTrendOption = () => {
    const trendData = dashboardData.activity_trends.daily_trends || [];
    const dates = trendData.map(item => item.date || '');
    const taskCounts = trendData.map(item => item.task_count || 0);
    const messageCounts = trendData.map(item => item.message_count || 0);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: function(params) {
          let result = params[0].name + '<br/>';
          params.forEach(param => {
            result += param.marker + param.seriesName + ': ' + param.value + '<br/>';
          });
          return result;
        }
      },
      legend: {
        data: [t('chart.taskCount'), t('chart.messageCount')],
        top: 10
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLabel: {
          fontSize: 12
        }
      },
      yAxis: {
        type: 'value',
        minInterval: 1
      },
      series: [
        {
          name: t('chart.taskCount'),
          type: 'line',
          data: taskCounts,
          smooth: true,
          lineStyle: {
            color: '#1677ff',
            width: 2
          },
          areaStyle: {
            color: 'rgba(22, 119, 255, 0.1)'
          },
          symbol: 'circle',
          symbolSize: 6
        },
        {
          name: t('chart.messageCount'),
          type: 'line',
          data: messageCounts,
          smooth: true,
          lineStyle: {
            color: '#52c41a',
            width: 2
          },
          areaStyle: {
            color: 'rgba(82, 196, 26, 0.1)'
          },
          symbol: 'circle',
          symbolSize: 6
        }
      ]
    };
  };

  // 系统资源环形图配置
  const getResourcesDonutOption = () => {
    const resourceData = [
      { name: t('data.knowledgeBase'), value: dashboardData.resources.total_knowledge },
      { name: t('data.ruleSets'), value: dashboardData.resources.total_rule_sets },
      { name: t('data.capabilities'), value: dashboardData.resources.total_capabilities }
    ];

    return {
      title: {
        text: t('chart.systemResourceDistribution'),
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left'
      },
      series: [
        {
          name: t('data.systemResource'),
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: '30',
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: false
          },
          data: resourceData
        }
      ]
    };
  };

  // 自主行动任务状态分布饼状图配置
  const getAutonomousTaskStatusPieOption = () => {
    const statusData = Object.entries(dashboardData.autonomous_tasks.autonomous_status_distribution || {}).map(([status, count]) => ({
      name: status === 'active' ? t('status.active') : status === 'completed' ? t('status.completed') : status === 'stopped' ? t('status.stopped') : status,
      value: count
    }));

    return {
      title: {
        text: t('chart.taskStatusDistribution'),
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left'
      },
      series: [
        {
          name: t('chart.autonomousTaskStatus'),
          type: 'pie',
          radius: '50%',
          data: statusData,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };
  };

  // 自主行动任务类型分布柱状图配置
  const getAutonomousTaskTypeBarOption = () => {
    const typeData = Object.entries(dashboardData.autonomous_tasks.autonomous_type_distribution || {}).map(([type, count]) => ({
      name: type === 'discussion' ? t('status.discussion') : type === 'conditional_stop' ? t('status.conditionalStop') : type === 'variable_trigger' ? t('status.variableTrigger') : type === 'time_trigger' ? t('status.timeTrigger') : type,
      value: count
    }));

    return {
      title: {
        text: t('chart.autonomousTaskType'),
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: typeData.map(item => item.name),
        axisLabel: {
          interval: 0,
          rotate: 45
        }
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: t('chart.taskCount'),
          type: 'bar',
          data: typeData.map(item => ({
            value: item.value,
            itemStyle: {
              color: function(params) {
                const colors = ['#1677ff', '#52c41a', '#fa8c16', '#eb2f96'];
                return colors[params.dataIndex % colors.length];
              }
            }
          })),
          label: {
            show: true,
            position: 'top'
          }
        }
      ]
    };
  };

  // 自主行动执行统计仪表盘配置
  const getAutonomousExecutionGaugeOption = () => {
    return {
      title: {
        text: t('chart.taskExecutionSuccessRate'),
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        formatter: '{a} <br/>{b} : {c}%'
      },
      series: [
        {
          name: t('data.successRate'),
          type: 'gauge',
          progress: {
            show: true
          },
          detail: {
            valueAnimation: true,
            formatter: '{value}%',
            offsetCenter: [0, '70%']
          },
          data: [
            {
              value: dashboardData.autonomous_tasks.success_rate,
              name: t('data.executionSuccessRate'),
              title: {
                offsetCenter: [0, '100%']
              }
            }
          ]
        }
      ]
    };
  };

  return (
    <div className="home-dashboard">
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20
        }}>
          <div>
            <Typography.Title level={4} style={{ margin: 0, marginBottom: '8px' }}>{t('home.title')}</Typography.Title>
            <Paragraph type="secondary">{t('home.subtitle')}</Paragraph>
          </div>
        </div>
      </div>

      <Spin spinning={loading}>
        {/* 快速操作 */}
        <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
          <Col span={24}>
            <Card title={<><SettingOutlined /> {t('home.quickActions')}</>}>
              <Space wrap>
                <Button
                  type="primary"
                  icon={<RobotOutlined />}
                  onClick={() => setOneClickModalVisible(true)}
                >
                  {t('home.oneClickCreate')}
                </Button>
                <Button type="primary">
                  <Link to="/action-tasks/overview">{t('home.createActionTask')}</Link>
                </Button>
                <Button>
                  <Link to="/roles/management">{t('home.manageRoles')}</Link>
                </Button>
                <Button>
                  <Link to="/action-spaces/overview">{t('home.configureSpaces')}</Link>
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* 第一层：系统核心指标概览 */}
        <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
          <Col span={24}>
            <Card title={`📊 ${t('home.coreMetrics')}`}>
              <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 16, padding: '20px 0' }}>
                <div style={{ textAlign: 'center' }}>
                  <MetricGauge 
                    value={dashboardData.overview.total_tasks} 
                    title={t('data.actionTasks')}
                    color="#1677ff"
                    max={Math.max(100, dashboardData.overview.total_tasks * 1.2)}
                  />
                  <Button type="link">
                    <Link to="/action-tasks/overview">{t('home.viewTasks')}</Link>
                  </Button>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <MetricGauge 
                    value={dashboardData.overview.total_roles} 
                    title={t('data.roleCount')}
                    color="#52c41a"
                    max={Math.max(100, dashboardData.overview.total_roles * 1.2)}
                  />
                  <Button type="link">
                    <Link to="/roles/management">{t('home.manageRoles')}</Link>
                  </Button>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <MetricGauge 
                    value={dashboardData.overview.total_action_spaces} 
                    title={t('data.actionSpaces')}
                    color="#fa8c16"
                    max={Math.max(50, dashboardData.overview.total_action_spaces * 1.2)}
                  />
                  <Button type="link">
                    <Link to="/action-spaces/overview">{t('home.viewSpaces')}</Link>
                  </Button>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <MetricGauge 
                    value={dashboardData.overview.active_tasks} 
                    title={t('data.activeTasks')}
                    color="#eb2f96"
                    max={Math.max(50, dashboardData.overview.active_tasks * 1.2)}
                  />
                  <Button type="link">
                    <Link to="/action-tasks/monitoring">{t('home.monitorTasks')}</Link>
                  </Button>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* 第二层：活动趋势分析 */}
        <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
          <Col span={24}>
            <Card title={`📈 ${t('home.activityTrends')}`}>
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Card title={t('home.recentTrends')}>
                    {dashboardData.activity_trends.daily_trends && dashboardData.activity_trends.daily_trends.length > 0 ? (
                      <ReactECharts
                        option={getActivityTrendOption()}
                        style={{ height: '250px' }}
                        opts={{ renderer: 'canvas' }}
                      />
                    ) : (
                      <div style={{
                        height: '250px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--custom-text-secondary)',
                        fontSize: '12px'
                      }}>
                        {t('noData.activityTrends')}
                      </div>
                    )}
                  </Card>
                </Col>
                <Col span={8}>
                  <Card title={t('chart.agentStatus')}>
                    {Object.keys(dashboardData.ecosystem.agent_status_distribution || {}).length > 0 ? (
                      <ReactECharts
                        option={getAgentStatusPieOption()}
                        style={{ height: '250px' }}
                        opts={{ renderer: 'canvas' }}
                      />
                    ) : (
                      <div style={{
                        height: '250px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--custom-text-secondary)',
                        fontSize: '12px'
                      }}>
                        {t('noData.agentStatus')}
                      </div>
                    )}
                  </Card>
                </Col>
                <Col span={8}>
                  <Card title={t('chart.activityMetrics')}>
                    <ReactECharts
                      option={{
                        tooltip: {
                          trigger: 'axis',
                          axisPointer: {
                            type: 'shadow'
                          }
                        },
                        grid: {
                          left: '5%',
                          right: '5%',
                          bottom: '5%',
                          top: '5%',
                          containLabel: true
                        },
                        xAxis: {
                          type: 'category',
                          data: [t('data.todayTasks'), t('data.weekCompleted'), t('data.activeSessions')],
                          axisLabel: {
                            fontSize: 10,
                            interval: 0
                          }
                        },
                        yAxis: {
                          type: 'value',
                          axisLabel: {
                            fontSize: 10
                          }
                        },
                        series: [
                          {
                            type: 'bar',
                            data: [
                              {
                                value: dashboardData.activity_trends.today_new_tasks,
                                itemStyle: { color: '#ff4d4f' }
                              },
                              {
                                value: dashboardData.activity_trends.week_completed_tasks,
                                itemStyle: { color: '#52c41a' }
                              },
                              {
                                value: dashboardData.interactions.active_conversations,
                                itemStyle: { color: '#eb2f96' }
                              }
                            ],
                            label: {
                              show: true,
                              position: 'top',
                              fontSize: 10
                            }
                          }
                        ]
                      }}
                      style={{ height: '250px' }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        {/* 第三层：交互与消息统计 */}
        <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
          <Col span={12}>
            <Card title={`💬 ${t('chart.messageInteraction')}`}>
              <ReactECharts
                option={{
                  title: {
                    text: t('chart.messageTypeDistribution'),
                    left: 'center',
                    textStyle: {
                      fontSize: 14,
                      fontWeight: 'bold'
                    }
                  },
                  tooltip: {
                    trigger: 'item',
                    formatter: '{a} <br/>{b}: {c} ({d}%)'
                  },
                  legend: {
                    orient: 'vertical',
                    left: 'left',
                    top: 'middle'
                  },
                  series: [
                    {
                      name: t('chart.messageType'),
                      type: 'pie',
                      radius: '60%',
                      center: ['60%', '50%'],
                      data: [
                        { name: t('data.agentMessages'), value: dashboardData.interactions.agent_messages },
                        { name: t('data.userMessages'), value: dashboardData.interactions.human_messages },
                        { name: t('data.toolCalls'), value: dashboardData.interactions.tool_calls_count }
                      ],
                      emphasis: {
                        itemStyle: {
                          shadowBlur: 10,
                          shadowOffsetX: 0,
                          shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                      }
                    }
                  ]
                }}
                style={{ height: '300px' }}
                opts={{ renderer: 'canvas' }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card title={`👥 ${t('home.userActivityRadar')}`}>
              {dashboardData.users ? (
                <ReactECharts
                  option={{
                    tooltip: {
                      trigger: 'item'
                    },
                    radar: {
                      indicator: [
                        { name: t('data.totalUsers'), max: Math.max(dashboardData.users.total_users * 1.2, 100) },
                        { name: t('data.activeUsers'), max: Math.max(dashboardData.users.active_users * 1.2, 50) },
                        { name: t('data.todayActiveUsers'), max: Math.max(dashboardData.users.today_active_users * 1.2, 20) },
                        { name: t('data.avgTasksPerUser'), max: Math.max(dashboardData.users.avg_tasks_per_user * 1.2, 10) },
                        { name: t('data.userActivity'), max: 100 }
                      ]
                    },
                    series: [
                      {
                        name: t('data.userActivityMetrics'),
                        type: 'radar',
                        data: [
                          {
                            value: [
                              dashboardData.users.total_users,
                              dashboardData.users.active_users,
                              dashboardData.users.today_active_users,
                              dashboardData.users.avg_tasks_per_user,
                              dashboardData.users.total_users > 0 ?
                                Math.round((dashboardData.users.active_users / dashboardData.users.total_users) * 100) : 0
                            ],
                            name: t('data.currentMetrics'),
                            itemStyle: {
                              color: '#1677ff'
                            },
                            areaStyle: {
                              color: 'rgba(22, 119, 255, 0.1)'
                            }
                          }
                        ]
                      }
                    ]
                  }}
                  style={{ height: '300px' }}
                  opts={{ renderer: 'canvas' }}
                />
              ) : (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {t('common.noData')}
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* 第四层：资源与生态统计 */}
        <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
          <Col span={12}>
            <Card title={`🎭 ${t('home.roleEcosystem')}`}>
              {dashboardData.ecosystem.top_roles && dashboardData.ecosystem.top_roles.length > 0 ? (
                <ReactECharts
                  option={{
                    title: {
                      text: t('home.topRoles'),
                      left: 'center',
                      textStyle: {
                        fontSize: 14,
                        fontWeight: 'bold'
                      }
                    },
                    tooltip: {
                      trigger: 'axis',
                      axisPointer: {
                        type: 'shadow'
                      }
                    },
                    grid: {
                      left: '3%',
                      right: '4%',
                      bottom: '3%',
                      top: '15%',
                      containLabel: true
                    },
                    xAxis: {
                      type: 'value'
                    },
                    yAxis: {
                      type: 'category',
                      data: (dashboardData.ecosystem.top_roles || []).map(item => item.name).reverse()
                    },
                    series: [
                      {
                        name: t('data.usageCount'),
                        type: 'bar',
                        data: (dashboardData.ecosystem.top_roles || []).map(item => item.usage_count).reverse(),
                        itemStyle: {
                          color: function(params) {
                            const colors = ['#ff4d4f', '#fa8c16', '#fadb14', '#52c41a', '#1677ff'];
                            return colors[params.dataIndex % colors.length];
                          }
                        },
                        label: {
                          show: true,
                          position: 'right'
                        }
                      }
                    ]
                  }}
                  style={{ height: '300px' }}
                  opts={{ renderer: 'canvas' }}
                />
              ) : (
                <div style={{
                  height: '300px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--custom-text-secondary)',
                  fontSize: '14px'
                }}>
                  {t('noData.roleUsage')}
                </div>
              )}
            </Card>
          </Col>
          <Col span={12}>
            <Card title={`🗄️ ${t('home.systemResources')}`}>
              {(dashboardData.resources.total_knowledge + dashboardData.resources.total_rule_sets + dashboardData.resources.total_capabilities) > 0 ? (
                <ReactECharts
                  option={getResourcesDonutOption()}
                  style={{ height: '300px' }}
                  opts={{ renderer: 'canvas' }}
                />
              ) : (
                <div style={{
                  height: '300px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--custom-text-secondary)',
                  fontSize: '14px'
                }}>
                  {t('noData.systemResources')}
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* 第五层：自主行动统计 */}
        <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
          <Col span={24}>
            <Card title={`🤖 ${t('home.autonomousStats')}`}>
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Card title={t('chart.taskStatusDistribution')}>
                    {Object.keys(dashboardData.autonomous_tasks.autonomous_status_distribution || {}).length > 0 ? (
                      <ReactECharts
                        option={getAutonomousTaskStatusPieOption()}
                        style={{ height: '250px' }}
                        opts={{ renderer: 'canvas' }}
                      />
                    ) : (
                      <div style={{
                        height: '250px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--custom-text-secondary)',
                        fontSize: '12px'
                      }}>
                        {t('noData.autonomousTaskStatus')}
                      </div>
                    )}
                  </Card>
                </Col>
                <Col span={8}>
                  <Card title={t('chart.taskTypeDistribution')}>
                    {Object.keys(dashboardData.autonomous_tasks.autonomous_type_distribution || {}).length > 0 ? (
                      <ReactECharts
                        option={getAutonomousTaskTypeBarOption()}
                        style={{ height: '250px' }}
                        opts={{ renderer: 'canvas' }}
                      />
                    ) : (
                      <div style={{
                        height: '250px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--custom-text-secondary)',
                        fontSize: '12px'
                      }}>
                        {t('noData.autonomousTaskType')}
                      </div>
                    )}
                  </Card>
                </Col>
                <Col span={8}>
                  <Card title={t('chart.executionSuccessRate')}>
                    {dashboardData.autonomous_tasks.total_executions > 0 ? (
                      <ReactECharts
                        option={getAutonomousExecutionGaugeOption()}
                        style={{ height: '250px' }}
                        opts={{ renderer: 'canvas' }}
                      />
                    ) : (
                      <div style={{
                        height: '250px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--custom-text-secondary)',
                        fontSize: '12px'
                      }}>
                        {t('noData.executionData')}
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        {/* 自主行动详细统计 */}
        <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
          <Col span={24}>
            <Card title={t('home.autonomousDetails')}>
              <Row gutter={24}>
                <Col span={4}>
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1677ff' }}>
                      {dashboardData.autonomous_tasks.total_autonomous_tasks}
                    </div>
                    <div style={{ color: 'var(--custom-text-secondary)', marginTop: '8px' }}>{t('data.totalAutonomousTasks')}</div>
                  </div>
                </Col>
                <Col span={4}>
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                      {dashboardData.autonomous_tasks.active_autonomous_tasks}
                    </div>
                    <div style={{ color: 'var(--custom-text-secondary)', marginTop: '8px' }}>{t('data.activeAutonomousTasks')}</div>
                  </div>
                </Col>
                <Col span={4}>
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fa8c16' }}>
                      {dashboardData.autonomous_tasks.today_autonomous_tasks}
                    </div>
                    <div style={{ color: 'var(--custom-text-secondary)', marginTop: '8px' }}>{t('data.todayNew')}</div>
                  </div>
                </Col>
                <Col span={4}>
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#eb2f96' }}>
                      {dashboardData.autonomous_tasks.total_executions}
                    </div>
                    <div style={{ color: 'var(--custom-text-secondary)', marginTop: '8px' }}>{t('data.totalExecutions')}</div>
                  </div>
                </Col>
                <Col span={4}>
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#722ed1' }}>
                      {dashboardData.autonomous_tasks.today_executions}
                    </div>
                    <div style={{ color: 'var(--custom-text-secondary)', marginTop: '8px' }}>{t('data.todayExecutions')}</div>
                  </div>
                </Col>
                <Col span={4}>
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#13c2c2' }}>
                      {dashboardData.autonomous_tasks.avg_execution_duration}{t('data.minutes')}
                    </div>
                    <div style={{ color: 'var(--custom-text-secondary)', marginTop: '8px' }}>{t('data.avgExecutionDuration')}</div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </Spin>

      {/* 一键创建模态框 */}
      <OneClickModal
        visible={oneClickModalVisible}
        onCancel={() => setOneClickModalVisible(false)}
        onSuccess={(data) => {
          setOneClickModalVisible(false);
          message.success(t('home.oneClickCreateSuccess'));
          if (data?.action_task?.id) {
            navigate(`/action-tasks/detail/${data.action_task.id}`);
          }
        }}
      />
    </div>
  );
};

export default Home;