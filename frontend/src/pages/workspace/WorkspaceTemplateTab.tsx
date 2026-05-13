import React, { useState, useEffect, useCallback } from 'react';
import {
  Tree,
  Card,
  Input,
  Button,
  Space,
  Typography,
  message,
  Empty,
  Spin,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  TeamOutlined,
  UserOutlined,
  ReloadOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { MarkdownRenderer } from '../actiontask/components/ConversationExtraction';
import WorkspaceEditor from './WorkspaceEditor';
import { workspaceAPI } from '../../services/api/workspace';
import './WorkspaceManagement.css';

const { Text, Title } = Typography;

/**
 * 工作空间模板标签页组件
 * 使用树形结构组织不同类型的工作空间模板
 * 
 * @param {Object} props - 组件属性
 * @param {Object} [props.selectedWorkspace] - 选中的工作空间（可选）
 * @param {Function} [props.onSelectMemory] - 选中模板时的回调（可选）
 * @param {Function} [props.onDelete] - 删除模板时的回调（可选）
 * @param {Function} [props.onCreateTemplate] - 创建模板时的回调（可选）
 */
const WorkspaceTemplateTab = ({ selectedWorkspace, onSelectMemory, onDelete, onCreateTemplate }: any = {}) => {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [treeData, setTreeData] = useState([]);
  const [expandedKeys, setExpandedKeys] = useState(['shared-memory', 'agent-memory']);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [templateContent, setTemplateContent] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  // 获取模板的显示名称
  const getTemplateDisplayName = useCallback((template) => {
    let displayName = template.name || '';
    // 如果是"未命名模板"，尝试从内容中提取标题
    if (displayName === '未命名模板' && template.content) {
      const lines = template.content.split('\n');
      for (const line of lines) {
        if (line.startsWith('# ') && !line.includes('模板')) {
          displayName = line.replace('# ', '').trim();
          break;
        }
      }
    }
    return displayName;
  }, []);

  // 构建树形数据
  const buildTreeData = useCallback(() => {
    // 按类型分组模板
    const sharedTemplates = templates.filter(t => t.category === 'shared' || t.type === 'shared');
    const agentTemplates = templates.filter(t => t.category === 'agent' || t.type === 'agent');

    const treeNodes = [
      {
        title: (
          <Space>
            <TeamOutlined style={{ color: '#722ed1', fontSize: '14px' }} />
            <Text strong>共享工作空间模板</Text>
            <Text type="secondary">({sharedTemplates.length})</Text>
          </Space>
        ),
        key: 'shared-memory',
        data: { type: 'category', category: 'shared' },
        children: sharedTemplates.map(template => ({
          title: (
            <Space>
              <FileTextOutlined style={{ color: '#722ed1', fontSize: '12px' }} />
              <Text>{getTemplateDisplayName(template)}</Text>
            </Space>
          ),
          key: `template-${template.id}`,
          data: { type: 'template', template },
          isLeaf: true
        }))
      },
      {
        title: (
          <Space>
            <UserOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
            <Text strong>智能体工作空间模板</Text>
            <Text type="secondary">({agentTemplates.length})</Text>
          </Space>
        ),
        key: 'agent-memory',
        data: { type: 'category', category: 'agent' },
        children: agentTemplates.map(template => ({
          title: (
            <Space>
              <FileTextOutlined style={{ color: '#52c41a', fontSize: '12px' }} />
              <Text>{getTemplateDisplayName(template)}</Text>
            </Space>
          ),
          key: `template-${template.id}`,
          data: { type: 'template', template },
          isLeaf: true
        }))
      }
    ];

    setTreeData(treeNodes);
  }, [templates, getTemplateDisplayName]);

  useEffect(() => {
    buildTreeData();
  }, [buildTreeData]);

  // 加载工作空间模板列表
  const loadTemplates = async () => {
    try {
      setLoading(true);
      const templateList = await workspaceAPI.getWorkspaceTemplates();
      console.log('加载的模板列表:', templateList); // 调试信息
      setTemplates(templateList);
    } catch (error) {
      console.error('加载工作空间模板失败:', error);
      message.error('加载工作空间模板失败');
    } finally {
      setLoading(false);
    }
  };



  // 处理树节点选择
  const handleSelect = (selectedKeys, info) => {
    const { data } = info.node;
    const nodeKey = info.node.key;

    if (data.type === 'category') {
      // 点击分类节点时，切换展开/收起状态
      const isExpanded = expandedKeys.includes(nodeKey);
      if (isExpanded) {
        setExpandedKeys(expandedKeys.filter(key => key !== nodeKey));
      } else {
        setExpandedKeys([...expandedKeys, nodeKey]);
      }
      // 清空选中状态和编辑模式
      setSelectedKeys([]);
      setSelectedTemplate(null);
      setTemplateTitle(''); // 清空标题状态
      setEditMode(false);
    } else if (data.type === 'template') {
      // 点击模板节点时，选中该模板
      console.log('选中的模板:', data.template); // 调试信息
      setSelectedKeys([nodeKey]);
      setSelectedTemplate(data.template);
      setTemplateTitle(getTemplateDisplayName(data.template)); // 更新标题状态
      setEditMode(false);
      // 只有当回调存在时才调用
      if (onSelectMemory) {
        onSelectMemory(data.template);
      }
    }
  };

  // 处理树节点展开
  const handleExpand = (expandedKeys) => {
    setExpandedKeys(expandedKeys);
  };

  // 刷新数据
  const handleRefresh = () => {
    loadTemplates();
  };

  // 创建新模板
  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setTemplateTitle('');
    setTemplateContent('');
    setEditMode(true);
    setSelectedKeys([]);
  };

  // 编辑模板
  const handleEditTemplate = () => {
    if (!selectedTemplate) return;

    setTemplateTitle(getTemplateDisplayName(selectedTemplate));
    setTemplateContent(selectedTemplate.content || '');
    setEditMode(true);
  };

  // 保存模板
  const handleSaveTemplate = async () => {
    if (!templateTitle.trim()) {
      message.error('模板标题不能为空');
      return;
    }

    if (!templateContent.trim()) {
      message.error('模板内容不能为空');
      return;
    }

    try {
      if (selectedTemplate) {
        // 更新现有模板
        await workspaceAPI.updateWorkspaceTemplate(selectedTemplate.id, {
          name: templateTitle,
          content: templateContent,
          description: selectedTemplate.description || '',
          category: selectedTemplate.category || 'agent'
        });
        // 更新本地的selectedTemplate对象
        setSelectedTemplate({
          ...selectedTemplate,
          name: templateTitle,
          content: templateContent
        });
        message.success('模板更新成功');
      } else {
        // 创建新模板
        await workspaceAPI.createNewWorkspaceTemplate({
          name: templateTitle,
          content: templateContent,
          description: '',
          category: 'agent' // 默认分类，后续可以添加选择器
        });
        message.success('模板创建成功');
      }

      setEditMode(false);
      loadTemplates(); // 重新加载模板列表
    } catch (error) {
      console.error('保存模板失败:', error);
      message.error('保存模板失败');
    }
  };

  // 删除模板
  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      await workspaceAPI.deleteWorkspaceTemplate(selectedTemplate.id);
      message.success('模板删除成功');
      setSelectedTemplate(null);
      setSelectedKeys([]);
      setEditMode(false);
      loadTemplates(); // 重新加载模板列表
    } catch (error) {
      console.error('删除模板失败:', error);
      message.error('删除模板失败');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 250px)', gap: '16px' }}>
      {/* 左侧：模板分类树 */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <Card
          title={
            <Space>
              <FolderOutlined />
              工作空间模板分类
              <Tooltip title="刷新">
                <Button
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={handleRefresh}
                 
                />
              </Tooltip>
            </Space>
          }
          style={{ height: '100%' }}
          styles={{ body: { padding: 0 } }}
        >
          <div className="tree-container" style={{ padding: '16px' }}>
            {treeData.length === 0 ? (
              <Empty
                description="暂无工作空间模板"
                style={{ marginTop: '50px' }}
              />
            ) : (
              <Tree
                showIcon={false}
                treeData={treeData}
                selectedKeys={selectedKeys}
                expandedKeys={expandedKeys}
                onSelect={handleSelect}
                onExpand={handleExpand}
                switcherIcon={({ expanded }) =>
                  expanded ? <FolderOpenOutlined style={{ fontSize: '14px' }} /> : <FolderOutlined style={{ fontSize: '14px' }} />
                }
              />
            )}
          </div>
        </Card>
      </div>

      {/* 右侧：模板内容查看器 */}
      <div style={{ flex: 1 }}>
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <FileTextOutlined />
                工作空间模板内容
              </Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreateTemplate}
               
              >
                新建模板
              </Button>
            </div>
          }
          style={{ height: '100%' }}
          styles={{ body: { height: 'calc(100% - 57px)', overflow: 'auto' } }}
        >
          {selectedTemplate || editMode ? (
            <div>
              {/* 操作按钮区域 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                {editMode ? (
                  <Space>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={handleSaveTemplate}
                    >
                      保存
                    </Button>
                    <Button
                      icon={<CloseOutlined />}
                      onClick={() => {
                        setEditMode(false);
                        setTemplateTitle('');
                        setTemplateContent('');
                        if (!selectedTemplate) {
                          setSelectedTemplate(null);
                        }
                      }}
                    >
                      取消
                    </Button>
                  </Space>
                ) : (
                  <Space>
                    <Button
                      icon={<EditOutlined />}
                      onClick={handleEditTemplate}
                    >
                      编辑
                    </Button>
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={handleDeleteTemplate}
                    >
                      删除
                    </Button>
                  </Space>
                )}
              </div>

              {/* 标题区域 */}
              <div style={{ marginBottom: 16 }}>
                {editMode ? (
                  <Input
                    placeholder="模板标题"
                    value={templateTitle}
                    onChange={(e) => setTemplateTitle(e.target.value)}
                  />
                ) : (
                  <Title level={4}>
                    {templateTitle || (selectedTemplate ? getTemplateDisplayName(selectedTemplate) : '')}
                  </Title>
                )}
              </div>
              {editMode ? (
                <WorkspaceEditor
                  value={templateContent}
                  onChange={setTemplateContent}
                  showActions={false}
                />
              ) : (
                <div style={{ border: '1px solid var(--custom-border)', borderRadius: '4px', padding: '16px', backgroundColor: 'var(--custom-header-bg)' }}>
                  <MarkdownRenderer content={selectedTemplate?.content || ''} />
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <FileTextOutlined style={{ fontSize: '48px', color: 'var(--custom-border)', marginBottom: '16px' }} />
              <Text type="secondary">选择一个工作空间模板查看详情，或点击"新建模板"创建新模板</Text>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default WorkspaceTemplateTab;
