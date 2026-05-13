import React, { useState, useMemo } from 'react';
import {
  Card, Button, Space, Table, Row, Col, Modal, Typography, Skeleton, Tag, Tooltip, Segmented, App
} from 'antd';
import {
  PlusOutlined, FilterOutlined, TagsOutlined,
  AppstoreOutlined, OrderedListOutlined,
  DeleteOutlined, InfoCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined, TeamOutlined,
  ThunderboltOutlined, CalendarOutlined,
  GlobalOutlined, LockOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { actionSpaceAPI } from '../../../services/api/actionspace';

// 子组件
import { useActionSpaceData } from './useActionSpaceData';
import ActionSpaceCard from './ActionSpaceCard';
import CreateSpaceModal from './CreateSpaceModal';
import TagFilter from './TagFilter';
import TagManagementModal from '../../../components/TagManagementModal';

const { Title, Text } = Typography;

const ActionSpaceOverview = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();

  // 视图状态
  const [viewMode, setViewMode] = useState('card');
  const [tagsVisible, setTagsVisible] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isTagManagementVisible, setIsTagManagementVisible] = useState(false);

  // 数据
  const { actionSpaces, loading, industryTags, scenarioTags, refetch } = useActionSpaceData();

  // 标签筛选（保留在主组件，逻辑简单）
  const filteredSpaces = useMemo(() => {
    if (selectedTagIds.length === 0) return actionSpaces;
    return actionSpaces.filter(space => {
      const spaceTagIds = (space.tags || []).map(tag => tag.id);
      return selectedTagIds.every(tagId => spaceTagIds.includes(tagId));
    });
  }, [actionSpaces, selectedTagIds]);

  // 操作函数
  const handleSpaceClick = (space) => {
    navigate(`/action-space/detail/${space.id}`);
  };

  const handleDeleteSpace = (space) => {
    Modal.confirm({
      title: t('actionSpace.confirmDelete') || '确认删除',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p>{t('actionSpace.deleteWarning', { name: space.name }) || `确定要删除行动空间 "${space.name}" 吗？`}</p>
          <p><b>{t('message.warning') || '警告'}：</b>{t('actionSpace.deleteWarningDetail') || '删除操作不可恢复'}</p>
          <ul>
            <li>{t('actionSpace.deleteItems.basic') || '基本信息'}</li>
            <li>{t('actionSpace.deleteItems.rulesets') || '规则集'}</li>
            <li>{t('actionSpace.deleteItems.roles') || '角色配置'}</li>
            <li>{t('actionSpace.deleteItems.environment') || '环境变量'}</li>
            <li>{t('actionSpace.deleteItems.roleConfig') || '角色关联'}</li>
            <li>{t('actionSpace.deleteItems.supervisor') || '监督者配置'}</li>
          </ul>
          <p><b>{t('actionSpace.note') || '注意'}：</b>{t('actionSpace.deleteNote') || '关联的行动任务不会被删除'}</p>
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await actionSpaceAPI.delete(space.id);
          message.success('行动空间删除成功');
          await refetch();
        } catch (error) {
          console.error('删除行动空间失败:', error);
          
          // 处理特定错误信息
          if (error.response?.data?.error) {
            const errorMsg = error.response.data.error;
            const relatedTasks = error.response.data.related_tasks;

            if (errorMsg.includes('关联的行动任务') && relatedTasks) {
              Modal.info({
                title: '无法删除行动空间',
                icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
                content: (
                  <div>
                    <p>行动空间 <strong>"{space.name}"</strong> 无法删除，因为存在以下关联的行动任务：</p>
                    <div style={{ marginTop: 12, marginBottom: 12, maxHeight: '300px', overflowY: 'auto' }}>
                      {relatedTasks.map(task => (
                        <Card key={task.id} style={{ marginBottom: 8 }}>
                          <div>
                            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                              {task.title}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                              ID: {task.id} | 状态: {task.status === 'active' ? '进行中' : task.status === 'completed' ? '已完成' : task.status}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                    <div style={{ backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '6px', padding: '12px', marginTop: 16 }}>
                      <p style={{ margin: 0, fontWeight: 'bold', color: '#52c41a' }}>建议操作：</p>
                      <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                        <li>先完成或删除相关的行动任务</li>
                        <li>或者将行动任务迁移到其他行动空间</li>
                        <li>可以在任务管理页面中处理这些任务</li>
                      </ul>
                    </div>
                  </div>
                ),
                okText: '我知道了',
                width: 600
              });
            } else {
              message.error(`删除行动空间失败: ${errorMsg}`);
            }
          } else {
            message.error('删除行动空间失败');
          }
        }
      }
    });
  };

  // 渲染表格视图的列配置
  const tableColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      fixed: 'left' as const,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
    },
    {
      title: '来源',
      dataIndex: 'created_by',
      key: 'resource_source',
      width: 100,
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
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 150,
      render: (tags) => (
        tags && tags.length > 0 ? (
          <div>
            {tags.map(tag => (
              <Tag key={tag.id} color={tag.color || '#1677ff'} style={{ marginBottom: 4 }}>
                {tag.name}
              </Tag>
            ))}
          </div>
        ) : null
      ),
    },
    {
      title: '规则集',
      dataIndex: 'rule_sets',
      key: 'rule_sets',
      width: 100,
      render: (ruleSets) => <>{(ruleSets || []).length}</>,
    },
    {
      title: '行动任务数',
      dataIndex: 'action_tasks',
      key: 'action_tasks',
      width: 120,
      render: (actionTasks) => <>{(actionTasks || []).length}</>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<InfoCircleOutlined />}
              style={{ color: '#1677ff' }}
              onClick={(e) => {
                e.stopPropagation();
                handleSpaceClick(record);
              }}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              icon={<DeleteOutlined />}
             
              danger
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteSpace(record);
              }}
            />
          </Tooltip>
        </Space>
      )
    },
  ];

  return (
    <div className="action-space-overview">
      {/* 页面头部 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
      }}>
        <div>
          <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
            {t('actionSpace.title') || '行动空间管理'}
          </Title>
          <Text type="secondary">
            {t('actionSpace.subtitle') || '创建和管理行动空间'}
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsCreateModalVisible(true)}
        >
          {t('actionSpace.create') || '创建行动空间'}
        </Button>
      </div>

      {/* 工具栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Space>
          <Button
            icon={<FilterOutlined />}
            onClick={() => setTagsVisible(!tagsVisible)}
            type={selectedTagIds.length > 0 ? 'primary' : 'default'}
          >
            按标签筛选 {selectedTagIds.length > 0 ? `(${selectedTagIds.length})` : ''}
          </Button>
          <Button
            icon={<TagsOutlined />}
            onClick={() => setIsTagManagementVisible(true)}
          >
            标签管理
          </Button>
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { label: '卡片视图', value: 'card', icon: <AppstoreOutlined /> },
              { label: '列表视图', value: 'table', icon: <OrderedListOutlined /> }
            ]}
          />
        </Space>
      </div>

      {/* 标签筛选面板 */}
      {tagsVisible && (
        <TagFilter
          industryTags={industryTags}
          scenarioTags={scenarioTags}
          selectedTagIds={selectedTagIds}
          onTagClick={(id) => setSelectedTagIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
          )}
          onClear={() => setSelectedTagIds([])}
        />
      )}

      {/* 卡片视图 */}
      {viewMode === 'card' && (
        loading ? (
          <Row gutter={[16, 16]}>
            {[1, 2, 3, 4, 5, 6].map(item => (
              <Col xs={24} sm={12} md={8} lg={6} key={item}>
                <Card
                  style={{
                    height: '100%',
                    minHeight: '300px',
                    borderRadius: '8px'
                  }}
                >
      <Skeleton active avatar paragraph={{ rows: 4 }} />
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Row gutter={[16, 16]}>
            {filteredSpaces.map(space => (
              <Col xs={24} sm={12} md={8} lg={6} key={space.id}>
                <ActionSpaceCard
                  space={space}
                  onClick={handleSpaceClick}
                  onDelete={handleDeleteSpace}
                />
              </Col>
            ))}
            {/* 添加卡片 */}
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
           onClick={() => setIsCreateModalVisible(true)}
                style={{
                  height: '100%',
                  minHeight: '300px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px dashed var(--custom-border)',
                  backgroundColor: 'var(--custom-header-bg)',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ textAlign: 'center', padding: '80px 0' }}>
                  <PlusOutlined style={{ fontSize: '32px', color: '#91caff' }} />
                  <p style={{ marginTop: 8 }}>创建行动空间</p>
                </div>
              </Card>
            </Col>
          </Row>
        )
      )}

      {/* 表格视图 */}
      {viewMode === 'table' && (
        loading ? (
          <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(item => (
              <Card key={item}>
                <Skeleton active paragraph={{ rows: 2 }} />
              </Card>
            ))}
          </Space>
        ) : (
          <Table
            dataSource={filteredSpaces}
            columns={tableColumns}
            rowKey="id"
            scroll={{ x: 'max-content' }}
            onRow={(record) => ({
            onClick: (event) => {
              const target = event.target as HTMLElement;
              const actionButton = target.closest('.ant-btn');
              if (!actionButton) {
                handleSpaceClick(record);
              }
            },
            style: { cursor: 'pointer' }
          })}
            pagination={{
              defaultPageSize: 10,
              pageSizeOptions: [10, 50, 100],
              showTotal: (total) => `共 ${total} 个行动空间`,
              showSizeChanger: true,
              showQuickJumper: true,
              position: ['bottomRight']
            }}
          />
        )
      )}

      {/* Modals */}
      <CreateSpaceModal
        visible={isCreateModalVisible}
        onCancel={() => setIsCreateModalVisible(false)}
        onSuccess={() => {
          setIsCreateModalVisible(false);
          refetch();
        }}
        industryTags={industryTags}
        scenarioTags={scenarioTags}
      />

      <TagManagementModal
        visible={isTagManagementVisible}
        onCancel={() => setIsTagManagementVisible(false)}
        onTagsChange={refetch}
      />
    </div>
  );
};

export default ActionSpaceOverview;
