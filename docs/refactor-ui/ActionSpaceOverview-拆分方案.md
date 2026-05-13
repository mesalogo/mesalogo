# ActionSpaceOverview 组件拆分方案

> 当前状态: 1345 行超大组件
> 优先级: P1 (重要)
> 预计工作量: 2 天

## 📊 现状分析

### 组件复杂度
- **代码行数**: 1345 行
- **状态数量**: 14 个 useState
- **渲染函数**: 4 个大型渲染函数
- **API 调用**: 3 个独立的 API 获取函数
- **子组件**: 内嵌多个逻辑组件 (SmartTagsContainer)

### 主要功能模块
1. **数据获取**
   - 行动空间列表
   - 标签数据 (行业/场景)
   - 模型配置
   - 全局设置

2. **视图渲染**
   - 卡片视图 (renderCardView - 约 300 行)
   - 表格视图 (renderTableView - 约 150 行)
   - 标签筛选器 (renderTagFilter - 约 100 行)

3. **用户交互**
   - 创建行动空间 (Modal + Form - 约 200 行)
   - 删除行动空间 (确认对话框 + 错误处理)
   - 标签管理
   - 标签筛选
   - 视图切换

4. **辅助生成**
   - 背景设定生成 (约 100 行)
   - 规则生成 (约 100 行)

### 性能问题
1. **重新渲染频繁**: 任何状态更新都会重新渲染整个组件
2. **大量 DOM 节点**: 卡片视图在空间较多时性能差
3. **未使用虚拟化**: 列表渲染没有使用 react-window
4. **复杂状态逻辑**: 14 个 useState 难以维护

---

## 🎯 拆分目标

### 性能目标
- 组件重新渲染时间减少 50-60%
- 大列表（>50个空间）滚动帧率从 30fps 提升到 60fps
- 代码可读性和可维护性显著提升

### 架构目标
- 单个文件不超过 300 行
- 关注点分离：数据、视图、交互、业务逻辑
- 提取可复用的自定义 Hooks
- 提高组件可测试性

---

## 📁 拆分后的目录结构 (KISS 原则)

**核心思想：只拆关键部分，保持简单扁平**

```
frontend/src/pages/actionspace/ActionSpaceOverview/
├── index.js                          (200行) - 主组件，保留主逻辑
├── useActionSpaceData.js             (150行) - 数据获取 Hook
├── ActionSpaceCard.js                (150行) - 卡片组件（最重的渲染部分）
├── CreateSpaceModal.js               (300行) - 创建 Modal（包含所有表单逻辑）
└── TagFilter.js                      (100行) - 标签筛选面板

总计约 900 行（拆分后）
原来 1345 行 → 拆成 5 个文件
```

**拆分原则：**
1. ✅ **只拆影响性能的大块**：卡片渲染、Modal
2. ✅ **数据逻辑单独提取**：useActionSpaceData Hook
3. ✅ **保持简单**：不过度抽象，功能相关的代码放在一起
4. ❌ 不拆：头部、按钮、小组件（没必要）

---

## 🔧 详细拆分方案 (简化版)

### 1. 主入口组件 (index.js) - 200行

**职责**: 主逻辑、状态管理、布局组合

```javascript
// frontend/src/pages/actionspace/ActionSpaceOverview/index.js
import React, { useState, useMemo } from 'react';
import { Card, Button, Space, Table, Row, Col } from 'antd';
import { PlusOutlined, FilterOutlined, TagsOutlined, AppstoreOutlined, OrderedListOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useActionSpaceData } from './useActionSpaceData';
import ActionSpaceCard from './ActionSpaceCard';
import CreateSpaceModal from './CreateSpaceModal';
import TagFilter from './TagFilter';
import TagManagementModal from '../../../components/TagManagementModal';

const ActionSpaceOverview = () => {
  const { t } = useTranslation();
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

  // 操作函数（保留在主组件，避免过度抽象）
  const handleSpaceClick = (space) => navigate(`/actionspace/detail/${space.id}`);
  const handleDeleteSpace = (space) => { /* 删除逻辑 */ };

  return (
    <div>
      {/* 页面头部 - 直接写在这里，不单独拆组件 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h4>{t('actionSpace.title')}</h4>
          <p>{t('actionSpace.subtitle')}</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)}>
          {t('actionSpace.create')}
        </Button>
      </div>

      <Card
        title={
          <Space>
            <Button icon={<FilterOutlined />} onClick={() => setTagsVisible(!tagsVisible)}>
              筛选 {selectedTagIds.length > 0 && `(${selectedTagIds.length})`}
            </Button>
            <Button icon={<TagsOutlined />} onClick={() => setIsTagManagementVisible(true)}>
              标签管理
            </Button>
            {/* 视图切换 - 简单的按钮组，不需要单独组件 */}
            <Button.Group>
              <Button
                type={viewMode === 'card' ? 'primary' : 'default'}
                icon={<AppstoreOutlined />}
                onClick={() => setViewMode('card')}
              />
              <Button
                type={viewMode === 'table' ? 'primary' : 'default'}
                icon={<OrderedListOutlined />}
                onClick={() => setViewMode('table')}
              />
            </Button.Group>
          </Space>
        }
      >
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

        {/* 卡片视图 - 循环渲染 ActionSpaceCard */}
        {viewMode === 'card' && (
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
            {/* 添加卡片 - 简单结构，不需要单独组件 */}
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card hoverable onClick={() => setIsCreateModalVisible(true)}>
                <div style={{ textAlign: 'center', padding: '80px 0' }}>
                  <PlusOutlined style={{ fontSize: 32 }} />
                  <p>创建行动空间</p>
                </div>
              </Card>
            </Col>
          </Row>
        )}

        {/* 表格视图 - 直接用 Table，不需要单独组件 */}
        {viewMode === 'table' && (
          <Table
            dataSource={filteredSpaces}
            loading={loading}
            columns={[
              { title: '名称', dataIndex: 'name', key: 'name' },
              { title: '描述', dataIndex: 'description', key: 'description' },
              // ... 其他列
            ]}
            onRow={(record) => ({
              onClick: () => handleSpaceClick(record)
            })}
          />
        )}
      </Card>

      {/* Modals */}
      <CreateSpaceModal
        visible={isCreateModalVisible}
        onCancel={() => setIsCreateModalVisible(false)}
        onSuccess={() => { setIsCreateModalVisible(false); refetch(); }}
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
```

**为什么这样简化：**
- ✅ 头部、按钮组这些简单的UI直接写在主组件
- ✅ 标签筛选逻辑简单（useMemo），不需要单独Hook
- ✅ 表格视图配置简单，直接用Ant Design的Table
- ✅ 操作函数简短，保留在主组件避免props drilling

---

### 2. 数据获取 Hook (useActionSpaceData.js) - 150行

**职责**: 只负责数据获取，简单清晰

```javascript
// frontend/src/pages/actionspace/ActionSpaceOverview/useActionSpaceData.js
import { useState, useEffect } from 'react';
import { message } from 'antd';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import { actionTaskAPI } from '../../../services/api/actionTask';

export const useActionSpaceData = () => {
  const [actionSpaces, setActionSpaces] = useState([]);
  const [industryTags, setIndustryTags] = useState([]);
  const [scenarioTags, setScenarioTags] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 并行获取数据
      const [spaces, tags, tasks] = await Promise.all([
        actionSpaceAPI.getAll(),
        actionSpaceAPI.getAllTags(),
        actionTaskAPI.getAll()
      ]);

      // 统计任务数
      const taskCount = {};
      tasks.forEach(task => {
        if (task.action_space_id) {
          taskCount[task.action_space_id] = (taskCount[task.action_space_id] || 0) + 1;
        }
      });

      // 处理数据
      const processed = spaces.map(space => ({
        ...space,
        tags: Array.isArray(space.tags) ? space.tags : [],
        action_tasks: Array(taskCount[space.id] || 0).fill(null)
      })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setActionSpaces(processed);
      setIndustryTags(tags.filter(t => t.type === 'industry'));
      setScenarioTags(tags.filter(t => t.type === 'scenario'));
    } catch (error) {
      console.error('获取数据失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { actionSpaces, industryTags, scenarioTags, loading, refetch: fetchData };
};
```

**为什么这样简化：**
- ✅ 去掉过度的 useCallback（没必要，fetchData 不作为依赖传递）
- ✅ 简化变量命名
- ✅ 减少不必要的注释

---

### 3. 卡片组件 (ActionSpaceCard.js) - 150行

**职责**: 渲染单个空间卡片（性能关键点）

```javascript
// frontend/src/pages/actionspace/ActionSpaceOverview/ActionSpaceCard.js
import React from 'react';
import { Card, Button, Typography, Space, Tag, Divider } from 'antd';
import {
  InfoCircleOutlined, DeleteOutlined,
  FileTextOutlined, TeamOutlined,
  ThunderboltOutlined, CalendarOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * 使用 React.memo 优化 - 只在数据真正变化时重新渲染
 */
const ActionSpaceCard = React.memo(({ space, onClick, onDelete }) => {
  const handleCardClick = (e) => {
    // 防止删除按钮触发卡片点击
    if (!e.target.closest('[data-delete]')) {
      onClick(space);
    }
  };

  return (
    <Card
      hoverable
      onClick={handleCardClick}
      style={{ height: '100%', minHeight: 300, cursor: 'pointer' }}
      actions={[
        <Button type="text" icon={<InfoCircleOutlined />} onClick={() => onClick(space)}>
          详情
        </Button>,
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          data-delete
          onClick={(e) => { e.stopPropagation(); onDelete(space); }}
        >
          删除
        </Button>
      ]}
    >
      {/* 标题 */}
      <Title level={5} ellipsis={{ rows: 2 }}>
        {space.name}
      </Title>

      {/* 描述 */}
      <Text type="secondary" style={{ fontSize: 12 }}>
        {space.description}
      </Text>

      {/* 标签 */}
      {space.tags?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {space.tags.map(tag => (
            <Tag key={tag.id} color={tag.color}>
              {tag.name}
            </Tag>
          ))}
        </div>
      )}

      <Divider />

      {/* 统计信息 */}
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <div>
          <FileTextOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          <Text type="secondary">规则集：</Text>
          <Text strong>{(space.rule_sets || []).length}个</Text>
        </div>
        <div>
          <TeamOutlined style={{ marginRight: 8 }} />
          <Text type="secondary">角色：</Text>
          <Text>{(space.roles || []).length}个</Text>
        </div>
        <div>
          <ThunderboltOutlined style={{ marginRight: 8, color: '#52c41a' }} />
          <Text type="secondary">任务：</Text>
          <Text>{(space.action_tasks || []).length}个</Text>
        </div>
        <div>
          <CalendarOutlined style={{ marginRight: 8 }} />
          <Text type="secondary">创建：</Text>
          <Text>{new Date(space.created_at).toLocaleDateString()}</Text>
        </div>
      </Space>
    </Card>
  );
}, (prev, next) => {
  // 自定义比较：只在关键数据变化时重新渲染
  return prev.space.id === next.space.id &&
         prev.space.updated_at === next.space.updated_at;
});

export default ActionSpaceCard;
```

**为什么这样设计：**
- ✅ 使用 React.memo 优化渲染性能（1345行组件最大的性能问题）
- ✅ 自定义比较函数，精确控制何时重新渲染
- ✅ 保持简单，所有卡片逻辑在一个文件

---

### 4. 创建Modal (CreateSpaceModal.js) - 300行

**职责**: 创建空间表单（包含所有表单逻辑和辅助生成）

```javascript
// frontend/src/pages/actionspace/ActionSpaceOverview/CreateSpaceModal.js
import React, { useState } from 'react';
import { Modal, Form, Input, Select, Checkbox, message } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import { modelConfigAPI } from '../../../services/api/model';
import { settingsAPI } from '../../../services/api/settings';

const { TextArea } = Input;

const CreateSpaceModal = ({ visible, onCancel, onSuccess, industryTags, scenarioTags }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState({ background: false, rules: false });

  // 辅助生成背景
  const generateBackground = async () => {
    const { name, description } = form.getFieldsValue();
    if (!name || !description) {
      message.warning('请先填写名称和描述');
      return;
    }

    setGenerating({ ...generating, background: true });
    try {
      const templates = await settingsAPI.getPromptTemplates();
      const prompt = templates.actionSpaceBackground
        .replace('{name}', name)
        .replace('{description}', description);

      let content = '';
      await modelConfigAPI.testModelStream(
        'default',
        prompt,
        (chunk) => {
          if (chunk) {
            content += chunk;
            form.setFieldsValue({ background: content });
          }
        }
      );
    } catch (error) {
      message.error('生成失败');
    } finally {
      setGenerating({ ...generating, background: false });
    }
  };

  // 辅助生成规则（类似 generateBackground）
  const generateRules = async () => { /* ... */ };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await actionSpaceAPI.create({
        name: values.name,
        description: values.description,
        rules: values.rules || '',
        settings: { background: values.background || '' },
        tag_ids: values.tag_ids || [],
        is_shared: values.is_shared || false
      });

      message.success('创建成功');
      form.resetFields();
      onSuccess();
    } catch (error) {
      message.error('创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="创建行动空间"
      open={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="名称" rules={[{ required: true }]}>
          <Input placeholder="输入行动空间名称" />
        </Form.Item>

        <Form.Item name="description" label="描述" rules={[{ required: true }]}>
          <TextArea rows={3} placeholder="输入描述" />
        </Form.Item>

        <Form.Item name="tag_ids" label="标签">
          <Select mode="multiple" placeholder="选择标签">
            <Select.OptGroup label="行业">
              {industryTags.map(tag => (
                <Select.Option key={tag.id} value={tag.id}>
                  {tag.name}
                </Select.Option>
              ))}
            </Select.OptGroup>
            <Select.OptGroup label="场景">
              {scenarioTags.map(tag => (
                <Select.Option key={tag.id} value={tag.id}>
                  {tag.name}
                </Select.Option>
              ))}
            </Select.OptGroup>
          </Select>
        </Form.Item>

        <Form.Item
          name="background"
          label={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>背景设定</span>
              <a onClick={generateBackground}>
                <RobotOutlined /> 辅助生成
              </a>
            </div>
          }
        >
          <TextArea rows={5} placeholder="输入背景设定" loading={generating.background} />
        </Form.Item>

        <Form.Item
          name="rules"
          label={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>基本规则</span>
              <a onClick={generateRules}>
                <RobotOutlined /> 辅助生成
              </a>
            </div>
          }
        >
          <TextArea rows={5} placeholder="输入基本规则" loading={generating.rules} />
        </Form.Item>

        <Form.Item name="is_shared" valuePropName="checked">
          <Checkbox>共享给所有用户</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateSpaceModal;
```

**为什么这样设计：**
- ✅ 所有表单逻辑在一个文件（包括辅助生成）
- ✅ 避免过度拆分成多个小组件
- ✅ Modal 通常是独立功能，整体拆分更合理

---

### 5. 卡片视图组件 (ActionSpaceCard.js)

**职责**: 渲染单个行动空间卡片

```javascript
// frontend/src/pages/actionspace/ActionSpaceOverview/components/ActionSpaceCardView/ActionSpaceCard.js
import React from 'react';
import { Card, Button, Typography, Space, Tag, Divider, Tooltip } from 'antd';
import {
  InfoCircleOutlined,
  DeleteOutlined,
  FileTextOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  CalendarOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * 行动空间卡片组件
 * 使用 React.memo 优化性能，避免不必要的重新渲染
 */
const ActionSpaceCard = React.memo(({
  space,
  onClick,
  onDeleteClick
}) => {
  const handleCardClick = (e) => {
    // 排除删除按钮点击
    const deleteButton = e.target.closest('[data-action="delete"]');
    if (!deleteButton && onClick) {
      onClick(space);
    }
  };

  const renderTags = () => {
    if (!space.tags || space.tags.length === 0) {
      return null;
    }

    return (
      <div style={{ marginTop: 8, marginBottom: 12, minHeight: '68px' }}>
        {space.tags.map(tag => (
          <Tag
            key={tag.id}
            color={tag.color || '#1677ff'}
            style={{
              marginRight: 4,
              marginBottom: 4,
              borderRadius: 4,
              fontSize: '12px',
              padding: '2px 8px'
            }}
          >
            {tag.name}
          </Tag>
        ))}
      </div>
    );
  };

  return (
    <Card
      size="small"
      hoverable
      onClick={handleCardClick}
      style={{
        cursor: 'pointer',
        height: '100%',
        minHeight: '300px',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column'
      }}
      styles={{
        body: {
          padding: '12px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }
      }}
      actions={[
        <Button
          type="text"
          icon={<InfoCircleOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            onClick(space);
          }}
        >
          详情
        </Button>,
        <Button
          type="text"
          icon={<DeleteOutlined />}
          danger
          data-action="delete"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteClick(space);
          }}
        >
          删除
        </Button>
      ]}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 标题 */}
        <Title level={5} ellipsis={{ rows: 2 }} style={{ margin: 0, marginBottom: 10 }}>
          {space.name}
        </Title>

        {/* 描述 */}
        <div style={{ marginBottom: 10, height: '40px', overflow: 'hidden' }}>
          <Text type="secondary" style={{ fontSize: '12px', lineHeight: '20px' }}>
            {space.description}
          </Text>
        </div>

        {/* 标签 */}
        {renderTags()}

        {/* 关键信息 */}
        <div style={{ marginTop: 'auto' }}>
          <Divider />
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div>
              <FileTextOutlined style={{ marginRight: 8, color: '#1677ff' }} />
              <Text type="secondary">规则集：</Text>
              <Text strong style={{ color: '#1677ff' }}>
                {(space.rule_sets || []).length}个
              </Text>
            </div>
            <div>
              <TeamOutlined style={{ marginRight: 8 }} />
              <Text type="secondary">角色：</Text>
              <Text>{(space.roles || []).length}个</Text>
            </div>
            <div>
              <ThunderboltOutlined style={{ marginRight: 8, color: '#52c41a' }} />
              <Text type="secondary">行动任务：</Text>
              <Text>{(space.action_tasks || []).length}个</Text>
            </div>
            <div>
              <CalendarOutlined style={{ marginRight: 8 }} />
              <Text type="secondary">创建于：</Text>
              <Text>
                {space.created_at ? new Date(space.created_at).toLocaleDateString() : '未知'}
              </Text>
            </div>
          </Space>
        </div>
      </div>
    </Card>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数，只在关键属性变化时重新渲染
  return (
    prevProps.space.id === nextProps.space.id &&
    prevProps.space.updated_at === nextProps.space.updated_at &&
    prevProps.space.tags?.length === nextProps.space.tags?.length
  );
});

ActionSpaceCard.displayName = 'ActionSpaceCard';

export default ActionSpaceCard;
```

---

### 6. 创建空间 Modal (CreateSpaceModal/index.js)

**职责**: 创建行动空间的表单 Modal

```javascript
// frontend/src/pages/actionspace/ActionSpaceOverview/components/CreateSpaceModal/index.js
import React, { useState } from 'react';
import { Modal, Form, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useActionSpaceActions } from '../../hooks/useActionSpaceActions';

import BasicInfoForm from './BasicInfoForm';
import BackgroundField from './BackgroundField';
import RulesField from './RulesField';
import TagSelector from './TagSelector';

const CreateSpaceModal = ({
  visible,
  onCancel,
  onSuccess,
  industryTags,
  scenarioTags
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { handleCreateSpace } = useActionSpaceActions(onSuccess);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const result = await handleCreateSpace(values);
      
      if (result.success) {
        form.resetFields();
        onSuccess();
      }
    } catch (error) {
      console.error('表单验证失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={t('actionSpace.createTitle')}
      open={visible}
      onCancel={handleCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={600}
    >
      <Form form={form} layout="vertical">
        <BasicInfoForm />
        
        <TagSelector
          industryTags={industryTags}
          scenarioTags={scenarioTags}
        />

        <BackgroundField form={form} />
        
        <RulesField form={form} />
      </Form>
    </Modal>
  );
};

export default CreateSpaceModal;
```

---

### 5. 标签筛选面板 (TagFilter.js) - 100行

**职责**: 显示和管理标签筛选

```javascript
// frontend/src/pages/actionspace/ActionSpaceOverview/TagFilter.js
import React from 'react';
import { Card, Tag, Button, Divider } from 'antd';

const TagFilter = ({ industryTags, scenarioTags, selectedTagIds, onTagClick, onClear }) => {
  return (
    <Card style={{ marginBottom: 16 }}>
      <h5>行业标签</h5>
      <div style={{ marginBottom: 16 }}>
        {industryTags.map(tag => (
          <Tag
            key={tag.id}
            color={selectedTagIds.includes(tag.id) ? tag.color : undefined}
            style={{
              cursor: 'pointer',
              border: selectedTagIds.includes(tag.id) ? 'none' : `1px solid ${tag.color}`
            }}
            onClick={() => onTagClick(tag.id)}
          >
            {tag.name}
          </Tag>
        ))}
      </div>

      <h5>场景标签</h5>
      <div style={{ marginBottom: 16 }}>
        {scenarioTags.map(tag => (
          <Tag
            key={tag.id}
            color={selectedTagIds.includes(tag.id) ? tag.color : undefined}
            style={{
              cursor: 'pointer',
              border: selectedTagIds.includes(tag.id) ? 'none' : `1px solid ${tag.color}`
            }}
            onClick={() => onTagClick(tag.id)}
          >
            {tag.name}
          </Tag>
        ))}
      </div>

      {selectedTagIds.length > 0 && (
        <Button type="link" onClick={onClear}>
          清除筛选
        </Button>
      )}
    </Card>
  );
};

export default TagFilter;
```

---

## 🚀 实施步骤 (简化版)

### 总时间: **1天** (8小时)

#### 上午 (4小时)
1. **创建目录和文件结构** (30分钟)
   ```bash
   mkdir frontend/src/pages/actionspace/ActionSpaceOverview
   cd ActionSpaceOverview
   touch index.js useActionSpaceData.js ActionSpaceCard.js CreateSpaceModal.js TagFilter.js
   ```

2. **提取数据Hook** (1小时)
   - [ ] 实现 `useActionSpaceData.js`
   - [ ] 测试数据获取

3. **拆分卡片组件** (1.5小时)
   - [ ] 实现 `ActionSpaceCard.js` (重点：React.memo优化)
   - [ ] 测试卡片渲染

4. **拆分标签筛选** (1小时)
   - [ ] 实现 `TagFilter.js`
   - [ ] 测试筛选功能

#### 下午 (4小时)
5. **拆分创建Modal** (2小时)
   - [ ] 实现 `CreateSpaceModal.js` (包含辅助生成)
   - [ ] 测试表单提交和辅助生成

6. **重构主组件** (1小时)
   - [ ] 实现新的 `index.js`
   - [ ] 整合所有子组件
   - [ ] 删除旧组件

7. **测试和优化** (1小时)
   - [ ] 功能测试：创建、删除、筛选、视图切换
   - [ ] 性能测试：使用 React DevTools Profiler
   - [ ] 代码审查

---

## 📊 预期收益

### 性能提升
- **组件渲染时间**: 减少 50-60%
- **首次加载**: 代码分割后按需加载
- **列表滚动**: 后续可轻松集成 react-window

### 代码质量
- **单文件行数**: 从 1345 行降到最大 200 行
- **可维护性**: 职责清晰，易于理解和修改
- **可测试性**: 每个 Hook 和组件都可独立测试
- **可复用性**: Hooks 和组件可在其他地方复用

### 开发效率
- **新功能添加**: 只需修改相关模块
- **Bug 修复**: 快速定位问题所在
- **团队协作**: 多人可同时开发不同模块

---

## ⚠️ 注意事项

1. **渐进式重构**: 保持原组件可用，新组件开发完成后再替换
2. **向后兼容**: 确保 API 调用和数据格式不变
3. **测试覆盖**: 每个阶段完成后都要测试
4. **代码审查**: 重大改动需要团队 review
5. **性能监控**: 使用 React DevTools Profiler 对比优化前后

---

## 📝 下一步

完成 ActionSpaceOverview 拆分后，按照同样的模式拆分：
1. ActionRules (1846行)
2. ActionTaskDetail (1454行)
3. ActionTaskConversation (2460行)
4. ModelConfigsPage (2508行)
5. RoleManagement (2835行)
