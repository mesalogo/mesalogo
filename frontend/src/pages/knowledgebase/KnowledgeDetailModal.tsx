import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Button } from 'antd';
import { FileTextOutlined, BlockOutlined, LockOutlined, SearchOutlined, CloudOutlined, ShareAltOutlined, SettingOutlined } from '@ant-design/icons';
import DocumentManager from './DocumentManager';
import ChunkSettings from './components/ChunkSettings';
import AccessControl from './components/AccessControl';
import RetrievalSettings from './components/RetrievalSettings';
import TestSearchModal from './components/TestSearchModal';
import LightRAGDocumentManager from './components/LightRAGDocumentManager';
import LightRAGQueryTest from './components/LightRAGQueryTest';
import LightRAGRetrievalSettings from './components/LightRAGRetrievalSettings';
import knowledgeAPI from '../../services/api/knowledge';

// Tabs TabPane is deprecated, we'll use items prop instead

const KnowledgeDetailModal = ({ visible, knowledgeId, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [knowledgeData, setKnowledgeData] = useState(null);
  const [activeTab, setActiveTab] = useState('documents');
  const [testQueryModalVisible, setTestQueryModalVisible] = useState(false);
  const [testQuerySearchOptions, setTestQuerySearchOptions] = useState({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 获取知识库详情
  useEffect(() => {
    if (visible && knowledgeId) {
      fetchKnowledgeData();
    }
  }, [visible, knowledgeId, refreshTrigger]);

  const fetchKnowledgeData = async () => {
    try {
      setLoading(true);
      const response = await knowledgeAPI.getById(knowledgeId);
      if (response.success) {
        setKnowledgeData(response.data);
      }
    } catch (error) {
      console.error('获取知识库信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 刷新知识库数据的方法
  const refreshKnowledgeData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Modal关闭时重置状态
  const handleClose = () => {
    setActiveTab('documents');
    onClose();
  };

  // 处理测试查询 - 实时获取最新配置
  const handleOpenTestQuery = async () => {
    try {
      // 实时获取最新的知识库配置，避免使用缓存的旧数据
      const response = await knowledgeAPI.getById(knowledgeId);
      
      if (response.success) {
        const latestData = response.data;
        const settings = latestData?.settings || {};
        const retrieval = settings.retrieval || {};
        const searchConfig = latestData?.search_config || {};
        
        setTestQuerySearchOptions({
          // 基础检索参数
          top_k: retrieval.top_k || 5,
          score_threshold: retrieval.score_threshold !== undefined ? retrieval.score_threshold : 0.0,
          // 混合检索配置
          search_mode: searchConfig.search_mode || 'hybrid',
          bm25_k1: searchConfig.bm25_k1 || 1.5,
          bm25_b: searchConfig.bm25_b || 0.75,
          rrf_k: searchConfig.rrf_k || 60,
          fusion_method: searchConfig.fusion_method || 'weighted',
          vector_weight: searchConfig.vector_weight !== undefined ? searchConfig.vector_weight : 0.7
        });
        
        console.log('测试查询使用最新配置:', {
          top_k: retrieval.top_k,
          score_threshold: retrieval.score_threshold,
          search_mode: searchConfig.search_mode,
          fusion_method: searchConfig.fusion_method
        });
        
        setTestQueryModalVisible(true);
      }
    } catch (error) {
      console.error('获取最新配置失败:', error);
      // 降级：使用当前缓存的数据
      const settings = knowledgeData?.settings || {};
      const retrieval = settings.retrieval || {};
      const searchConfig = knowledgeData?.search_config || {};
      
      setTestQuerySearchOptions({
        top_k: retrieval.top_k || 5,
        score_threshold: retrieval.score_threshold !== undefined ? retrieval.score_threshold : 0.0,
        search_mode: searchConfig.search_mode || 'hybrid',
        bm25_k1: searchConfig.bm25_k1 || 1.5,
        bm25_b: searchConfig.bm25_b || 0.75,
        rrf_k: searchConfig.rrf_k || 60,
        fusion_method: searchConfig.fusion_method || 'weighted',
        vector_weight: searchConfig.vector_weight !== undefined ? searchConfig.vector_weight : 0.7
      });
      
      setTestQueryModalVisible(true);
    }
  };

  // 判断是否是 LightRAG 类型知识库
  const isLightRAG = knowledgeData?.kb_type === 'lightrag';
  const lightragConfig = knowledgeData?.lightrag_config || {};

  // 构建 Tabs 配置
  const getTabItems = () => {
    if (isLightRAG) {
      // LightRAG 类型知识库的 Tabs
      return [
        {
          key: 'documents',
          label: <span><CloudOutlined />文档管理</span>,
          children: (
            <LightRAGDocumentManager 
              knowledgeId={knowledgeId}
              workspace={knowledgeData?.lightrag_workspace || knowledgeId}
            />
          )
        },
        {
          key: 'retrieval',
          label: <span><SettingOutlined />检索配置</span>,
          children: (
            <LightRAGRetrievalSettings 
              knowledgeId={knowledgeId}
              onSettingsSaved={refreshKnowledgeData}
            />
          )
        },
        {
          key: 'query',
          label: <span><SearchOutlined />查询测试</span>,
          children: (
            <LightRAGQueryTest 
              knowledgeId={knowledgeId}
              defaultMode={lightragConfig.query_mode || 'hybrid'}
              enableModeSelection={true}
            />
          )
        },
        {
          key: 'access',
          label: <span><LockOutlined />访问控制</span>,
          children: <AccessControl knowledgeId={knowledgeId} />
        }
      ];
    } else {
      // Vector 类型知识库的 Tabs（原有功能）
      return [
        {
          key: 'documents',
          label: <span><FileTextOutlined />文档管理</span>,
          children: (
            <DocumentManager 
              selectedKnowledgeId={knowledgeId}
            />
          )
        },
        {
          key: 'chunking',
          label: <span><BlockOutlined />分段设置</span>,
          children: <ChunkSettings knowledgeId={knowledgeId} />
        },
        {
          key: 'retrieval',
          label: <span><SearchOutlined />检索配置</span>,
          children: (
            <RetrievalSettings 
              knowledgeId={knowledgeId} 
              onSettingsSaved={refreshKnowledgeData}
            />
          )
        },
        {
          key: 'access',
          label: <span><LockOutlined />访问控制</span>,
          children: <AccessControl knowledgeId={knowledgeId} />
        }
      ];
    }
  };

  return (
    <Modal
      title={knowledgeData?.name || '知识库详情'}
      open={visible}
      onCancel={handleClose}
      width={1200}
      style={{ top: 20 }}
      styles={{ body: { maxHeight: '80vh', overflowY: 'auto', padding: '24px' } }}
      footer={null}
      destroyOnHidden
    >
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        tabBarExtraContent={
          !isLightRAG && (
            <Button 
              icon={<SearchOutlined />}
              onClick={handleOpenTestQuery}
              type="primary"
            >
              测试查询
            </Button>
          )
        }
        items={getTabItems()}
      />

      {/* Vector 类型的测试查询对话框 */}
      {!isLightRAG && (
        <TestSearchModal
          visible={testQueryModalVisible}
          onClose={() => setTestQueryModalVisible(false)}
          knowledgeId={knowledgeId}
          knowledgeName={knowledgeData?.name || ''}
          searchOptions={testQuerySearchOptions}
        />
      )}
    </Modal>
  );
};

export default KnowledgeDetailModal;
