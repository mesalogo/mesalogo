import React from 'react';
import { Modal, Button, Steps } from 'antd';
import {
  SettingOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

/**
 * 获取测试步骤定义
 */
export const getTestSteps = (t) => [
  {
    title: t ? t('vectorDB.test.configValidation') : '配置验证',
    description: t ? t('vectorDB.test.configValidation.desc') : '验证向量数据库配置参数',
    icon: <SettingOutlined />,
    key: 'config_validation'
  },
  {
    title: t ? t('vectorDB.test.connectionTest') : '连接测试',
    description: t ? t('vectorDB.test.connectionTest.desc') : '测试数据库连接是否正常',
    icon: <LoadingOutlined />,
    key: 'connection_test'
  },
  {
    title: t ? t('vectorDB.test.vectorOperations') : '向量操作',
    description: t ? t('vectorDB.test.vectorOperations.desc') : '测试向量存储和搜索功能',
    icon: <CheckCircleOutlined />,
    key: 'vector_operations'
  }
];

/**
 * 显示测试详情Modal
 */
export const showDetailedTestResult = (providerDisplayName, result, t) => {
  const { info } = result;

  if (!info || !info.test_levels) {
    return;
  }

  const { test_levels, embedding_model, performance_metrics } = info;

  // Build detailed information content
  let detailContent = [];

  // Layered test results
  detailContent.push('📋 ' + t('vectorDB.test.layeredResults') + ':');

  const levels = [
    { key: 'config_validation', name: '配置验证', icon: '⚙️' },
    { key: 'connection_test', name: '连接测试', icon: '🔗' },
    { key: 'vector_operations', name: '向量操作', icon: '🔍' }
  ];

  levels.forEach(level => {
    const levelResult = test_levels[level.key];
    if (levelResult) {
      const status = levelResult.passed ? '✅' : '❌';
      detailContent.push(`  ${level.icon} ${level.name}: ${status} ${levelResult.message}`);
    }
  });

  // 嵌入模型信息
  if (embedding_model) {
    detailContent.push('');
    detailContent.push('🤖 嵌入模型信息:');
    detailContent.push(`  模型名称: ${embedding_model.name}`);
    detailContent.push(`  提供商: ${embedding_model.provider}`);
  }

  // 性能指标
  if (performance_metrics && Object.keys(performance_metrics).length > 0) {
    detailContent.push('');
    detailContent.push('📊 性能指标:');

    if (performance_metrics.vector_dimension) {
      detailContent.push(`  向量维度: ${performance_metrics.vector_dimension}`);
    }
    if (performance_metrics.embedding_time) {
      detailContent.push(`  嵌入耗时: ${performance_metrics.embedding_time.toFixed(1)}ms`);
    }
    if (performance_metrics.similarity_score !== undefined) {
      // 显示更精确的相似度分数
      const score = performance_metrics.similarity_score;
      if (Math.abs(score) < 0.0001) {
        detailContent.push(`  相似度分数: ${score.toExponential(2)}`);
      } else {
        detailContent.push(`  相似度分数: ${score.toFixed(4)}`);
      }
    }
    if (performance_metrics.distance_score !== undefined) {
      detailContent.push(`  原始距离: ${performance_metrics.distance_score.toFixed(4)}`);
    }
    if (performance_metrics.search_results_count !== undefined) {
      detailContent.push(`  搜索结果数: ${performance_metrics.search_results_count}`);
    }
  }

  // 使用Modal显示详细信息
  Modal.info({
    title: `${providerDisplayName} 测试详情`,
    content: (
      <div style={{ whiteSpace: 'pre-line', fontFamily: 'monospace', fontSize: '13px' }}>
        {detailContent.join('\n')}
      </div>
    ),
    width: 600,
    okText: t('button.ok')
  });
};

/**
 * 向量数据库测试Modal组件
 */
export const VectorDBTestModal = ({
  visible,
  providerName,
  stepsData,
  currentStep,
  result,
  onClose,
  onShowDetail
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      title={`${providerName} 连接测试`}
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        result && result.info && result.info.test_levels && (
          <Button
            key="detail"
            type="primary"
            onClick={onShowDetail}
          >
            查看详情
          </Button>
        )
      ]}
      width={600}
    >
      <div style={{ padding: '20px 0' }}>
        <Steps
          orientation="vertical"
          current={currentStep}
          items={stepsData.map((step) => ({
            title: step.title,
            description: (
              <div>
                <div style={{ color: 'var(--custom-text-secondary)', marginBottom: '4px' }}>
                  {step.description}
                </div>
                {step.message && (
                  <div style={{
                    fontSize: '12px',
                    color: step.status === 'error' ? '#ff4d4f' :
                           step.status === 'finish' ? '#52c41a' : '#1677ff',
                    marginTop: '4px'
                  }}>
                    {step.message}
                    {step.duration && ` (${step.duration}s)`}
                  </div>
                )}
              </div>
            ),
            status: step.status,
            icon: step.status === 'process' ? <LoadingOutlined /> :
                  step.status === 'finish' ? <CheckCircleOutlined /> :
                  step.status === 'error' ? <CloseCircleOutlined /> :
                  step.icon
          }))}
        />

        {result && (
          <div style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: result.success ? '#f6ffed' : '#fff2f0',
            border: `1px solid ${result.success ? '#b7eb8f' : '#ffccc7'}`,
            borderRadius: '6px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '8px',
              color: result.success ? '#52c41a' : '#ff4d4f'
            }}>
              {result.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              <span style={{ marginLeft: '8px', fontWeight: 'bold' }}>
                {result.success ? t('vectorDB.test.success') : t('vectorDB.test.failed')}
              </span>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--custom-text-secondary)' }}>
              {result.message}
            </div>

            {result.info && result.info.performance_metrics && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)', marginBottom: '4px' }}>
                  性能指标:
                </div>
                {Object.entries(result.info.performance_metrics).map(([key, value]: [string, any]) => (
                  <div key={key} style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                    {key === 'embedding_time' && `嵌入耗时: ${Number(value).toFixed(1)}ms`}
                    {key === 'vector_dimension' && `向量维度: ${value}`}
                    {key === 'similarity_score' && `相似度分数: ${Math.abs(Number(value)) < 0.0001 ? Number(value).toExponential(2) : Number(value).toFixed(4)}`}
                    {key === 'distance_score' && `原始距离: ${Number(value).toFixed(4)}`}
                    {key === 'search_results_count' && `搜索结果数: ${value}`}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
