import React, { useState } from 'react';
import { Drawer, Modal, Button, Space, Progress, Tag, Timeline, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  StopOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useJobPolling } from '../../hooks/useJobPolling';
import jobsAPI from '../../services/api/jobs';

const { Text, Paragraph } = Typography;

const JobProgressDrawer = ({ 
  jobId, 
  open, 
  onClose,
  title,
  onCompleted,
  onFailed
}) => {
  const { t } = useTranslation();
  const [cancelling, setCancelling] = useState(false);

  const STATUS_CONFIG = {
    pending: { label: t('jobs.status.pending'), color: 'default', icon: <ClockCircleOutlined /> },
    running: { label: t('jobs.status.running'), color: 'processing', icon: <LoadingOutlined /> },
    completed: { label: t('jobs.status.completed'), color: 'success', icon: <CheckCircleOutlined /> },
    failed: { label: t('jobs.status.failed'), color: 'error', icon: <CloseCircleOutlined /> },
    cancelled: { label: t('jobs.status.cancelled'), color: 'default', icon: <StopOutlined /> },
    retrying: { label: t('jobs.status.retrying'), color: 'warning', icon: <LoadingOutlined /> },
  };

  const { job, loading, isRunning, isCompleted, isFailed } = useJobPolling(jobId, {
    enabled: open && !!jobId,
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
      await jobsAPI.cancelJob(jobId);
      Modal.success({
        title: t('jobs.msg.cancelSuccess'),
        content: t('jobs.msg.cancelTaskSuccess')
      });
    } catch (error) {
      Modal.error({
        title: t('jobs.btn.cancel'),
        content: error.response?.data?.error || t('jobs.msg.cancelTaskFailed')
      });
    } finally {
      setCancelling(false);
    }
  };

  const handleClose = () => {
    if (isCompleted || isFailed || !isRunning) {
      onClose();
    } else {
      Modal.confirm({
        title: t('jobs.msg.stillRunning'),
        content: t('jobs.msg.stillRunningContent'),
        onOk: onClose
      });
    }
  };

  if (!job && !loading) {
    return null;
  }

  const config = STATUS_CONFIG[job?.status] || STATUS_CONFIG.pending;

  return (
    <Drawer
      title={title || t('jobs.progress')}
      open={open}
      onClose={handleClose}
      size="large"
      closable={true}
      maskClosable={false}
      zIndex={1050}
      extra={
        <Space>
          {isRunning && (
            <Button 
              danger 
              onClick={handleCancel}
              loading={cancelling}
            >
              {t('jobs.btn.cancelTask')}
            </Button>
          )}
          <Button onClick={handleClose}>
            {isCompleted || isFailed ? t('jobs.btn.close') : t('jobs.btn.background')}
          </Button>
        </Space>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <LoadingOutlined style={{ fontSize: 24 }} />
          <div style={{ marginTop: 16 }}>{t('jobs.detail.loading')}</div>
        </div>
      ) : job ? (
        <div>
          {/* 状态标签 */}
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Tag icon={config.icon} color={config.color}>
                {config.label}
              </Tag>
              {job.retry_count > 0 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('jobs.detail.retry', { count: job.retry_count, max: job.max_retries })}
                </Text>
              )}
            </Space>
          </div>

          {/* 进度条 */}
          <Progress
            percent={job.progress || 0}
            status={
              job.status === 'completed' ? 'success' :
              job.status === 'failed' ? 'exception' :
              'active'
            }
            strokeColor={
              isRunning ? { '0%': '#108ee9', '100%': '#87d068' } : undefined
            }
          />

          {/* 进度消息或错误信息 */}
          {job.status === 'failed' ? (
            // 失败状态：优先显示错误信息
            job.error && (
              <div style={{ marginTop: 8, marginBottom: 16 }}>
                <Text strong type="danger">{t('jobs.detail.errorLabel')}</Text>
                <Paragraph type="danger" style={{ marginTop: 8 }}>
                  {job.error}
                </Paragraph>
              </div>
            )
          ) : (
            // 其他状态：显示进度消息
            job.message && (
              <div style={{ marginTop: 8, marginBottom: 16 }}>
                <Text type="secondary">{job.message}</Text>
              </div>
            )
          )}

          {/* 任务结果 */}
          {job.result && (
            <div style={{ marginBottom: 16 }}>
              <Text strong type="success">{t('jobs.detail.resultLabel')}</Text>
              <Paragraph style={{ marginTop: 8 }}>
                <pre style={{ 
                  background: 'var(--custom-hover-bg)', 
                  padding: 12, 
                  borderRadius: 4,
                  fontSize: 12,
                  maxHeight: 200,
                  overflow: 'auto'
                }}>
                  {JSON.stringify(job.result, null, 2)}
                </pre>
              </Paragraph>
            </div>
          )}

          {/* 执行日志 */}
          {job.logs && job.logs.length > 0 && (
            <div>
              <Text strong>{t('jobs.detail.logsLabel')}</Text>
              <Timeline 
                style={{ 
                  marginTop: 16, 
                  maxHeight: 'calc(100vh - 450px)', 
                  minHeight: 300,
                  overflow: 'auto' 
                }}
                items={job.logs.map((log, index) => ({
                  color: log.level === 'ERROR' ? 'red' :
                         log.level === 'WARNING' ? 'orange' :
                         'blue',
                  children: (
                    <>
                      <Text style={{ fontSize: 12 }} type="secondary">
                        {new Date(log.time).toLocaleTimeString()}
                      </Text>
                      <br />
                      <Text style={{ fontSize: 13 }}>
                        {log.message}
                      </Text>
                    </>
                  )
                }))}
              />
            </div>
          )}
        </div>
      ) : (
        <div>{t('jobs.detail.notFound')}</div>
      )}
    </Drawer>
  );
};

export default JobProgressDrawer;
