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
      title: t('actionSpace.confirmDelete'),
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p>{t('actionSpace.deleteWarning', { name: space.name })}</p>
          <p><b>{t('message.warning')}：</b>{t('actionSpace.deleteWarningDetail')}</p>
          <ul>
            <li>{t('actionSpace.deleteItems.basic')}</li>
            <li>{t('actionSpace.deleteItems.rulesets')}</li>
            <li>{t('actionSpace.deleteItems.roles')}</li>
            <li>{t('actionSpace.deleteItems.environment')}</li>
            <li>{t('actionSpace.deleteItems.roleConfig')}</li>
            <li>{t('actionSpace.deleteItems.supervisor')}</li>
          </ul>
          <p><b>{t('actionSpace.note')}：</b>{t('actionSpace.deleteNote')}</p>
        </div>
      ),
      okText: t('actionSpace.deleteConfirmOk'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await actionSpaceAPI.delete(space.id);
          message.success(t('actionSpace.deleteSuccess'));
          await refetch();
        } catch (error) {
          console.error('Failed to delete action space:', error);

          const relatedTasks = error.response?.data?.related_tasks;
          if (error.response?.data?.error && relatedTasks) {
            Modal.info({
              title: t('actionSpace.cannotDeleteTitle'),
              icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
              content: (
                <div>
                  <p>{t('actionSpace.cannotDeleteContent', { name: space.name })}</p>
                  <div style={{ marginTop: 12, marginBottom: 12, maxHeight: '300px', overflowY: 'auto' }}>
                    {relatedTasks.map(task => (
                      <Card key={task.id} style={{ marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                            {task.title}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                            ID: {task.id} | {t('actionSpace.cannotDeleteTaskStatus', {
                              status: task.status === 'active'
                                ? t('actionSpace.taskStatus.active')
                                : task.status === 'completed'
                                  ? t('actionSpace.taskStatus.completed')
                                  : task.status
                            })}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                  <div style={{ backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '6px', padding: '12px', marginTop: 16 }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#52c41a' }}>{t('actionSpace.suggestionTitle')}</p>
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                      <li>{t('actionSpace.suggestion1')}</li>
                      <li>{t('actionSpace.suggestion2')}</li>
                      <li>{t('actionSpace.suggestion3')}</li>
                    </ul>
                  </div>
                </div>
              ),
              okText: t('actionSpace.gotIt'),
              width: 600
            });
          } else {
            const errorMsg = error.response?.data?.error;
            message.error(errorMsg
              ? t('actionSpace.deleteFailedWithReason', { reason: errorMsg })
              : t('actionSpace.deleteFailed'));
          }
        }
      }
    });
  };

  // 渲染表格视图的列配置
  const tableColumns = [
    {
      title: t('spaceOverview.col.name'),
      dataIndex: 'name',
      key: 'name',
      width: 180,
      fixed: 'left' as const,
    },
    {
      title: t('spaceOverview.col.description'),
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('spaceOverview.col.source'),
      dataIndex: 'created_by',
      key: 'resource_source',
      width: 100,
      render: (created_by, record) => {
        if (!created_by) {
          return (
            <Tooltip title={t('spaceOverview.source.systemTooltip')}>
              <Tag icon={<GlobalOutlined />} color="blue">{t('spaceOverview.source.system')}</Tag>
            </Tooltip>
          );
        }
        if (record.is_shared) {
          return (
            <Tooltip title={t('spaceOverview.source.sharedTooltip')}>
              <Tag icon={<TeamOutlined />} color="green">{t('spaceOverview.source.shared')}</Tag>
            </Tooltip>
          );
        }
        return (
          <Tooltip title={t('spaceOverview.source.privateTooltip')}>
            <Tag icon={<LockOutlined />} color="orange">{t('spaceOverview.source.private')}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: t('spaceOverview.col.tags'),
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
      title: t('spaceOverview.col.ruleSets'),
      dataIndex: 'rule_sets',
      key: 'rule_sets',
      width: 100,
      render: (ruleSets) => <>{(ruleSets || []).length}</>,
    },
    {
      title: t('spaceOverview.col.actionTaskCount'),
      dataIndex: 'action_tasks',
      key: 'action_tasks',
      width: 120,
      render: (actionTasks) => <>{(actionTasks || []).length}</>,
    },
    {
      title: t('spaceOverview.col.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: t('spaceOverview.col.actions'),
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Tooltip title={t('spaceOverview.action.viewDetail')}>
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
          <Tooltip title={t('spaceOverview.action.delete')}>
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
            {t('actionSpace.title')}
          </Title>
          <Text type="secondary">
            {t('actionSpace.subtitle')}
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsCreateModalVisible(true)}
        >
          {t('actionSpace.create')}
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
            {selectedTagIds.length > 0
              ? t('spaceOverview.filterByTagCount', { count: selectedTagIds.length })
              : t('spaceOverview.filterByTag')}
          </Button>
          <Button
            icon={<TagsOutlined />}
            onClick={() => setIsTagManagementVisible(true)}
          >
            {t('spaceOverview.tagManagement')}
          </Button>
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { label: t('spaceOverview.viewMode.card'), value: 'card', icon: <AppstoreOutlined /> },
              { label: t('spaceOverview.viewMode.table'), value: 'table', icon: <OrderedListOutlined /> }
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
                  <p style={{ marginTop: 8 }}>{t('actionSpace.create')}</p>
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
              showTotal: (total) => t('spaceOverview.paginationTotal', { total }),
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
