import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Empty, Tooltip, Tabs, Space, Typography, Divider, Input, Popconfirm, message } from 'antd';
import { LineChartOutlined, GlobalOutlined, RobotOutlined, ShareAltOutlined, LockOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { actionTaskAPI } from '../../../services/api/actionTask';

const { TabPane } = Tabs;
const { Text } = Typography;

const ActionTaskEnvironment = ({ task, showGlobalOnly = false, onVariablesChange = null }) => {
  const { t } = useTranslation();
  // 环境变量状态
  const [environmentVariables, setEnvironmentVariables] = useState([]);
  const [globalVariables, setGlobalVariables] = useState([]);
  
  // 编辑状态管理
  const [editingVariable, setEditingVariable] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [hoveredVariable, setHoveredVariable] = useState(null);
  const [popconfirmOpen, setPopconfirmOpen] = useState<string | null>(null);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // 初始化时设置环境变量
  useEffect(() => {
    console.log('ActionTaskEnvironment组件接收到任务数据:', task);
    if (task && task.environment_variables) {
      // 所有环境变量
      const allVars = task.environment_variables;

      // 严格过滤环境变量，确保有正确的格式且来源为task
      const validVars = allVars.filter(variable =>
        // 必须有name、label和value属性才是有效的环境变量
        variable &&
        variable.name &&
        (variable.label !== undefined) &&
        (variable.value !== undefined) &&
        // 排除明显不是环境变量的数据
        typeof variable !== 'string' &&
        // 确保只是任务全局变量，不包含智能体变量
        (variable.source === 'task' || variable.source === 'shared' || !variable.agent_id)
      );

      // 确保每个变量都有唯一的key属性，用于React列表渲染
      const varsWithKeys = validVars.map((variable, index) => ({
        ...variable,
        key: variable.id || `${variable.name}-${index}`,
        // 保留_hasChanged和_isNew标记，用于闪烁效果
        _hasChanged: variable._hasChanged === true,
        _isNew: variable._isNew === true
      }));

      // 打印变化的变量和新变量，便于调试
      const changedVars = varsWithKeys.filter(v => v._hasChanged && !v._isNew);
      if (changedVars.length > 0) {
        console.log('ActionTaskEnvironment组件检测到变化的环境变量:', changedVars.map(v => v.name));
      }

      const newVars = varsWithKeys.filter(v => v._isNew);
      if (newVars.length > 0) {
        console.log('ActionTaskEnvironment组件检测到新的环境变量:', newVars.map(v => v.name));
      }

      setEnvironmentVariables(varsWithKeys);
      setGlobalVariables(varsWithKeys);
    }
  }, [task]);

  // 处理变量编辑
  const handleEditVariable = (variableName, originalValue) => {
    setEditingVariable(variableName);
    setEditingValue(String(originalValue));
  };

  // 保存变量编辑
  const handleSaveVariable = async (variableName) => {
    try {
      await actionTaskAPI.updateEnvironmentVariable(task.id, variableName, editingValue);
      message.success('环境变量更新成功');
      setEditingVariable(null);
      setEditingValue('');
      if (onVariablesChange) {
        onVariablesChange();
      }
    } catch (error) {
      message.error('环境变量更新失败: ' + error.message);
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingVariable(null);
    setEditingValue('');
  };

  // 删除变量
  const handleDeleteVariable = async (variableName) => {
    try {
      await actionTaskAPI.deleteEnvironmentVariable(task.id, variableName);
      message.success('环境变量删除成功');
      setPopconfirmOpen(null);
      if (onVariablesChange) {
        onVariablesChange();
      }
    } catch (error) {
      message.error('环境变量删除失败: ' + error.message);
    }
  };

  // 环境变量表格列定义 - 精简版
  const columns = [
    {
      title: t('environment.card.variableName'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      width: '40%',
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
      title: t('environment.card.source'),
      dataIndex: 'source',
      key: 'source',
      width: '20%',
      render: (source, record) => {
        if (source === 'shared') {
          return (
            <Space>
              <Tag icon={<ShareAltOutlined />} color="blue">{t('environment.card.sourceShared')}</Tag>
              {record.is_readonly && <Tag icon={<LockOutlined />} color="red">{t('environment.card.readonly')}</Tag>}
            </Space>
          );
        }
        return <Tag color="default">{t('environment.card.sourceTask')}</Tag>;
      }
    },
    {
      title: t('environment.card.currentValue'),
      dataIndex: 'value',
      key: 'value',
      width: '40%',
      render: (value, record) => {
        const variableKey = record.name;
        const isEditing = editingVariable === variableKey;
        const isHovered = hoveredVariable === variableKey;

        // 如果正在编辑此变量
        if (isEditing) {
          return (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Input
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onPressEnter={() => handleSaveVariable(record.name)}
                autoFocus
                style={{ flex: 1 }}
              />
              <Button
                color="primary"
                variant="solid"
                icon={<CheckOutlined />}
                onClick={() => handleSaveVariable(record.name)}
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
          return (
            <div>
              <span></span>
            </div>
          );
        }

        let displayValue = value;
        let color = 'blue';

        // 直接显示文本值
        displayValue = String(value);

        // 检查变量是否有变化标记或是新变量，如果是则添加闪烁效果的类名
        const hasChanged = record._hasChanged === true;
        const isNew = record._isNew === true;

        return (
          <div
            className={hasChanged ? 'variable-flash' : ''}
            style={{ position: 'relative', display: 'inline-block' }}
          >
            {/* 鼠标悬停时显示的编辑/删除按钮 */}
            {(isHovered || popconfirmOpen === variableKey) && !record.is_readonly && (
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
                  onClick={() => handleEditVariable(record.name, value)}
                />
                <Popconfirm
                  title="确认删除此环境变量？"
                  onConfirm={() => handleDeleteVariable(record.name)}
                  onOpenChange={(open) => {
                    if (open) {
                      setPopconfirmOpen(variableKey);
                    } else {
                      setPopconfirmOpen(null);
                      setHoveredVariable(null);
                    }
                  }}
                  okText="删除"
                  cancelText="取消"
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
                {isNew && <span style={{ marginLeft: 4, color: '#52c41a', fontWeight: 'bold' }}>{t('environment.card.newVariable')}</span>}
              </Tag>
            </Tooltip>
          </div>
        );
      },
    }
  ];

  // 渲染任务环境变量
  const renderTaskVariables = () => {
    if (globalVariables.length === 0) {
      return <Empty description={t('environment.card.noVariables')} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    // 注意: React要求列表渲染时每项必须有唯一的key属性
    // 这里通过rowKey函数确保即使某些记录缺少key属性时也能生成唯一标识
    // 优先使用: 1.记录中已有的key属性 2.记录ID 3.由name和label组合生成的唯一字符串
    return (
      <Table
        dataSource={globalVariables}
        columns={columns}
        size="small"
        rowKey={(record: any) => record.key || record.id || `${record.name}-${record.label}`}
        pagination={false}
        onRow={(record) => ({
          onMouseEnter: () => {
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current);
              hoverTimeoutRef.current = null;
            }
            setHoveredVariable(record.name);
          },
          onMouseLeave: () => {
            hoverTimeoutRef.current = setTimeout(() => {
              if (!popconfirmOpen) {
                setHoveredVariable(null);
              }
            }, 200);
          },
        })}
      />
    );
  };

  // 该组件现在只显示任务环境变量
  return (
    <div>
      {renderTaskVariables()}
    </div>
  );
};

export default ActionTaskEnvironment;