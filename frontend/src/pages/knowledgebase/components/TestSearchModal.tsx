import React, { useState } from 'react';
import { Modal, Button, Space, Input, Spin, List, Typography, App } from 'antd';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import knowledgeAPI from '../../../services/api/knowledge';

const { Text } = Typography;

/**
 * 测试搜索 Modal 组件
 * 
 * @param {boolean} visible - Modal 是否可见
 * @param {function} onClose - 关闭回调
 * @param {string} knowledgeId - 知识库 ID
 * @param {string} knowledgeName - 知识库名称
 * @param {object} searchOptions - 搜索配置参数 { top_k, score_threshold }
 */
const TestSearchModal = ({ 
  visible, 
  onClose, 
  knowledgeId, 
  knowledgeName,
  searchOptions = {}
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [testQuery, setTestQuery] = useState('');
  const [testQueryResults, setTestQueryResults] = useState([]);
  const [testQueryLoading, setTestQueryLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState(new Set());

  // 处理关闭
  const handleClose = () => {
    setTestQuery('');
    setTestQueryResults([]);
    setExpandedItems(new Set());
    onClose();
  };

  // 处理测试查询
  const handleTestQuery = async () => {
    if (!testQuery.trim()) {
      message.warning(t('testSearchModal.enterQuery'));
      return;
    }

    if (!knowledgeId) {
      message.warning(t('testSearchModal.invalidKnowledgeId'));
      return;
    }

    setTestQueryLoading(true);
    try {
      // 使用传入的搜索配置参数
      const options: any = {
        top_k: (searchOptions as any).top_k || 5,
        score_threshold: (searchOptions as any).score_threshold !== undefined ? (searchOptions as any).score_threshold : 0.0
      };
      
      console.log('Search options:', options);
      
      const response = await knowledgeAPI.search(knowledgeId, testQuery, options);
      
      if (response.success) {
        // 后端已经按相似度排序，直接使用
        const results = response.data.results || [];
        
        // 添加日志确认排序
        console.log('Search results:', results.map(r => ({
          doc: r.document_name,
          score: r.score,
          method: r.search_method
        })));
        
        setTestQueryResults(results);
        if (results.length === 0) {
          message.info(t('testSearchModal.noRelatedContent'));
        }
      } else {
        message.error(response.message || t('testSearchModal.queryFailed'));
        setTestQueryResults([]);
      }
    } catch (error) {
      console.error('Test query failed:', error);
      message.error(t('testSearchModal.queryFailed'));
      setTestQueryResults([]);
    } finally {
      setTestQueryLoading(false);
    }
  };

  // 切换展开/收起
  const toggleExpand = (index) => {
    const newSet = new Set(expandedItems);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setExpandedItems(newSet);
  };

  return (
    <Modal
      title={t('testSearchModal.title', { name: knowledgeName || '' })}
      open={visible}
      onCancel={handleClose}
      width={800}
      footer={[
        <Button key="close" onClick={handleClose}>
          {t('testSearchModal.close')}
        </Button>
      ]}
      style={{ top: 20 }}
    >
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        <Input.Search
          placeholder={t('testSearchModal.queryPlaceholder')}
          value={testQuery}
          onChange={(e) => setTestQuery(e.target.value)}
          onSearch={handleTestQuery}
          enterButton={t('testSearchModal.queryBtn')}
          size="large"
          loading={testQueryLoading}
        />
        
        <Spin spinning={testQueryLoading}>
          {testQueryResults.length > 0 ? (
            <div>
              <div style={{ marginBottom: '16px', color: 'var(--custom-text-secondary)' }}>
                {t('testSearchModal.resultsCount', { count: testQueryResults.length })}
              </div>
              <List
                itemLayout="vertical"
                dataSource={testQueryResults}
                renderItem={(item, index) => {
                  const content = item.content || item.text || '';
                  const shouldCollapse = content.length > 50;
                  const isExpanded = expandedItems.has(index);
                  const displayContent = shouldCollapse && !isExpanded 
                    ? content.substring(0, 50) + '...' 
                    : content;

                  return (
                    <List.Item
                      key={index}
                      style={{
                        padding: '16px',
                        backgroundColor: 'var(--custom-header-bg)',
                        borderRadius: '4px',
                        marginBottom: '12px',
                        border: '1px solid var(--custom-border)',
                      }}
                    >
                      <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space orientation="vertical" size={4}>
                          <Text strong style={{ fontSize: '14px' }}>
                            {item.document_name || t('testSearchModal.unknownDocument')}
                          </Text>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {t('testSearchModal.chunkLabel', { index: item.chunk_index !== undefined ? item.chunk_index + 1 : index + 1 })}
                          </Text>
                        </Space>
                        <Space orientation="vertical" size={0} align="end">
                          {/* 显示Reranker分数（优先级最高） */}
                          {item.rerank_score !== undefined && (
                            <Text strong style={{ fontSize: '13px', color: '#52c41a' }}>
                              {t('testSearchModal.rerankScore', { value: (item.rerank_score * 100).toFixed(1) })}
                            </Text>
                          )}
                          {/* 显示融合分数或原始分数 */}
                          {item.fusion_score !== undefined && (
                            <Text strong style={{ fontSize: '13px', color: '#1677ff' }}>
                              {t('testSearchModal.similarity', { prefix: item.rerank_score !== undefined ? t('testSearchModal.originalPrefix') : '', value: (item.fusion_score * 100).toFixed(1) })}
                            </Text>
                          )}
                          {item.fusion_score === undefined && item.score !== undefined && (
                            <Text strong style={{ fontSize: '13px', color: '#1677ff' }}>
                              {t('testSearchModal.similarity', { prefix: item.rerank_score !== undefined ? t('testSearchModal.originalPrefix') : '', value: (item.score * 100).toFixed(1) })}
                            </Text>
                          )}
                          {/* 显示检索方法标签 */}
                          {item.search_method && (
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              {item.search_method === 'hybrid' && t('testSearchModal.searchMethod.hybrid')}
                              {item.search_method === 'vector' && t('testSearchModal.searchMethod.vector')}
                              {item.search_method === 'bm25' && t('testSearchModal.searchMethod.bm25')}
                              {item.search_method.includes('+Reranker') && item.search_method}
                              {!['hybrid', 'vector', 'bm25'].includes(item.search_method) && !item.search_method.includes('+Reranker') && item.search_method}
                            </Text>
                          )}
                        </Space>
                      </div>
                      <div style={{
                        padding: '12px',
                        backgroundColor: 'var(--custom-card-bg)',
                        borderRadius: '4px',
                        fontSize: '14px',
                        lineHeight: '1.8',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: 'var(--custom-text)',
                        border: '1px solid var(--custom-border)',
                      }}>
                        {displayContent}
                      </div>
                      {shouldCollapse && (
                        <div style={{ marginTop: '8px', textAlign: 'center' }}>
                          <Button
                            type="link"
                            onClick={() => toggleExpand(index)}
                            icon={isExpanded ? <DownOutlined /> : <RightOutlined />}
                          >
                            {isExpanded ? t('testSearchModal.collapse') : t('testSearchModal.expand')}
                          </Button>
                        </div>
                      )}
                    </List.Item>
                  );
                }}
              />
            </div>
          ) : (
            !testQueryLoading && testQuery && (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: 'var(--custom-text-secondary)'
              }}>
                {t('testSearchModal.noRelatedContentHint')}
              </div>
            )
          )}
          
          {!testQueryLoading && !testQuery && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: 'var(--custom-text-secondary)'
            }}>
              {t('testSearchModal.enterQueryHint')}
            </div>
          )}
        </Spin>
      </Space>
    </Modal>
  );
};

export default TestSearchModal;
