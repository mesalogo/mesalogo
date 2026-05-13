/**
 * 后台任务中心 Drawer
 * 
 * 显示所有后台任务列表，支持过滤、查看详情、取消任务
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Drawer,
  Modal,
  Table, 
  Tag, 
  Button, 
  Space, 
  Select, 
  Progress, 
  Empty,
  Tooltip,
  message,
  Statistic,
  Row,
  Col,
  Card
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import jobsAPI from '../../services/api/jobs';
import JobProgressDrawer from './JobProgressDrawer';

const { Option } = Select;

const JobCenterDrawer = ({ open, onClose }) => {
  const { t } = useTranslation();

  // 状态配置（在组件内，以便使用 t()）
  const STATUS_CONFIG = {
    pending: { label: t('jobs.status.pending'), color: 'default', icon: <ClockCircleOutlined /> },
    running: { label: t('jobs.status.running'), color: 'processing', icon: <LoadingOutlined /> },
    completed: { label: t('jobs.status.completed'), color: 'success', icon: <CheckCircleOutlined /> },
    failed: { label: t('jobs.status.failed'), color: 'error', icon: <CloseCircleOutlined /> },
    cancelled: { label: t('jobs.status.cancelled'), color: 'default', icon: <StopOutlined /> },
    retrying: { label: t('jobs.status.retrying'), color: 'warning', icon: <LoadingOutlined /> },
  };

  // 任务类型映射
  const TASK_TYPE_NAMES = {
    'kb:convert_file': t('jobs.type.convertFile'),
    'kb:chunk_file': t('jobs.type.chunkFile'),
    'kb:embed_file': t('jobs.type.embedFile'),
    'kb:vectorize_file': t('jobs.type.vectorizeFile'),
    'kb:vectorize_batch': t('jobs.type.vectorizeBatch'),
    'kb:process_file_pipeline': t('jobs.type.processFilePipeline'),
    'kb:chunk': t('jobs.type.chunk'),
    'var:sync_external': t('jobs.type.syncExternal'),
    'data:export_actionspace': t('jobs.type.exportActionspace'),
  };
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    jobType: undefined,
    status: undefined
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [stats, setStats] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // 获取后台任务列表
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const result = await jobsAPI.listJobs({
        jobType: filters.jobType,
        status: filters.status,
        offset: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize
      });

      setTasks(result.jobs || []);
      setPagination(prev => ({
        ...prev,
        total: result.total || 0
      }));
    } catch (error) {
      console.error('获取后台任务列表失败:', error);
      message.error(t('jobs.msg.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.current, pagination.pageSize]);

  // 获取任务统计
  const fetchStats = useCallback(async () => {
    try {
      const result = await jobsAPI.getStats();
      setStats(result);
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  }, []);

  // 当 Drawer 打开时，获取数据
  useEffect(() => {
    if (open) {
      fetchTasks();
      fetchStats();
      
      // 定时刷新（30秒）
      // Job抽屉是辅助监控面板，降低刷新频率减少服务器压力
      const interval = setInterval(() => {
        fetchTasks();
        fetchStats();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [open, fetchTasks, fetchStats]);

  // 取消任务
  const handleCancel = async (jobId) => {
    Modal.confirm({
      title: t('jobs.msg.cancelConfirmTitle'),
      content: t('jobs.msg.cancelConfirmContent'),
      onOk: async () => {
        try {
          await jobsAPI.cancelJob(jobId);
          message.success(t('jobs.msg.cancelSuccess'));
          fetchTasks();
        } catch (error) {
          message.error(t('jobs.msg.cancelFailed', { error: error.response?.data?.error || error.message }));
        }
      }
    });
  };

  // 查看详情
  const handleViewDetail = (jobId) => {
    setSelectedTaskId(jobId);
    setDetailVisible(true);
  };

  // 表格列定义
  const columns = [
    {
      title: t('jobs.column.taskType'),
      dataIndex: 'job_type',
      key: 'job_type',
      width: 150,
      render: (type) => TASK_TYPE_NAMES[type] || type
    },
    {
      title: t('jobs.column.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
        return (
          <Tag icon={config.icon} color={config.color}>
            {config.label}
          </Tag>
        );
      }
    },
    {
      title: t('jobs.column.progress'),
      dataIndex: 'progress',
      key: 'progress',
      width: 150,
      render: (progress, record) => {
        const status = record.status === 'completed' ? 'success' :
                      record.status === 'failed' ? 'exception' :
                      'active';
        return <Progress percent={progress || 0} status={status} />;
      }
    },
    {
      title: t('jobs.column.message'),
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (text, record) => {
        // 失败状态显示error，其他状态显示message
        const displayText = record.status === 'failed' ? (record.error || text) : text;
        
        return (
          <Tooltip title={displayText}>
            <span>{displayText}</span>
          </Tooltip>
        );
      }
    },
    {
      title: t('jobs.column.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time) => {
        if (!time) return '-';
        const date = new Date(time);
        return date.toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    },
    {
      title: t('jobs.column.actions'),
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Button
           
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.job_id)}
          >
            {t('jobs.btn.detail')}
          </Button>
          {(record.status === 'running' || record.status === 'pending') && (
            <Button
             
              type="link"
              danger
              icon={<StopOutlined />}
              onClick={() => handleCancel(record.job_id)}
            >
              {t('jobs.btn.cancel')}
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <>
      <Drawer
        title={t('jobs.center')}
        open={open}
        onClose={onClose}
        size="large"
        destroyOnHidden
      >
        {/* 统计信息 */}
        {stats && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={4}>
              <Card>
                <Statistic title={t('jobs.stat.total')} value={stats.total} />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic 
                  title={t('jobs.stat.pending')}
                  value={stats.pending}
                  styles={{ content: { color: '#faad14' } }}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic 
                  title={t('jobs.stat.running')}
                  value={stats.running}
                  styles={{ content: { color: '#1677ff' } }}
                  prefix={<LoadingOutlined />}
                />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic 
                  title={t('jobs.stat.completed')}
                  value={stats.completed}
                  styles={{ content: { color: '#52c41a' } }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic 
                  title={t('jobs.stat.failed')}
                  value={stats.failed}
                  styles={{ content: { color: '#ff4d4f' } }}
                  prefix={<CloseCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* 过滤器 */}
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder={t('jobs.placeholder.taskType')}
            style={{ width: 200 }}
            allowClear
            value={filters.jobType}
            onChange={(value) => {
              setFilters({ ...filters, jobType: value });
              setPagination({ ...pagination, current: 1 });
            }}
          >
            <Option value="kb:convert_file">{t('jobs.type.convertFile')}</Option>
            <Option value="kb:chunk_file">{t('jobs.type.chunkFile')}</Option>
            <Option value="kb:embed_file">{t('jobs.type.embedFile')}</Option>
            <Option value="kb:vectorize_file">{t('jobs.type.vectorizeFile')}</Option>
            <Option value="kb:vectorize_batch">{t('jobs.type.vectorizeBatch')}</Option>
            <Option value="kb:process_file_pipeline">{t('jobs.type.processFilePipeline')}</Option>
            <Option value="kb:chunk">{t('jobs.type.chunk')}</Option>
            <Option value="var:sync_external">{t('jobs.type.syncExternal')}</Option>
          </Select>

          <Select
            placeholder={t('jobs.placeholder.status')}
            style={{ width: 120 }}
            allowClear
            value={filters.status}
            onChange={(value) => {
              setFilters({ ...filters, status: value });
              setPagination({ ...pagination, current: 1 });
            }}
          >
            <Option value="pending">{t('jobs.status.pending')}</Option>
            <Option value="running">{t('jobs.status.running')}</Option>
            <Option value="completed">{t('jobs.status.completed')}</Option>
            <Option value="failed">{t('jobs.status.failed')}</Option>
          </Select>

          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => {
              fetchTasks();
              fetchStats();
            }}
          >
            {t('refresh')}
          </Button>
        </Space>

        {/* 后台任务列表 */}
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="job_id"
          loading={loading}
          pagination={{
            ...pagination,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize });
            },
            showSizeChanger: true,
            showTotal: (total) => t('jobs.total', { total })
          }}
          locale={{
            emptyText: <Empty description={t('jobs.empty')} />
          }}
          scroll={{ x: 800 }}
         
        />
      </Drawer>

      {/* 任务详情弹窗 */}
      {detailVisible && (
        <JobProgressDrawer
          jobId={selectedTaskId}
          open={detailVisible}
          onClose={() => {
            setDetailVisible(false);
            fetchTasks(); // 关闭详情后刷新列表
          }}
          title={t('jobs.detail')}
          onCompleted={() => fetchTasks()}
          onFailed={() => fetchTasks()}
        />
      )}
    </>
  );
};

export default JobCenterDrawer;
