import React, { useState } from 'react';
import { Modal, Button, Space, Input, Spin, List, Typography, App } from 'antd';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
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
      message.warning('请输入查询内容');
      return;
    }

    if (!knowledgeId) {
      message.warning('知识库ID无效');
      return;
    }

    setTestQueryLoading(true);
    try {
      // 使用传入的搜索配置参数
      const options: any = {
        top_k: (searchOptions as any).top_k || 5,
        score_threshold: (searchOptions as any).score_threshold !== undefined ? (searchOptions as any).score_threshold : 0.0
      };
      
      console.log('搜索选项:', options);
      
      const response = await knowledgeAPI.search(knowledgeId, testQuery, options);
      
      if (response.success) {
        // 后端已经按相似度排序，直接使用
        const results = response.data.results || [];
        
        // 添加日志确认排序
        console.log('搜索结果:', results.map(r => ({
          doc: r.document_name,
          score: r.score,
          method: r.search_method
        })));
        
        setTestQueryResults(results);
        if (results.length === 0) {
          message.info('未找到相关内容');
        }
      } else {
        message.error(response.message || '查询失败');
        setTestQueryResults([]);
      }
    } catch (error) {
      console.error('测试查询失败:', error);
      message.error('查询失败');
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
      title={`测试查询 - ${knowledgeName || ''}`}
      open={visible}
      onCancel={handleClose}
      width={800}
      footer={[
        <Button key="close" onClick={handleClose}>
          关闭
        </Button>
      ]}
      style={{ top: 20 }}
    >
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        <Input.Search
          placeholder="输入查询内容..."
          value={testQuery}
          onChange={(e) => setTestQuery(e.target.value)}
          onSearch={handleTestQuery}
          enterButton="查询"
          size="large"
          loading={testQueryLoading}
        />
        
        <Spin spinning={testQueryLoading}>
          {testQueryResults.length > 0 ? (
            <div>
              <div style={{ marginBottom: '16px', color: 'var(--custom-text-secondary)' }}>
                找到 {testQueryResults.length} 个相关结果
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
                            {item.document_name || '未知文档'}
                          </Text>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            分段 #{item.chunk_index !== undefined ? item.chunk_index + 1 : index + 1}
                          </Text>
                        </Space>
                        <Space orientation="vertical" size={0} align="end">
                          {/* 显示Reranker分数（优先级最高） */}
                          {item.rerank_score !== undefined && (
                            <Text strong style={{ fontSize: '13px', color: '#52c41a' }}>
                              Rerank分数: {(item.rerank_score * 100).toFixed(1)}%
                            </Text>
                          )}
                          {/* 显示融合分数或原始分数 */}
                          {item.fusion_score !== undefined && (
                            <Text strong style={{ fontSize: '13px', color: '#1677ff' }}>
                              {item.rerank_score !== undefined ? '原始' : ''}相似度: {(item.fusion_score * 100).toFixed(1)}%
                            </Text>
                          )}
                          {item.fusion_score === undefined && item.score !== undefined && (
                            <Text strong style={{ fontSize: '13px', color: '#1677ff' }}>
                              {item.rerank_score !== undefined ? '原始' : ''}相似度: {(item.score * 100).toFixed(1)}%
                            </Text>
                          )}
                          {/* 显示检索方法标签 */}
                          {item.search_method && (
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              {item.search_method === 'hybrid' && '混合检索'}
                              {item.search_method === 'vector' && '向量检索'}
                              {item.search_method === 'bm25' && 'BM25检索'}
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
                            {isExpanded ? '收起' : '展开'}
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
                未找到相关内容
              </div>
            )
          )}
          
          {!testQueryLoading && !testQuery && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: 'var(--custom-text-secondary)'
            }}>
              请输入查询内容进行测试
            </div>
          )}
        </Spin>
      </Space>
    </Modal>
  );
};

export default TestSearchModal;
