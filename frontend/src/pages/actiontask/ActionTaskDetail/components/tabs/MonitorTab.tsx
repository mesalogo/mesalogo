import React, { useState } from 'react';
import { Card, Avatar, Badge, Space, Tooltip, Table, Tag, Empty, Typography, Input, Button, Popconfirm, message, Modal, Select } from 'antd';
import {
  TeamOutlined,
  EyeOutlined,
  RobotOutlined,
  MessageOutlined,
  ApartmentOutlined,
  ToolOutlined,
  EnvironmentOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getAgentAvatarStyle } from '../../../../../utils/colorUtils';
import ActionTaskEnvironment from '../../../../actiontask/components/ActionTaskEnvironment';
import AutonomousTaskCard from '../../../../actiontask/components/AutonomousTaskCard';
import { actionTaskAPI } from '../../../../../services/api/actionTask';
import { roleAPI } from '../../../../../services/api/role';

const { Text } = Typography;

/**
 * MonitorTab - 任务监控标签页
 * 显示参与智能体、监督者智能体、环境变量和自主行动
 */
const MonitorTab = ({ task, messages, variablesRefreshKey, respondingAgentId, activeConversationId, refreshKey, t: tProp, onVariablesChange, onAgentAdded }) => {
  const { t: tHook } = useTranslation();
  const t = tProp || tHook;
  // 编辑状态管理
  const [editingVariable, setEditingVariable] = useState(null); // 正在编辑的变量 key
  const [editingValue, setEditingValue] = useState(''); // 编辑中的值
  const [hoveredVariable, setHoveredVariable] = useState(null); // 鼠标悬停的变量 key
  const [popconfirmOpen, setPopconfirmOpen] = useState<string | null>(null); // Popconfirm 打开状态
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null); // 延迟隐藏的定时器
  
  // 添加智能体相关状态
  const [addAgentModalVisible, setAddAgentModalVisible] = useState(false);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [addingAgent, setAddingAgent] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  
  if (!task) return null;

  // 处理变量编辑
  const handleEditVariable = async (agentId, variableName, originalValue) => {
    setEditingVariable(`${agentId}-${variableName}`);
    setEditingValue(String(originalValue));
  };

  // 保存变量编辑
  const handleSaveVariable = async (agentId, variableName) => {
    try {
      await actionTaskAPI.updateAgentVariable(agentId, variableName, editingValue);
      message.success(t('monitor.variableUpdateSuccess'));
      setEditingVariable(null);
      setEditingValue('');
      // 触发刷新（如果父组件提供了刷新函数）
      if (onVariablesChange) {
        onVariablesChange();
      }
    } catch (error) {
      message.error(t('monitor.variableUpdateFailed') + ': ' + error.message);
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingVariable(null);
    setEditingValue('');
  };

  // 删除变量
  const handleDeleteVariable = async (agentId, variableName) => {
    try {
      await actionTaskAPI.deleteAgentVariable(agentId, variableName);
      message.success(t('monitor.variableDeleteSuccess'));
      // 触发刷新
      if (onVariablesChange) {
        onVariablesChange();
      }
    } catch (error) {
      message.error(t('monitor.variableDeleteFailed') + ': ' + error.message);
    }
  };

  // 渲染智能体变量表格
  const renderAgentVariablesTable = (agent, variables, isObserver = false) => {
    if (!variables || variables.length === 0) return null;

    return (
      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: '12px', marginBottom: 4, display: 'block' }}>
          {isObserver ? t('monitor.observerVariables') : t('monitor.agentVariables')}
        </Text>
        <Table
          dataSource={variables.map((v, index) => ({
            ...v,
            key: v.id || `${v.name}-${agent.id}-${index}`
          }))}
          size="small"
          pagination={false}
          style={{ marginTop: 4 }}
          key={`${isObserver ? 'observer' : 'agent'}-vars-${agent.id}-${variablesRefreshKey}`}
          rowKey={(record: any) => record.key || record.id || `${record.name}-${agent.id}`}
          onRow={(record) => ({
            onMouseEnter: () => {
              if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
                hoverTimeoutRef.current = null;
              }
              setHoveredVariable(`${agent.id}-${record.name}`);
            },
            onMouseLeave: () => {
              // 延迟隐藏，给用户时间移动到 Popconfirm
              hoverTimeoutRef.current = setTimeout(() => {
                // 只有在没有打开 Popconfirm 时才隐藏
                if (!popconfirmOpen) {
                  setHoveredVariable(null);
                }
              }, 200);
            },
          })}
          columns={[
            {
              title: t('monitor.variableName'),
              dataIndex: 'name',
              key: 'name',
              ellipsis: true,
              width: '50%',
              render: (name, record) => (
                <div>
                  <div>{name}</div>
                  {record.label && record.label !== name && (
                    <Tag color="default" style={{ marginTop: 4, fontSize: '11px' }}>{record.label}</Tag>
                  )}
                </div>
              ),
            },
            {
              title: t('monitor.currentValue'),
              dataIndex: 'value',
              key: 'value',
              width: '50%',
              render: (value, record) => {
                const variableKey = `${agent.id}-${record.name}`;
                const isEditing = editingVariable === variableKey;
                const isHovered = hoveredVariable === variableKey;

                // 如果正在编辑此变量
                if (isEditing) {
                  return (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Input
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onPressEnter={() => handleSaveVariable(agent.id, record.name)}
                        autoFocus
                        style={{ flex: 1 }}
                      />
                      <Button
                        color="primary"
                        variant="solid"
                        icon={<CheckOutlined />}
                        onClick={() => handleSaveVariable(agent.id, record.name)}
                      />
                      <Button
                        color="default"
                        variant="outlined"
                        icon={<CloseOutlined />}
                        onClick={handleCancelEdit}
                      />
                    </div>
                  );
                }

                // 如果值为空，不显示任何内容
                if (value === undefined || value === null || value === '') {
                  return <div><span></span></div>;
                }

                const displayValue = value;
                const color = isObserver ? 'purple' : 'blue';

                // 检查变量是否有变化标记或是新变量
                const hasChanged = record._hasChanged === true;
                const isNew = record._isNew === true;

                return (
                  <div
                    className={hasChanged ? 'variable-flash' : ''}
                    style={{ position: 'relative', display: 'inline-block' }}
                  >
                    {/* 鼠标悬停时显示的编辑/删除按钮 - 绝对定位在值的上层左侧 */}
                    {(isHovered || popconfirmOpen === variableKey) && (
                      <Space
                        size="small"
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          zIndex: 10,
                          backgroundColor: 'rgba(255, 255, 255, 0.6)',
                          padding: '2px',
                          borderRadius: '4px'
                        }}
                      >
                        <Button
                          color="default"
                          variant="text"
                          icon={<EditOutlined />}
                          onClick={() => handleEditVariable(agent.id, record.name, value)}
                        />
                        <Popconfirm
                          title={t('monitor.confirmDeleteVariable')}
                          onConfirm={() => {
                            setPopconfirmOpen(null);
                            handleDeleteVariable(agent.id, record.name);
                          }}
                          onOpenChange={(open) => {
                            if (open) {
                              setPopconfirmOpen(variableKey);
                            } else {
                              setPopconfirmOpen(null);
                              setHoveredVariable(null);
                            }
                          }}
                          okText={t('delete')}
                          cancelText={t('cancel')}
                        >
                          <Button
                            color="danger"
                            variant="text"
                            icon={<DeleteOutlined />}
                          />
                        </Popconfirm>
                      </Space>
                    )}
                    
                    <Tooltip title={String(value)}>
                      <Tag color={color} style={{ cursor: 'pointer' }}>
                        {displayValue}
                        {isNew && <span style={{ marginLeft: 4, color: '#52c41a', fontWeight: 'bold' }}>({t('common.new')})</span>}
                      </Tag>
                    </Tooltip>
                  </div>
                );
              },
            }
          ]}
        />
      </div>
    );
  };

  // 渲染智能体列表项
  const renderAgentItem = (agent, isObserver = false) => {
    // 计算该智能体的历史消息数量
    const agentMessages = messages.filter(m => m.agent_id === agent.id).length;
    // 获取触发规则数量
    const ruleTriggersCount = agent.rule_triggers_count || 0;
    // 计算该智能体的工具调用数量
    const toolCallsCount = messages.reduce((count, message) => {
      if (message.agent_id === agent.id) {
        const content = message.content || '';
        const toolMatches = content.match(/tool_call_id|toolResult|tool_name/g);
        if (toolMatches) {
          const toolCallIdMatches = content.match(/tool_call_id/g);
          return count + (toolCallIdMatches ? toolCallIdMatches.length : 1);
        }
      }
      return count;
    }, 0);

    // 检查当前智能体是否正在响应
    const isResponding = String(agent.id) === String(respondingAgentId);

    // 获取该智能体的变量
    const agentVars = task.agent_variables ?
      task.agent_variables.filter(v => v.agent_id === agent.id) : [];

    return (
      <div 
        key={agent.id}
        style={{
          borderRadius: '8px',
          padding: '4px 6px',
          marginBottom: '8px',
          backgroundColor: isObserver ? 'var(--md-code-bg)' : undefined,
          borderBottom: '1px solid var(--custom-border)'
        }}
      >
        <div style={{ width: '100%', padding: '4px 2px' }}>
          <div style={{ display: 'flex', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Avatar
                icon={isObserver ? 
                  <EyeOutlined style={{ color: '#ffffff' }} /> : 
                  <RobotOutlined style={{ color: '#ffffff' }} />
                }
                style={{
                  ...getAgentAvatarStyle(agent.id || agent.name, isResponding, isObserver),
                  marginRight: '12px'
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>{agent.role_name ? `${agent.name} [${agent.role_name}]` : agent.name}</Text>
                <Space style={{ position: 'relative', zIndex: 10 }}>
                  <Tooltip title={t('monitor.messageCount')}>
                    <Badge count={agentMessages} style={{ backgroundColor: '#1677ff' }}>
                      <MessageOutlined style={{ fontSize: '16px', color: 'var(--custom-text-secondary)' }} />
                    </Badge>
                  </Tooltip>
                  <Tooltip title={t('actionTaskDetail.ruleTriggersCount')}>
                    <Badge count={ruleTriggersCount} style={{ backgroundColor: '#faad14' }}>
                      <ApartmentOutlined style={{ fontSize: '16px', color: 'var(--custom-text-secondary)' }} />
                    </Badge>
                  </Tooltip>
                  <Tooltip title={t('monitor.toolCallsCount')}>
                    <Badge count={toolCallsCount} style={{ backgroundColor: '#722ed1' }}>
                      <ToolOutlined style={{ fontSize: '16px', color: 'var(--custom-text-secondary)' }} />
                    </Badge>
                  </Tooltip>
                </Space>
              </div>
              <div style={{ marginTop: '4px' }}>
                <Text type="secondary">{agent.description || t('common.noDescription')}</Text>
              </div>
            </div>
          </div>

          {/* 智能体变量 */}
          {renderAgentVariablesTable(agent, agentVars, isObserver)}
        </div>
      </div>
    );
  };

  // 过滤参与智能体和监督者智能体
  const participatingAgents = task.agents ?
    task.agents.filter(agent => !agent.is_observer && agent.type !== 'observer') : [];
  const observerAgents = task.agents ?
    task.agents.filter(agent => agent.is_observer || agent.type === 'observer') : [];

  // 打开添加智能体弹窗
  const handleOpenAddAgentModal = async () => {
    setLoadingRoles(true);
    setAddAgentModalVisible(true);
    
    try {
      const allRoles = await roleAPI.getAll();
      
      // 获取当前任务中已有的角色ID列表
      const existingRoleIds = new Set(
        (task.agents || []).map(agent => agent.role_id).filter(Boolean)
      );
      
      // 过滤掉已存在的角色
      const availableRoles = allRoles.filter(role => !existingRoleIds.has(role.id));
      
      setAvailableRoles(availableRoles);
      
      if (availableRoles.length === 0) {
        message.info(t('monitor.noAvailableRoles'));
      }
    } catch (error) {
      message.error(t('monitor.loadRolesFailed'));
      console.error('加载角色失败:', error);
    } finally {
      setLoadingRoles(false);
    }
  };

  // 添加智能体
  const handleAddAgent = async () => {
    if (!selectedRoleId) {
      message.warning(t('monitor.selectRoleFirst'));
      return;
    }
    
    setAddingAgent(true);
    try {
      await actionTaskAPI.createAgentFromRole(task.id, { role_id: selectedRoleId });
      message.success(t('monitor.addAgentSuccess'));
      setAddAgentModalVisible(false);
      setSelectedRoleId(null);
      // 通知父组件刷新
      if (onAgentAdded) {
        onAgentAdded();
      }
    } catch (error) {
      message.error(t('monitor.addAgentFailed') + ': ' + error.message);
    } finally {
      setAddingAgent(false);
    }
  };

  return (
    <>
      {/* 参与智能体卡片 */}
      <Card
        className="task-detail-tab-card-compact"
        title={<><TeamOutlined /> {t('actionTaskDetail.participatingAgents')}</>}
        extra={
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleOpenAddAgentModal}
          >
            {t('monitor.addAgent')}
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        {participatingAgents.length > 0 ? (
          <div>
            {participatingAgents.map(agent => renderAgentItem(agent, false))}
          </div>
        ) : (
          <Empty description={t('monitor.noAgentData')} />
        )}
      </Card>

      {/* 监督者智能体卡片 */}
      <Card
        className="task-detail-tab-card-compact"
        title={<><EyeOutlined /> {t('actionTaskDetail.supervisorAgents')}</>}
        style={{ marginBottom: 16 }}
      >
        {observerAgents.length > 0 ? (
          <div>
            {observerAgents.map(agent => renderAgentItem(agent, true))}
          </div>
        ) : (
          <Empty description={t('monitor.noSupervisorData')} />
        )}
      </Card>

      {/* 环境变量卡片 */}
      <Card
        className="task-detail-tab-card"
        title={<><EnvironmentOutlined /> {t('actionTaskDetail.environment')}</>}
        style={{ marginBottom: 16 }}
      >
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {t('actionTaskDetail.environmentDesc')}
          </Text>
        </div>
        {task && <ActionTaskEnvironment task={task} key={`env-vars-${variablesRefreshKey}`} onVariablesChange={onVariablesChange} />}
      </Card>

      {/* 自主行动卡片 */}
      {activeConversationId && (
        <AutonomousTaskCard
          task={task}
          activeConversationId={activeConversationId}
          refreshKey={refreshKey}
        />
      )}

      {/* 添加智能体弹窗 */}
      <Modal
        title={t('monitor.addAgentTitle')}
        open={addAgentModalVisible}
        onCancel={() => {
          setAddAgentModalVisible(false);
          setSelectedRoleId(null);
        }}
        onOk={handleAddAgent}
        confirmLoading={addingAgent}
        okText={t('confirm')}
        cancelText={t('cancel')}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">{t('monitor.addAgentDesc')}</Text>
        </div>
        <Select
          style={{ width: '100%' }}
          placeholder={t('monitor.selectRole')}
          loading={loadingRoles}
          value={selectedRoleId}
          onChange={setSelectedRoleId}
        >
          {availableRoles.map(role => (
            <Select.Option key={role.id} value={role.id}>
              {role.name} {role.description ? `- ${role.description}` : ''}
            </Select.Option>
          ))}
        </Select>
      </Modal>
    </>
  );
};

export default MonitorTab;
