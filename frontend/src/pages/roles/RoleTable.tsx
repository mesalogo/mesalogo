import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Button,
  Space,
  Modal,
  Input,
  Select,
  Tooltip,
  Tag,
  Skeleton,
  Segmented,
  Pagination
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  ReloadOutlined,
  RobotOutlined,
  GlobalOutlined,
  TeamOutlined,
  LockOutlined,
  TableOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import RoleCardView from './RoleCardView';

const { Text } = Typography;
const { Option } = Select;
const { confirm } = Modal;

const RoleTable = ({
  roles,
  models,
  loading,
  actionSpaces,
  onEdit,
  onDelete,
  onRefresh
}) => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [filteredRoles, setFilteredRoles] = useState([]);
  const [actionSpaceFilter, setActionSpaceFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>(() => {
    const saved = localStorage.getItem('roleViewMode');
    return (saved === 'card' || saved === 'table') ? saved : 'card';
  });
  const [rolePagination, setRolePagination] = useState({
    current: 1,
    pageSize: 10,
  });
  const [cardPagination, setCardPagination] = useState({
    current: 1,
    pageSize: 12,
  });

  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredRoles(roles);
    } else {
      const filtered = roles.filter(role =>
        role.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        role.description?.toLowerCase().includes(searchText.toLowerCase()) ||
        role.system_prompt?.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredRoles(filtered);
    }
  }, [roles, searchText]);

  const handleSearch = (value) => {
    setSearchText(value);
  };

  const handleDelete = (role) => {
    confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除角色 "${role.name}" 吗？`,
      onOk: () => onDelete(role.id),
    });
  };

  const handleRefresh = () => {
    onRefresh(actionSpaceFilter);
  };

  const handleActionSpaceFilterChange = (value) => {
    setActionSpaceFilter(value);
    onRefresh(value);
  };

  const handleViewModeChange = (value: 'table' | 'card') => {
    setViewMode(value);
    localStorage.setItem('roleViewMode', value);
  };

  const getModelBadge = (model) => {
    const modelColors = {
      'gpt-4': 'cyan',
      'gpt-3.5-turbo': 'blue',
      'claude-3-opus': 'purple',
      'claude-3-sonnet': 'geekblue',
      'gemini-pro': 'green',
      'llama-3': 'orange',
    };
    return modelColors[model] || 'default';
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      fixed: 'left' as const,
      render: (text) => (
        <Space>
          <UserOutlined style={{ color: '#1677ff' }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (type) => {
        const typeColors = { 'internal': 'blue', 'external': 'green' };
        const typeLabels = { 'internal': '内部', 'external': '外部' };
        return <Tag color={typeColors[type] || 'blue'}>{typeLabels[type] || type || '内部'}</Tag>;
      },
    },
    {
      title: '来源',
      dataIndex: 'created_by',
      key: 'resource_source',
      width: 120,
      render: (created_by, record) => {
        if (!created_by) {
          return (
            <Tooltip title="系统资源，所有用户可见可用">
              <Tag icon={<GlobalOutlined />} color="blue">系统</Tag>
            </Tooltip>
          );
        }
        if (record.is_shared) {
          return (
            <Tooltip title="用户共享资源，所有用户可见可用">
              <Tag icon={<TeamOutlined />} color="green">共享</Tag>
            </Tooltip>
          );
        }
        return (
          <Tooltip title="私有资源，仅创建者可见">
            <Tag icon={<LockOutlined />} color="orange">私有</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '使用的模型',
      dataIndex: 'model',
      key: 'model',
      width: 260,
      render: (model, record) => {
        if (record.source === 'external') {
          const platformType = record.external_type || 'custom';
          const platformColors = {
            'openai': 'blue',
            'dify': 'green',
            'fastgpt': 'cyan',
            'coze': 'purple',
            'custom': 'orange'
          };
          const platformLabels = {
            'openai': 'OpenAI',
            'dify': 'Dify',
            'fastgpt': 'FastGPT',
            'coze': 'Coze',
            'custom': '自定义'
          };
          const label = platformLabels[platformType] || platformType;
          return (
            <Tooltip title={label}>
              <Tag color={platformColors[platformType] || 'orange'} style={{ maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label}
              </Tag>
            </Tooltip>
          );
        }

        if (model === null || model === undefined || model === '') {
          const defaultModel = models.find(m => m.is_default_text) || models.find(m => m.is_default);
          const label = `默认文本生成 ${defaultModel ? `(${defaultModel.name})` : ''}`;
          return (
            <Tooltip title={label}>
              <Tag color={getModelBadge(defaultModel?.model_id)} style={{ maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label}
              </Tag>
            </Tooltip>
          );
        }

        const modelConfig = models.find(m => m.id.toString() === model?.toString());
        const label = record.model_name || modelConfig?.name || '默认';
        return (
          <Tooltip title={label}>
            <Tag color={getModelBadge(modelConfig?.model_id)} style={{ maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {label}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '系统提示词',
      dataIndex: 'systemPrompt',
      key: 'systemPrompt',
      width: 200,
      ellipsis: { showTitle: false },
      render: (_, record) => (
        <Tooltip placement="topLeft" title={record.system_prompt || '无提示词'}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {record.system_prompt ? record.system_prompt.substring(0, 50) + (record.system_prompt.length > 50 ? '...' : '') : '无提示词'}
          </div>
        </Tooltip>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: { showTitle: false },
      render: (description) => (
        <Tooltip placement="topLeft" title={description}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {description}
          </div>
        </Tooltip>
      ),
    },
    {
      title: '绑定能力',
      dataIndex: 'capabilities',
      key: 'capabilities',
      width: 200,
      render: (capabilities) => {
        const capabilitiesArray = Array.isArray(capabilities) ? capabilities : [];
        if (capabilitiesArray.length === 0) {
          return <Text type="secondary">无</Text>;
        }

        const displayCapabilities = capabilitiesArray.slice(0, 2);
        const remainingCount = capabilitiesArray.length - 2;

        return (
          <div>
            {displayCapabilities.map(cap => (
              <Tag key={cap.id} color="blue" style={{ marginBottom: 4, fontSize: '12px' }}>
                {cap.name}
              </Tag>
            ))}
            {remainingCount > 0 && (
              <Tooltip
                title={
                  <div>
                    {capabilitiesArray.slice(2).map(cap => (
                      <div key={cap.id}>{cap.name}</div>
                    ))}
                  </div>
                }
              >
                <Tag color="default" style={{ fontSize: '12px' }}>
                  +{remainingCount}
                </Tag>
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      title: '绑定知识库',
      dataIndex: 'allKnowledges',
      key: 'knowledges',
      width: 200,
      render: (knowledges, record) => {
        const totalKnowledges = Array.isArray(knowledges) ? knowledges : [];
        const internalKnowledges = Array.isArray(record.internalKnowledges) ? record.internalKnowledges : [];
        const externalKnowledges = Array.isArray(record.externalKnowledges) ? record.externalKnowledges : [];

        const internalCount = internalKnowledges.length;
        const externalCount = externalKnowledges.length;

        if (totalKnowledges.length === 0) {
          return <Text type="secondary">无</Text>;
        }

        const displayKnowledges = totalKnowledges.slice(0, 2);
        const remainingCount = totalKnowledges.length - 2;

        return (
          <div>
            <div style={{ marginBottom: 4 }}>
              {internalCount > 0 && (
                <Tag color="blue" style={{ fontSize: '12px' }}>
                  内部: {internalCount}
                </Tag>
              )}
              {externalCount > 0 && (
                <Tag color="green" style={{ fontSize: '12px' }}>
                  外部: {externalCount}
                </Tag>
              )}
            </div>
            {displayKnowledges.map((kb, index) => (
              <Tag
                key={`${kb.id}-${index}`}
                color={kb.provider_name ? "green" : "blue"}
                style={{ marginBottom: 2, fontSize: '11px' }}
              >
                {kb.name}
              </Tag>
            ))}
            {remainingCount > 0 && (
              <Tooltip
                title={
                  <div>
                    {totalKnowledges.slice(2).map((kb, index) => (
                      <div key={`${kb.id}-${index}`}>
                        {kb.name} {kb.provider_name && `(${kb.provider_name})`}
                      </div>
                    ))}
                  </div>
                }
              >
                <Tag color="default" style={{ fontSize: '11px' }}>
                  +{remainingCount}
                </Tag>
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      title: '绑定技能',
      dataIndex: 'skills',
      key: 'skills',
      width: 200,
      render: (skills) => {
        const skillsArray = Array.isArray(skills) ? skills : [];
        if (skillsArray.length === 0) {
          return <Text type="secondary">无</Text>;
        }

        const displaySkills = skillsArray.slice(0, 2);
        const remainingCount = skillsArray.length - 2;

        return (
          <div>
            {displaySkills.map(skill => (
              <Tag key={skill.id} color="purple" style={{ marginBottom: 4, fontSize: '12px' }}>
                📦 {skill.display_name || skill.name}
              </Tag>
            ))}
            {remainingCount > 0 && (
              <Tooltip
                title={
                  <div>
                    {skillsArray.slice(2).map(skill => (
                      <div key={skill.id}>📦 {skill.display_name || skill.name}</div>
                    ))}
                  </div>
                }
              >
                <Tag color="default" style={{ fontSize: '12px' }}>
                  +{remainingCount}
                </Tag>
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Tooltip title="编辑角色">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title="删除角色">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Card
      style={{
        borderRadius: '12px',
        boxShadow: 'var(--custom-shadow)'
      }}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <RobotOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            <span>角色列表</span>
          </div>
          <Space>
            <Segmented
              value={viewMode}
              onChange={handleViewModeChange}
              options={[
                { label: '表格', value: 'table', icon: <TableOutlined /> },
                { label: '卡片', value: 'card', icon: <AppstoreOutlined /> }
              ]}
            />
            <Select
              placeholder="按行动空间过滤"
              allowClear
              value={actionSpaceFilter || undefined}
              onChange={handleActionSpaceFilterChange}
              style={{ width: 200 }}
              size="middle"
            >
              {actionSpaces.map(space => (
                <Option key={space.id} value={space.id}>
                  {space.name}
                </Option>
              ))}
            </Select>
            <Input.Search
              placeholder="搜索角色名称、描述或提示词..."
              allowClear
              value={searchText}
              onChange={(e) => handleSearch(e.target.value)}
              onSearch={handleSearch}
              style={{ width: 300 }}
              size="middle"
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
              title="刷新数据"
            />
          </Space>
        </div>
      }
    >
      {viewMode === 'card' ? (
        <>
          <RoleCardView
            roles={filteredRoles.slice(
              (cardPagination.current - 1) * cardPagination.pageSize,
              cardPagination.current * cardPagination.pageSize
            )}
            models={models}
            loading={loading}
            onEdit={onEdit}
            onDelete={(roleId) => {
              const role = filteredRoles.find(r => r.id === roleId);
              if (role) {
                handleDelete(role);
              }
            }}
          />
          {!loading && filteredRoles.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <Pagination
                current={cardPagination.current}
                pageSize={cardPagination.pageSize}
                total={filteredRoles.length}
                pageSizeOptions={[12, 24, 48, 96]}
                showTotal={(total, range) => {
                  const searchInfo = searchText ? ` (搜索结果)` : '';
                  return `共 ${total} 个角色${searchInfo}，显示第 ${range[0]}-${range[1]} 条`;
                }}
                showSizeChanger
                showQuickJumper
                onChange={(page, pageSize) => {
                  setCardPagination({ current: page, pageSize: pageSize });
                }}
                onShowSizeChange={(_, size) => {
                  setCardPagination({ current: 1, pageSize: size });
                }}
              />
            </div>
          )}
        </>
      ) : loading ? (
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(item => (
            <Card key={item} style={{ marginBottom: 8 }}>
              <Skeleton active paragraph={{ rows: 2 }} />
            </Card>
          ))}
        </Space>
      ) : (
        <Table
          columns={columns}
          dataSource={filteredRoles}
          rowKey="id"
          scroll={{ x: 1500 }}
          pagination={{
            current: rolePagination.current,
            pageSize: rolePagination.pageSize,
            defaultPageSize: 10,
            pageSizeOptions: [10, 50, 100],
            showTotal: (total, range) => {
              const searchInfo = searchText ? ` (搜索结果)` : '';
              return `共 ${total} 个角色${searchInfo}，显示第 ${range[0]}-${range[1]} 条`;
            },
            showSizeChanger: true,
            showQuickJumper: true,
            position: ['bottomRight'],
            simple: false,
            onChange: (page, pageSize) => {
              setRolePagination({ current: page, pageSize: pageSize });
            },
            onShowSizeChange: (_, size) => {
              setRolePagination({ current: 1, pageSize: size });
            }
          }}
        />
      )}
    </Card>
  );
};

export default React.memo(RoleTable);
