# 任务系统前端设计方案

## 一、页面结构设计

### 1.1 页面布局

```
应用布局
├── 知识库管理页面
│   ├── 文件列表
│   │   ├── [向量化] 按钮 → 提交任务 → 显示进度条
│   │   └── [批量向量化] → 提交批量任务 → 任务列表跳转
│   └── 任务状态浮窗（右下角通知）
│
├── 任务中心页面（新增）
│   ├── 任务列表
│   ├── 任务过滤（类型、状态）
│   └── 任务详情弹窗
│
└── 全局任务通知（右下角浮窗）
    ├── 运行中任务数量
    ├── 最近任务进度
    └── 点击进入任务中心
```

### 1.2 核心页面

#### （1）任务中心页面 `/tasks`
- 显示所有任务列表
- 支持按类型、状态筛选
- 点击任务查看详情
- 取消运行中的任务

#### （2）嵌入到业务页面的进度展示
- 知识库页面：向量化任务进度
- 行动空间页面：导出任务进度
- 变量管理页面：同步任务进度

#### （3）全局任务通知（固定右下角）
- 显示运行中任务数量
- 显示最近任务的进度条
- 任务完成/失败通知

---

## 二、组件设计

### 2.1 组件目录结构

```
frontend/src/components/tasks/
├── TaskCenter/
│   ├── TaskCenter.js              # 任务中心主页
│   ├── TaskList.js                # 任务列表
│   ├── TaskListItem.js            # 任务列表项
│   ├── TaskDetailModal.js         # 任务详情弹窗
│   └── TaskFilters.js             # 任务过滤器
│
├── TaskProgress/
│   ├── TaskProgressBar.js         # 进度条组件
│   ├── TaskProgressModal.js       # 进度弹窗（用于业务页面）
│   └── TaskStatusBadge.js         # 状态徽章
│
├── TaskNotification/
│   ├── TaskNotificationWidget.js  # 全局任务通知浮窗
│   └── TaskToast.js               # Toast 通知
│
└── hooks/
    ├── useTaskPolling.js          # 任务轮询 Hook
    ├── useTaskSubmit.js           # 任务提交 Hook
    └── useTaskList.js             # 任务列表 Hook
```

### 2.2 API 封装

```javascript
// frontend/src/services/api/tasks.js

import axios from './axios';

const tasksAPI = {
  /**
   * 提交任务
   */
  submitTask: async (taskType, params, options = {}) => {
    const response = await axios.post('/api/tasks', {
      task_type: taskType,
      params,
      priority: options.priority || 'medium',
      resources: options.resources,
      metadata: options.metadata
    });
    return response.data;
  },

  /**
   * 查询任务状态
   */
  getTaskStatus: async (taskId) => {
    const response = await axios.get(`/api/tasks/${taskId}`);
    return response.data;
  },

  /**
   * 查询任务列表
   */
  listTasks: async (filters = {}) => {
    const params = {
      task_type: filters.taskType,
      status: filters.status,
      offset: filters.offset || 0,
      limit: filters.limit || 20
    };
    const response = await axios.get('/api/tasks', { params });
    return response.data;
  },

  /**
   * 取消任务
   */
  cancelTask: async (taskId) => {
    const response = await axios.post(`/api/tasks/${taskId}/cancel`);
    return response.data;
  },

  /**
   * 获取任务统计
   */
  getTaskStats: async () => {
    const response = await axios.get('/api/tasks/stats');
    return response.data;
  }
};

export default tasksAPI;
```

---

## 三、核心组件实现

### 3.1 任务提交 Hook

```javascript
// frontend/src/components/tasks/hooks/useTaskSubmit.js

import { useState, useCallback } from 'react';
import tasksAPI from '@/services/api/tasks';
import { message } from 'antd';

export const useTaskSubmit = () => {
  const [submitting, setSubmitting] = useState(false);
  const [taskId, setTaskId] = useState(null);

  const submitTask = useCallback(async (taskType, params, options = {}) => {
    try {
      setSubmitting(true);
      
      const result = await tasksAPI.submitTask(taskType, params, options);
      
      setTaskId(result.task_id);
      
      // 可选：显示成功提示
      if (options.showMessage !== false) {
        message.success('任务已提交');
      }
      
      // 可选：回调
      if (options.onSuccess) {
        options.onSuccess(result.task_id);
      }
      
      return result.task_id;
      
    } catch (error) {
      console.error('提交任务失败:', error);
      message.error(error.response?.data?.error || '提交任务失败');
      
      if (options.onError) {
        options.onError(error);
      }
      
      throw error;
      
    } finally {
      setSubmitting(false);
    }
  }, []);

  return {
    submitTask,
    submitting,
    taskId
  };
};
```

### 3.2 任务轮询 Hook（实时进度）

```javascript
// frontend/src/components/tasks/hooks/useTaskPolling.js

import { useState, useEffect, useCallback, useRef } from 'react';
import tasksAPI from '@/services/api/tasks';

/**
 * 任务轮询 Hook
 * @param {string} taskId - 任务ID
 * @param {object} options - 配置选项
 */
export const useTaskPolling = (taskId, options = {}) => {
  const {
    interval = 2000,           // 轮询间隔（毫秒）
    enabled = true,            // 是否启用轮询
    onCompleted,               // 完成回调
    onFailed,                  // 失败回调
    onProgress,                // 进度更新回调
  } = options;

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);

  const fetchTask = useCallback(async () => {
    if (!taskId) return;

    try {
      const data = await tasksAPI.getTaskStatus(taskId);
      
      if (!mountedRef.current) return;
      
      setTask(data);
      setError(null);
      setLoading(false);

      // 触发进度回调
      if (onProgress) {
        onProgress(data);
      }

      // 检查任务是否结束
      if (data.status === 'completed') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        if (onCompleted) {
          onCompleted(data);
        }
      } else if (data.status === 'failed' || data.status === 'cancelled') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        if (onFailed) {
          onFailed(data);
        }
      }
      
    } catch (err) {
      console.error('获取任务状态失败:', err);
      if (!mountedRef.current) return;
      
      setError(err);
      setLoading(false);
    }
  }, [taskId, onProgress, onCompleted, onFailed]);

  useEffect(() => {
    mountedRef.current = true;
    
    if (!taskId || !enabled) {
      setLoading(false);
      return;
    }

    // 立即获取一次
    fetchTask();

    // 启动轮询
    intervalRef.current = setInterval(fetchTask, interval);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [taskId, enabled, interval, fetchTask]);

  const refresh = useCallback(() => {
    fetchTask();
  }, [fetchTask]);

  return {
    task,
    loading,
    error,
    refresh,
    // 便捷属性
    progress: task?.progress || 0,
    status: task?.status || 'pending',
    message: task?.message || '',
    isRunning: task?.status === 'running' || task?.status === 'pending',
    isCompleted: task?.status === 'completed',
    isFailed: task?.status === 'failed',
  };
};
```

### 3.3 进度条组件

```javascript
// frontend/src/components/tasks/TaskProgress/TaskProgressBar.js

import React from 'react';
import { Progress, Tag, Space, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  StopOutlined
} from '@ant-design/icons';

const { Text } = Typography;

// 状态配置
const STATUS_CONFIG = {
  pending: {
    label: '等待中',
    color: 'default',
    icon: <ClockCircleOutlined />,
    progressStatus: 'normal'
  },
  running: {
    label: '运行中',
    color: 'processing',
    icon: <LoadingOutlined />,
    progressStatus: 'active'
  },
  completed: {
    label: '已完成',
    color: 'success',
    icon: <CheckCircleOutlined />,
    progressStatus: 'success'
  },
  failed: {
    label: '失败',
    color: 'error',
    icon: <CloseCircleOutlined />,
    progressStatus: 'exception'
  },
  cancelled: {
    label: '已取消',
    color: 'default',
    icon: <StopOutlined />,
    progressStatus: 'exception'
  },
  retrying: {
    label: '重试中',
    color: 'warning',
    icon: <LoadingOutlined />,
    progressStatus: 'active'
  }
};

const TaskProgressBar = ({ 
  task, 
  showStatus = true, 
  showMessage = true,
  size = 'default'  // default | small | large
}) => {
  if (!task) return null;

  const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const progress = task.progress || 0;

  return (
    <div className="task-progress-bar">
      {/* 状态标签 */}
      {showStatus && (
        <div style={{ marginBottom: 8 }}>
          <Space>
            <Tag icon={config.icon} color={config.color}>
              {config.label}
            </Tag>
            {task.retry_count > 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                重试 {task.retry_count}/{task.max_retries}
              </Text>
            )}
          </Space>
        </div>
      )}

      {/* 进度条 */}
      <Progress
        percent={progress}
        status={config.progressStatus}
        size={size}
        strokeColor={
          task.status === 'running' || task.status === 'retrying'
            ? { '0%': '#108ee9', '100%': '#87d068' }
            : undefined
        }
      />

      {/* 进度消息 */}
      {showMessage && task.message && (
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {task.message}
          </Text>
        </div>
      )}
    </div>
  );
};

export default TaskProgressBar;
```

### 3.4 进度弹窗组件（嵌入业务页面）

```javascript
// frontend/src/components/tasks/TaskProgress/TaskProgressModal.js

import React, { useState } from 'react';
import { Modal, Button, Space, Timeline, Typography, Divider } from 'antd';
import { useTaskPolling } from '../hooks/useTaskPolling';
import TaskProgressBar from './TaskProgressBar';
import tasksAPI from '@/services/api/tasks';

const { Text, Paragraph } = Typography;

const TaskProgressModal = ({ 
  taskId, 
  visible, 
  onClose,
  title = '任务进度',
  onCompleted,
  onFailed
}) => {
  const [cancelling, setCancelling] = useState(false);

  const { task, loading, isRunning, isCompleted, isFailed } = useTaskPolling(taskId, {
    enabled: visible && !!taskId,
    onCompleted: (data) => {
      if (onCompleted) onCompleted(data);
    },
    onFailed: (data) => {
      if (onFailed) onFailed(data);
    }
  });

  const handleCancel = async () => {
    try {
      setCancelling(true);
      await tasksAPI.cancelTask(taskId);
      Modal.success({
        title: '任务已取消',
        content: '任务取消成功'
      });
    } catch (error) {
      Modal.error({
        title: '取消失败',
        content: error.response?.data?.error || '取消任务失败'
      });
    } finally {
      setCancelling(false);
    }
  };

  const handleClose = () => {
    // 只有在任务完成或失败时才允许关闭
    if (isCompleted || isFailed || !isRunning) {
      onClose();
    } else {
      Modal.confirm({
        title: '任务还在运行',
        content: '任务正在后台运行，关闭窗口后仍会继续执行。确定关闭吗？',
        onOk: onClose
      });
    }
  };

  return (
    <Modal
      title={title}
      open={visible}
      onCancel={handleClose}
      footer={
        <Space>
          {isRunning && (
            <Button 
              danger 
              onClick={handleCancel}
              loading={cancelling}
            >
              取消任务
            </Button>
          )}
          <Button onClick={handleClose}>
            {isCompleted || isFailed ? '关闭' : '后台运行'}
          </Button>
        </Space>
      }
      width={600}
      closable={!isRunning}
      maskClosable={false}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          加载中...
        </div>
      ) : task ? (
        <div>
          {/* 进度条 */}
          <TaskProgressBar task={task} showStatus showMessage />

          <Divider />

          {/* 任务信息 */}
          <div style={{ marginBottom: 16 }}>
            <Text strong>任务类型：</Text>
            <Text>{task.task_type}</Text>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text strong>创建时间：</Text>
            <Text>{new Date(task.created_at).toLocaleString()}</Text>
          </div>

          {task.started_at && (
            <div style={{ marginBottom: 16 }}>
              <Text strong>开始时间：</Text>
              <Text>{new Date(task.started_at).toLocaleString()}</Text>
            </div>
          )}

          {task.completed_at && (
            <div style={{ marginBottom: 16 }}>
              <Text strong>完成时间：</Text>
              <Text>{new Date(task.completed_at).toLocaleString()}</Text>
            </div>
          )}

          {/* 错误信息 */}
          {task.error && (
            <div style={{ marginBottom: 16 }}>
              <Text strong type="danger">错误信息：</Text>
              <Paragraph type="danger" style={{ marginTop: 8 }}>
                {task.error}
              </Paragraph>
            </div>
          )}

          {/* 任务结果 */}
          {task.result && (
            <div style={{ marginBottom: 16 }}>
              <Text strong type="success">任务结果：</Text>
              <Paragraph style={{ marginTop: 8 }}>
                <pre style={{ 
                  background: '#f5f5f5', 
                  padding: 12, 
                  borderRadius: 4,
                  fontSize: 12
                }}>
                  {JSON.stringify(task.result, null, 2)}
                </pre>
              </Paragraph>
            </div>
          )}

          {/* 执行日志 */}
          {task.logs && task.logs.length > 0 && (
            <div>
              <Text strong>执行日志：</Text>
              <Timeline style={{ marginTop: 16 }}>
                {task.logs.map((log, index) => (
                  <Timeline.Item 
                    key={index}
                    color={
                      log.level === 'ERROR' ? 'red' :
                      log.level === 'WARNING' ? 'orange' :
                      'blue'
                    }
                  >
                    <Text style={{ fontSize: 12 }} type="secondary">
                      {new Date(log.time).toLocaleTimeString()}
                    </Text>
                    <br />
                    <Text style={{ fontSize: 13 }}>
                      {log.message}
                    </Text>
                  </Timeline.Item>
                ))}
              </Timeline>
            </div>
          )}
        </div>
      ) : (
        <div>任务不存在</div>
      )}
    </Modal>
  );
};

export default TaskProgressModal;
```

### 3.5 全局任务通知浮窗

```javascript
// frontend/src/components/tasks/TaskNotification/TaskNotificationWidget.js

import React, { useState, useEffect } from 'react';
import { Badge, Card, Progress, Typography, Space, Button } from 'antd';
import { BellOutlined, CloseOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import tasksAPI from '@/services/api/tasks';
import './TaskNotificationWidget.css';

const { Text } = Typography;

const TaskNotificationWidget = () => {
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState(null);
  const [runningTasks, setRunningTasks] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    // 每 5 秒刷新一次
    const fetchStats = async () => {
      try {
        const [statsData, tasksData] = await Promise.all([
          tasksAPI.getTaskStats(),
          tasksAPI.listTasks({ status: 'running', limit: 3 })
        ]);
        setStats(statsData);
        setRunningTasks(tasksData.tasks || []);
      } catch (error) {
        console.error('获取任务统计失败:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);

    return () => clearInterval(interval);
  }, []);

  const runningCount = stats?.running || 0;

  if (!stats || runningCount === 0) {
    return null; // 没有运行中的任务时不显示
  }

  return (
    <div className="task-notification-widget">
      {/* 主按钮 */}
      <Badge count={runningCount} offset={[-5, 5]}>
        <Button
          type="primary"
          shape="circle"
          icon={<BellOutlined />}
          size="large"
          onClick={() => setVisible(!visible)}
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
        />
      </Badge>

      {/* 悬浮卡片 */}
      {visible && (
        <Card
          title={
            <Space>
              <BellOutlined />
              <span>运行中的任务 ({runningCount})</span>
            </Space>
          }
          extra={
            <CloseOutlined onClick={() => setVisible(false)} />
          }
          style={{
            position: 'fixed',
            right: 24,
            bottom: 90,
            width: 360,
            maxHeight: 400,
            overflow: 'auto',
            zIndex: 1001,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
          bodyStyle={{ padding: 12 }}
        >
          {runningTasks.length > 0 ? (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {runningTasks.map(task => (
                <div key={task.task_id} style={{ 
                  padding: 12, 
                  background: '#f5f5f5', 
                  borderRadius: 4 
                }}>
                  <Text strong style={{ fontSize: 13 }}>
                    {getTaskTypeName(task.task_type)}
                  </Text>
                  <Progress 
                    percent={task.progress} 
                    size="small" 
                    status="active"
                    style={{ marginTop: 8, marginBottom: 4 }}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {task.message}
                  </Text>
                </div>
              ))}
              
              <Button 
                type="link" 
                block
                onClick={() => {
                  setVisible(false);
                  navigate('/tasks');
                }}
              >
                查看所有任务 →
              </Button>
            </Space>
          ) : (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <Text type="secondary">暂无运行中的任务</Text>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

// 辅助函数：任务类型名称映射
const getTaskTypeName = (taskType) => {
  const names = {
    'kb:vectorize_file': '文件向量化',
    'kb:vectorize_batch': '批量向量化',
    'kb:chunk': '文档分段',
    'var:sync_external': '变量同步',
    'data:export_actionspace': '导出行动空间',
  };
  return names[taskType] || taskType;
};

export default TaskNotificationWidget;
```

---

## 四、业务集成示例

### 4.1 知识库页面集成（向量化按钮）

```javascript
// frontend/src/pages/knowledgebase/DocumentManager.js

import React, { useState } from 'react';
import { Button, Table, message } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useTaskSubmit } from '@/components/tasks/hooks/useTaskSubmit';
import TaskProgressModal from '@/components/tasks/TaskProgress/TaskProgressModal';

const DocumentManager = ({ knowledgeId }) => {
  const [documents, setDocuments] = useState([]);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  
  const { submitTask, submitting } = useTaskSubmit();

  // 单文件向量化
  const handleVectorize = async (document) => {
    try {
      const taskId = await submitTask(
        'kb:vectorize_file',
        {
          knowledge_id: knowledgeId,
          file_path: document.file_path,
          embedding_model_id: 5  // 默认模型
        },
        {
          priority: 'high',
          resources: {
            knowledge_id: knowledgeId
          }
        }
      );

      // 显示进度弹窗
      setCurrentTaskId(taskId);
      setProgressModalVisible(true);

    } catch (error) {
      // 错误已在 Hook 中处理
    }
  };

  // 批量向量化
  const handleBatchVectorize = async (selectedDocuments) => {
    const filePaths = selectedDocuments.map(doc => doc.file_path);
    
    try {
      const taskId = await submitTask(
        'kb:vectorize_batch',
        {
          knowledge_id: knowledgeId,
          file_paths: filePaths
        },
        {
          priority: 'medium',
          resources: {
            knowledge_id: knowledgeId
          }
        }
      );

      message.success(`已提交 ${filePaths.length} 个文件的向量化任务`);
      setCurrentTaskId(taskId);
      setProgressModalVisible(true);

    } catch (error) {
      // 错误已在 Hook 中处理
    }
  };

  const columns = [
    {
      title: '文件名',
      dataIndex: 'file_name',
      key: 'file_name',
    },
    {
      title: '状态',
      dataIndex: 'embedding_status',
      key: 'embedding_status',
      render: (status) => {
        const statusMap = {
          'not_started': '未向量化',
          'completed': '已完成',
          'failed': '失败'
        };
        return statusMap[status] || status;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<ThunderboltOutlined />}
          onClick={() => handleVectorize(record)}
          loading={submitting}
          disabled={record.embedding_status === 'completed'}
        >
          向量化
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Table
        columns={columns}
        dataSource={documents}
        rowKey="id"
      />

      {/* 进度弹窗 */}
      <TaskProgressModal
        taskId={currentTaskId}
        visible={progressModalVisible}
        onClose={() => setProgressModalVisible(false)}
        title="文件向量化进度"
        onCompleted={(task) => {
          message.success('向量化完成！');
          // 刷新文档列表
          // fetchDocuments();
        }}
        onFailed={(task) => {
          message.error('向量化失败: ' + task.error);
        }}
      />
    </div>
  );
};

export default DocumentManager;
```

### 4.2 任务中心页面

```javascript
// frontend/src/pages/tasks/TaskCenter.js

import React, { useState } from 'react';
import { 
  Table, 
  Tag, 
  Button, 
  Space, 
  Select, 
  Progress,
  Modal 
} from 'antd';
import { ReloadOutlined, EyeOutlined, StopOutlined } from '@ant-design/icons';
import { useTaskList } from '@/components/tasks/hooks/useTaskList';
import TaskProgressModal from '@/components/tasks/TaskProgress/TaskProgressModal';
import tasksAPI from '@/services/api/tasks';

const { Option } = Select;

const TaskCenter = () => {
  const [filters, setFilters] = useState({
    task_type: undefined,
    status: undefined
  });
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const { tasks, loading, pagination, refresh } = useTaskList(filters);

  const handleCancel = async (taskId) => {
    Modal.confirm({
      title: '确认取消任务？',
      content: '取消后任务将停止执行',
      onOk: async () => {
        try {
          await tasksAPI.cancelTask(taskId);
          message.success('任务已取消');
          refresh();
        } catch (error) {
          message.error('取消失败');
        }
      }
    });
  };

  const columns = [
    {
      title: '任务类型',
      dataIndex: 'task_type',
      key: 'task_type',
      width: 180,
      render: (type) => getTaskTypeName(type)
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusConfig = {
          pending: { color: 'default', text: '等待中' },
          running: { color: 'processing', text: '运行中' },
          completed: { color: 'success', text: '已完成' },
          failed: { color: 'error', text: '失败' },
          cancelled: { color: 'default', text: '已取消' },
        };
        const config = statusConfig[status] || {};
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 150,
      render: (progress, record) => {
        if (record.status === 'completed') {
          return <Progress percent={100} size="small" status="success" />;
        }
        if (record.status === 'failed' || record.status === 'cancelled') {
          return <Progress percent={progress} size="small" status="exception" />;
        }
        return <Progress percent={progress} size="small" status="active" />;
      }
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time) => new Date(time).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedTaskId(record.task_id);
              setDetailVisible(true);
            }}
          >
            详情
          </Button>
          {(record.status === 'running' || record.status === 'pending') && (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => handleCancel(record.task_id)}
            >
              取消
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>任务中心</h2>

      {/* 过滤器 */}
      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="任务类型"
          style={{ width: 200 }}
          allowClear
          value={filters.task_type}
          onChange={(value) => setFilters({ ...filters, task_type: value })}
        >
          <Option value="kb:vectorize_file">文件向量化</Option>
          <Option value="kb:vectorize_batch">批量向量化</Option>
          <Option value="var:sync_external">变量同步</Option>
        </Select>

        <Select
          placeholder="状态"
          style={{ width: 150 }}
          allowClear
          value={filters.status}
          onChange={(value) => setFilters({ ...filters, status: value })}
        >
          <Option value="pending">等待中</Option>
          <Option value="running">运行中</Option>
          <Option value="completed">已完成</Option>
          <Option value="failed">失败</Option>
        </Select>

        <Button icon={<ReloadOutlined />} onClick={refresh}>
          刷新
        </Button>
      </Space>

      {/* 任务列表 */}
      <Table
        columns={columns}
        dataSource={tasks}
        rowKey="task_id"
        loading={loading}
        pagination={pagination}
      />

      {/* 详情弹窗 */}
      <TaskProgressModal
        taskId={selectedTaskId}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        title="任务详情"
      />
    </div>
  );
};

// 辅助函数
const getTaskTypeName = (taskType) => {
  const names = {
    'kb:vectorize_file': '文件向量化',
    'kb:vectorize_batch': '批量向量化',
    'kb:chunk': '文档分段',
    'var:sync_external': '变量同步',
    'data:export_actionspace': '导出行动空间',
  };
  return names[taskType] || taskType;
};

export default TaskCenter;
```

### 4.3 任务列表 Hook

```javascript
// frontend/src/components/tasks/hooks/useTaskList.js

import { useState, useEffect, useCallback } from 'react';
import tasksAPI from '@/services/api/tasks';

export const useTaskList = (filters = {}, options = {}) => {
  const {
    autoRefresh = true,
    refreshInterval = 5000  // 5秒自动刷新
  } = options;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await tasksAPI.listTasks({
        ...filters,
        offset: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize
      });

      setTasks(data.tasks);
      setPagination(prev => ({
        ...prev,
        total: data.total
      }));
    } catch (error) {
      console.error('获取任务列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.current, pagination.pageSize]);

  useEffect(() => {
    fetchTasks();

    if (!autoRefresh) return;

    const interval = setInterval(fetchTasks, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchTasks, autoRefresh, refreshInterval]);

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  return {
    tasks,
    loading,
    pagination: {
      ...pagination,
      onChange: (page, pageSize) => {
        setPagination(prev => ({ ...prev, current: page, pageSize }));
      }
    },
    refresh: fetchTasks
  };
};
```

---

## 五、样式文件

```css
/* frontend/src/components/tasks/TaskNotification/TaskNotificationWidget.css */

.task-notification-widget .ant-card {
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.task-notification-widget .ant-card-head {
  background: #f0f2f5;
  border-bottom: 1px solid #d9d9d9;
}

.task-progress-bar {
  width: 100%;
}
```

---

## 六、路由配置

```javascript
// frontend/src/App.js 或路由配置文件

import TaskCenter from '@/pages/tasks/TaskCenter';

// 添加路由
{
  path: '/tasks',
  element: <TaskCenter />,
  meta: { title: '任务中心' }
}
```

---

## 七、在主布局中添加全局通知

```javascript
// frontend/src/components/layout/MainLayout.js

import React from 'react';
import { Layout } from 'antd';
import TaskNotificationWidget from '@/components/tasks/TaskNotification/TaskNotificationWidget';

const MainLayout = ({ children }) => {
  return (
    <Layout>
      {/* 其他布局组件 */}
      {children}
      
      {/* 全局任务通知浮窗 */}
      <TaskNotificationWidget />
    </Layout>
  );
};

export default MainLayout;
```

---

## 八、使用流程总结

### 8.1 提交任务
```javascript
const { submitTask } = useTaskSubmit();

const taskId = await submitTask(
  'kb:vectorize_file',
  { knowledge_id: 'kb_123', file_path: 'doc.pdf' },
  { priority: 'high' }
);
```

### 8.2 监听进度
```javascript
const { task, progress, isCompleted } = useTaskPolling(taskId, {
  onCompleted: (task) => {
    message.success('任务完成！');
  }
});
```

### 8.3 显示进度弹窗
```javascript
<TaskProgressModal
  taskId={taskId}
  visible={visible}
  onClose={() => setVisible(false)}
/>
```

### 8.4 查看任务列表
```javascript
const { tasks, loading, refresh } = useTaskList({
  status: 'running'
});
```

---

## 九、最佳实践

1. **任务提交后立即显示进度**
   - 提交成功后打开进度弹窗
   - 用户可以关闭弹窗，任务继续后台运行

2. **全局通知提示**
   - 右下角浮窗显示运行中任务数量
   - 点击可快速查看进度

3. **支持批量操作**
   - 批量提交任务
   - 显示整体进度

4. **错误处理友好**
   - 失败后显示详细错误信息
   - 支持重试

5. **性能优化**
   - 轮询间隔可配置（默认 2 秒）
   - 只在页面可见时轮询
   - 任务完成后停止轮询

---

**前端设计完成！** 🎉

这个设计的核心特点：
- ✅ 组件化：可复用的 Hook 和组件
- ✅ 实时更新：轮询机制保证进度实时显示
- ✅ 用户友好：进度条、日志、错误提示
- ✅ 灵活集成：可嵌入任何业务页面

要不要我帮你开始实现代码？
