import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, Button, Space, App, Typography, Tag, Tooltip, Select, Input, Progress, Modal, Spin, Radio, Dropdown, Collapse, Segmented, Skeleton } from 'antd';
import { UploadOutlined, DeleteOutlined, EyeOutlined, SearchOutlined, DownloadOutlined, ReloadOutlined, SyncOutlined, FileMarkdownOutlined, EyeOutlined as PreviewOutlined, FileTextOutlined, DownOutlined, ScissorOutlined, DatabaseOutlined, ThunderboltOutlined, CopyOutlined } from '@ant-design/icons';
import knowledgeAPI from '../../services/api/knowledge';
import { actionTaskAPI } from '../../services/api/actionTask';
import BatchUploadDialog from '../../components/BatchUploadDialog';
import { getFileIcon } from '../../utils/fileUtils';
import { MarkdownRenderer } from '../actiontask/components/ConversationExtraction';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;


const DocumentManager = ({ selectedKnowledgeId: propSelectedKnowledgeId }) => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState(propSelectedKnowledgeId || 0);
  const [uploadDialogVisible, setUploadDialogVisible] = useState(false);
  const [markdownModalVisible, setMarkdownModalVisible] = useState(false);
  const [markdownContent, setMarkdownContent] = useState('');
  const [markdownLoading, setMarkdownLoading] = useState(false);
  const [markdownViewMode, setMarkdownViewMode] = useState('rendered'); // 'rendered' 或 'source'
  const [currentFile, setCurrentFile] = useState(null);
  const [convertingFiles, setConvertingFiles] = useState(new Set());
  const [chunksModalVisible, setChunksModalVisible] = useState(false);
  const [chunksData, setChunksData] = useState([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [copyToWorkspaceModalVisible, setCopyToWorkspaceModalVisible] = useState(false);
  const [actionTasks, setActionTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [copyLoading, setCopyLoading] = useState(false);

  // 当从父组件传入 selectedKnowledgeId 时，更新本地状态
  useEffect(() => {
    if (propSelectedKnowledgeId !== null && propSelectedKnowledgeId !== undefined) {
      setSelectedKnowledgeId(propSelectedKnowledgeId);
    }
  }, [propSelectedKnowledgeId]);

  // 当选择的知识库改变时，获取对应的文档列表
  useEffect(() => {
    fetchDocuments(selectedKnowledgeId);
  }, [selectedKnowledgeId]);

  const fetchDocuments = async (id) => {
    try {
      setLoading(true);
      let response;

      if (!id || id === 0) {
        // 获取所有知识库的文件
        response = await knowledgeAPI.getAllFiles();
      } else {
        // 获取指定知识库的文件
        response = await knowledgeAPI.getFiles(id);
      }

      if (response.success) {
        console.log('document list received:', response.data);
        console.log('first file conversion status:', response.data[0]?.conversion_status);
        console.log('first file payload:', JSON.stringify(response.data[0], null, 2));
        setDocuments(response.data);
      } else {
        message.error(response.message || t('documentManager.fetchFailed'));
        setDocuments([]);
      }
    } catch (error) {
      console.error('fetch document list failed:', error);
      message.error(t('documentManager.fetchFailed'));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  // 处理上传对话框打开
  const handleOpenUploadDialog = () => {
    setUploadDialogVisible(true);
  };

  // 处理上传对话框关闭
  const handleCloseUploadDialog = () => {
    setUploadDialogVisible(false);
  };

  // 处理上传完成
  const handleUploadComplete = (results) => {
    // 刷新文档列表
    fetchDocuments(selectedKnowledgeId);

    // 显示上传结果消息
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    if (successCount > 0) {
      message.success(t('documentManager.uploadSuccess', { count: successCount }));
    }
    if (failCount > 0) {
      message.error(t('documentManager.uploadFailed', { count: failCount }));
    }

    // 自动关闭上传对话框
    setUploadDialogVisible(false);
  };



  // 处理删除文档
  const handleDelete = (record) => {
    let knowledgeId, filename;

    if (selectedKnowledgeId === 0) {
      // 显示所有知识库时，从record中获取知识库ID和文件名
      knowledgeId = record.knowledge_id;
      filename = record.name;
    } else {
      // 显示单个知识库时，使用选中的知识库ID
      knowledgeId = selectedKnowledgeId;
      filename = record.name || record; // 兼容旧的调用方式
    }

    if (!knowledgeId) {
      message.error(t('documentManager.cannotDetermineKnowledge'));
      return;
    }

    modal.confirm({
      title: t('documentManager.confirmDelete'),
      content: t('documentManager.confirmDeleteContent', { filename }),
      okText: t('documentManager.confirmDeleteOk'),
      cancelText: t('documentManager.batchDelete.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          const response = await knowledgeAPI.deleteFile(knowledgeId, filename);
          if (response.success) {
            message.success(t('documentManager.deleteSuccess'));
            fetchDocuments(selectedKnowledgeId);
          } else {
            message.error(response.message || t('documentManager.deleteFailed'));
          }
        } catch (error) {
          console.error('delete document failed:', error);
          message.error(t('documentManager.deleteFailed'));
        }
      }
    });
  };

  // 处理文件转换
  const handleConvert = async (record) => {
    const knowledgeId = selectedKnowledgeId === 0 ? record.knowledge_id : selectedKnowledgeId;

    if (!knowledgeId) {
      message.error(t('documentManager.cannotDetermineKnowledge'));
      return;
    }

    if (record.conversion_status === 'converted' ||
        record.chunking_status === 'chunked' ||
        record.embedding_status === 'embedded') {
      let content = t('documentManager.reconvertContent');
      if (record.chunking_status === 'chunked') {
        content += t('documentManager.reconvertContentChunked');
      }
      if (record.embedding_status === 'embedded') {
        content += t('documentManager.reconvertContentEmbedded');
      }
      content += t('documentManager.reconvertContentEnd');

      modal.confirm({
        title: t('documentManager.confirmReconvert'),
        content,
        okText: t('documentManager.batchProcess.confirmOk'),
        cancelText: t('documentManager.batchProcess.cancel'),
        onOk: async () => {
          await executeConvert(knowledgeId, record);
        }
      });
    } else {
      await executeConvert(knowledgeId, record);
    }
  };

  const executeConvert = async (knowledgeId, record) => {
    const filePath = record.path || record.name;
    try {
      setConvertingFiles(prev => new Set(prev).add(filePath));

      const response = await knowledgeAPI.convertFile(knowledgeId, record.id);

      if (response.success) {
        message.success(t('documentManager.convertTaskCreated'));
        fetchDocuments(selectedKnowledgeId);

        const checkStatus = async () => {
          try {
            const statusResponse = await knowledgeAPI.getConversionStatus(knowledgeId, record.id);

            if (statusResponse.success) {
              const status = statusResponse.data.status;
              console.log('conversion status:', status, statusResponse.data);

              if (status === 'converted') {
                message.success(t('documentManager.convertSuccess'));
                setConvertingFiles(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(filePath);
                  return newSet;
                });
                fetchDocuments(selectedKnowledgeId);
              } else if (status === 'conversion_failed') {
                message.error(t('documentManager.convertFailed', { error: statusResponse.data.error_message || t('documentManager.unknownError') }));
                setConvertingFiles(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(filePath);
                  return newSet;
                });
                fetchDocuments(selectedKnowledgeId);
              } else if (status === 'converting') {
                setTimeout(checkStatus, 5000);
              }
            }
          } catch (error) {
            console.error('check conversion status failed:', error);
            setConvertingFiles(prev => {
              const newSet = new Set(prev);
              newSet.delete(filePath);
              return newSet;
            });
          }
        };

        setTimeout(checkStatus, 2000);
      } else {
        message.error(response.message || t('documentManager.convertTaskFailed'));
        setConvertingFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(filePath);
          return newSet;
        });
      }
    } catch (error) {
      console.error('file conversion failed:', error);
      message.error(t('documentManager.convertTaskFailed'));
      setConvertingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(filePath);
        return newSet;
      });
    }
  };

  // 处理查看分段
  const handleViewChunks = async (record) => {
    const knowledgeId = selectedKnowledgeId === 0 ? record.knowledge_id : selectedKnowledgeId;
    const filePath = record.path || record.name;

    if (!knowledgeId) {
      message.error(t('documentManager.cannotDetermineKnowledge'));
      return;
    }

    setChunksModalVisible(true);
    setCurrentFile(record);
    setChunksLoading(true);

    try {
      const response = await knowledgeAPI.getFileChunks(knowledgeId, record.id);

      if (response.success) {
        setChunksData(response.data.chunks || []);
      } else {
        message.error(response.message || t('documentManager.getChunksFailed'));
        setChunksModalVisible(false);
        setChunksData([]);
        setCurrentFile(null);
      }
    } catch (error) {
      console.error('get chunks failed:', error);
      message.error(t('documentManager.getChunksFailed'));
      setChunksModalVisible(false);
      setChunksData([]);
      setCurrentFile(null);
    } finally {
      setChunksLoading(false);
    }
  };

  // 处理查看 Markdown
  const handleViewMarkdown = async (record) => {
    const knowledgeId = selectedKnowledgeId === 0 ? record.knowledge_id : selectedKnowledgeId;
    const filePath = record.path || record.name;

    if (!knowledgeId) {
      message.error(t('documentManager.cannotDetermineKnowledge'));
      return;
    }

    setMarkdownModalVisible(true);
    setCurrentFile(record);
    setMarkdownLoading(true);
    setMarkdownViewMode('rendered');

    try {
      const response = await knowledgeAPI.getMarkdownContent(knowledgeId, record.id);

      if (response.success) {
        setMarkdownContent(response.data.content);
      } else {
        message.error(response.message || t('documentManager.getMarkdownFailed'));
        setMarkdownModalVisible(false);
        setMarkdownContent('');
        setCurrentFile(null);
      }
    } catch (error) {
      console.error('get markdown content failed:', error);
      message.error(t('documentManager.getMarkdownFailed'));
      setMarkdownModalVisible(false);
      setMarkdownContent('');
      setCurrentFile(null);
    } finally {
      setMarkdownLoading(false);
    }
  };

  // 处理文件分段
  const handleChunk = async (record) => {
    const knowledgeId = selectedKnowledgeId === 0 ? record.knowledge_id : selectedKnowledgeId;

    if (!knowledgeId) {
      message.error(t('documentManager.cannotDetermineKnowledge'));
      return;
    }

    if (record.conversion_status !== 'converted') {
      message.warning(t('documentManager.needConvertFirst'));
      return;
    }

    if (record.chunking_status === 'chunked' || record.embedding_status === 'embedded') {
      modal.confirm({
        title: t('documentManager.confirmRechunk'),
        content: t('documentManager.rechunkContent'),
        okText: t('documentManager.batchProcess.confirmOk'),
        cancelText: t('documentManager.batchProcess.cancel'),
        onOk: async () => {
          await executeChunk(knowledgeId, record);
        }
      });
    } else {
      await executeChunk(knowledgeId, record);
    }
  };

  const executeChunk = async (knowledgeId, record) => {
    try {
      const response = await knowledgeAPI.chunkFile(knowledgeId, record.id);

      if (response.success) {
        message.success(t('documentManager.chunkTaskCreated'));
        fetchDocuments(selectedKnowledgeId);

        const checkStatus = async () => {
          try {
            const statusResponse = await knowledgeAPI.getChunkingStatus(knowledgeId, record.id);

            if (statusResponse.success) {
              const status = statusResponse.data.status;

              if (status === 'chunked') {
                message.success(t('documentManager.chunkSuccess'));
                fetchDocuments(selectedKnowledgeId);
              } else if (status === 'chunking_failed') {
                message.error(t('documentManager.chunkFailed', { error: statusResponse.data.error_message || t('documentManager.unknownError') }));
                fetchDocuments(selectedKnowledgeId);
              } else if (status === 'chunking') {
                setTimeout(checkStatus, 5000);
              }
            }
          } catch (error) {
            console.error('check chunking status failed:', error);
          }
        };

        setTimeout(checkStatus, 2000);
      } else {
        message.error(response.message || t('documentManager.chunkTaskFailed'));
      }
    } catch (error) {
      console.error('file chunking failed:', error);
      message.error(t('documentManager.chunkTaskFailed'));
    }
  };

  // 处理文件嵌入
  const handleEmbed = async (record) => {
    const knowledgeId = selectedKnowledgeId === 0 ? record.knowledge_id : selectedKnowledgeId;

    if (!knowledgeId) {
      message.error(t('documentManager.cannotDetermineKnowledge'));
      return;
    }

    if (record.chunking_status !== 'chunked') {
      message.warning(t('documentManager.needChunkFirst'));
      return;
    }

    if (record.embedding_status === 'embedded') {
      modal.confirm({
        title: t('documentManager.confirmReembed'),
        content: t('documentManager.reembedContent'),
        okText: t('documentManager.batchProcess.confirmOk'),
        cancelText: t('documentManager.batchProcess.cancel'),
        onOk: async () => {
          await executeEmbed(knowledgeId, record);
        }
      });
    } else {
      await executeEmbed(knowledgeId, record);
    }
  };

  const executeEmbed = async (knowledgeId, record) => {
    try {
      const response = await knowledgeAPI.embedFile(knowledgeId, record.id);

      if (response.success) {
        message.success(t('documentManager.embedTaskCreated'));
        fetchDocuments(selectedKnowledgeId);

        const checkStatus = async () => {
          try {
            const statusResponse = await knowledgeAPI.getEmbeddingStatus(knowledgeId, record.id);

            if (statusResponse.success) {
              const status = statusResponse.data.status;

              if (status === 'embedded') {
                message.success(t('documentManager.embedSuccess'));
                fetchDocuments(selectedKnowledgeId);
              } else if (status === 'embedding_failed') {
                message.error(t('documentManager.embedFailed', { error: statusResponse.data.error_message || t('documentManager.unknownError') }));
                fetchDocuments(selectedKnowledgeId);
              } else if (status === 'embedding') {
                setTimeout(checkStatus, 5000);
              }
            }
          } catch (error) {
            console.error('check embedding status failed:', error);
          }
        };

        setTimeout(checkStatus, 2000);
      } else {
        message.error(response.message || t('documentManager.embedTaskFailed'));
      }
    } catch (error) {
      console.error('embedding failed:', error);
      message.error(t('documentManager.embedTaskFailed'));
    }
  };

  // 处理一键处理（完整流程）
  const handleProcess = async (record) => {
    const knowledgeId = selectedKnowledgeId === 0 ? record.knowledge_id : selectedKnowledgeId;
    const filePath = record.path || record.name;
    
    if (!knowledgeId) {
      message.error(t('docManager.cannotDetermineKb'));
      return;
    }

    // 显示确认弹窗
    const hasProcessing = record.conversion_status === 'converted' || 
                         record.chunking_status === 'chunked' || 
                         record.embedding_status === 'embedded';
    
    modal.confirm({
      title: hasProcessing ? t('documentManager.confirmReprocess') : t('documentManager.confirmProcess'),
      content: hasProcessing
        ? t('documentManager.reprocessContent')
        : t('documentManager.processContent'),
      okText: t('documentManager.batchProcess.confirmOk'),
      cancelText: t('documentManager.batchProcess.cancel'),
      onOk: async () => {
        await executeProcess(knowledgeId, filePath, record);
      }
    });
  };

  const executeProcess = async (knowledgeId, filePath, record) => {
    try {
      const response = await knowledgeAPI.processFile(knowledgeId, record.id);

      if (response.success) {
        message.success(t('documentManager.pipelineStarted'));

        const jobId = response.data?.job_id;
        if (!jobId) {
          message.warning(t('documentManager.pipelineNoJobId'));
          return;
        }
        
        // 轮询检查Pipeline Job状态
        const checkStatus = async () => {
          try {
            // 导入jobsAPI (default export)
            const jobsAPI = (await import('../../services/api/jobs')).default;
            
            const jobStatus = await jobsAPI.getJobStatus(jobId);
            
            // 调试日志
            console.log('Pipeline轮询 - 接收到的状态:', {
              conversion_status: jobStatus.conversion_status,
              chunking_status: jobStatus.chunking_status,
              embedding_status: jobStatus.embedding_status
            });
            
            // 后端Job.to_dict()会将data字段平铺到根层级，直接读取即可
            // 部分更新：只更新当前文档的状态字段，不刷新整个列表
            setDocuments(prevDocs => {
              const updated = prevDocs.map(doc => {
                if (doc.id === record.id) {
                  const newDoc = { 
                    ...doc, 
                    status: jobStatus.status === 'completed' ? 'completed' :
                            jobStatus.status === 'failed' ? 'failed' : 
                            'processing',
                    error_message: jobStatus.status === 'failed' ? jobStatus.error : null,
                    conversion_status: jobStatus.conversion_status || 'not_converted',
                    chunking_status: jobStatus.chunking_status || 'not_chunked',
                    embedding_status: jobStatus.embedding_status || 'not_embedded'
                  };
                  console.log('Pipeline轮询 - 更新后的文档:', {
                    id: newDoc.id,
                    conversion_status: newDoc.conversion_status,
                    chunking_status: newDoc.chunking_status,
                    embedding_status: newDoc.embedding_status
                  });
                  return newDoc;
                }
                return doc;
              });
              return updated;
            });
            
            if (jobStatus.status === 'completed') {
              message.success(t('documentManager.pipelineSuccess'));
              fetchDocuments(selectedKnowledgeId);
            } else if (jobStatus.status === 'failed') {
              const errorMsg = jobStatus.error || t('documentManager.unknownError');
              message.error(t('documentManager.pipelineFailed', { error: errorMsg }));
              fetchDocuments(selectedKnowledgeId);
            } else if (jobStatus.status === 'running' || jobStatus.status === 'pending') {
              const progressMsg = jobStatus.message || 'processing';
              console.log(`Pipeline progress: ${jobStatus.progress}% - ${progressMsg}`);
              setTimeout(checkStatus, 5000);
            } else {
              setTimeout(checkStatus, 5000);
            }
          } catch (error) {
            console.error('check Pipeline status failed:', error);
            setTimeout(checkStatus, 5000);
          }
        };

        setTimeout(checkStatus, 1000);
      } else {
        message.error(response.message || t('documentManager.processTaskFailed'));
      }
    } catch (error) {
      console.error('document processing failed:', error);
      message.error(t('documentManager.processFailed'));
    }
  };

  // 处理下载Markdown文件
  const handleDownloadMarkdown = () => {
    if (!markdownContent || !currentFile) {
      message.error(t('documentManager.noContentToDownload'));
      return;
    }

    // 创建Blob对象
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    
    // 创建下载链接
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // 设置文件名 - 使用原文件名的基础名称加上.md扩展名
    const fileName = currentFile.name || currentFile.path || 'document';
    const baseName = fileName.replace(/\.[^/.]+$/, ''); // 移除原扩展名
    link.download = `${baseName}.md`;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    
    // 清理
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    message.success(t('documentManager.downloadSuccess'));
  };

  // 打开复制到工作空间对话框
  const handleOpenCopyToWorkspace = async () => {
    if (!currentFile) {
      message.error(t('documentManager.copyToWorkspace.selectFirst'));
      return;
    }

    try {
      const tasks = await actionTaskAPI.getAll();
      const filteredTasks = tasks.filter((task: any) => !task.is_experiment_clone);
      setActionTasks(filteredTasks);
      setSelectedTaskId(null);
      setCopyToWorkspaceModalVisible(true);
    } catch (error) {
      console.error('fetch action-task list failed:', error);
      message.error(t('documentManager.copyToWorkspace.fetchTasksFailed'));
    }
  };

  // 执行复制到工作空间
  const handleCopyToWorkspace = async () => {
    if (!selectedTaskId) {
      message.error(t('documentManager.copyToWorkspace.selectTarget'));
      return;
    }

    if (!currentFile) {
      message.error(t('documentManager.copyToWorkspace.selectFirst'));
      return;
    }

    const knowledgeId = selectedKnowledgeId === 0 ? currentFile.knowledge_id : selectedKnowledgeId;

    try {
      setCopyLoading(true);
      const response = await knowledgeAPI.copyMarkdownToWorkspace(
        knowledgeId,
        currentFile.id,
        selectedTaskId
      );

      if (response.success) {
        message.success(t('documentManager.copyToWorkspace.success', { path: response.data?.file_path || '' }));
        setCopyToWorkspaceModalVisible(false);
      } else {
        message.error(response.message || t('documentManager.copyToWorkspace.failed'));
      }
    } catch (error) {
      console.error('copy to workspace failed:', error);
      message.error(t('documentManager.copyToWorkspace.failed'));
    } finally {
      setCopyLoading(false);
    }
  };

  // 检查文件转换状态
  const checkConversionStatus = async (record) => {
    const knowledgeId = selectedKnowledgeId === 0 ? record.knowledge_id : selectedKnowledgeId;
    const filePath = record.path || record.name;

    try {
      const response = await knowledgeAPI.getConversionStatus(knowledgeId, record.id);

      if (response.success) {
        return response.data.status;
      }
    } catch (error) {
      console.error('check conversion status failed:', error);
    }

    return 'not_converted';
  };

  // 处理搜索
  const handleSearch = (value) => {
    setSearchText(value);
  };

  // 处理文件类型筛选
  const handleFileTypeChange = (value) => {
    setFileTypeFilter(value);
  };

  // 处理刷新
  const handleRefresh = () => {
    fetchDocuments(selectedKnowledgeId);
  };

  // 过滤文档
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = searchText ? doc.name.toLowerCase().includes(searchText.toLowerCase()) : true;
    const matchesType = fileTypeFilter !== 'all' ? doc.type === fileTypeFilter : true;
    return matchesSearch && matchesType;
  });

  // 批量处理文档
  const handleBatchProcess = async (fileIds) => {
    if (!fileIds || fileIds.length === 0) {
      message.warning(t('documentManager.selectAtLeastOne'));
      return;
    }

    modal.confirm({
      title: t('documentManager.confirmBatchProcess'),
      content: t('documentManager.batchProcessContent', { count: fileIds.length }),
      okText: t('documentManager.batchProcess.confirmOk'),
      cancelText: t('documentManager.batchProcess.cancel'),
      onOk: async () => {
        for (const fileId of fileIds) {
          const record = documents.find(doc => doc.id === fileId);
          if (record) {
            await executeProcess(selectedKnowledgeId, record.path || record.name, record);
          }
        }
        message.success(t('documentManager.batchProcessStarted', { count: fileIds.length }));
        setSelectedRowKeys([]);
      }
    });
  };

  // 处理全部文档
  const handleProcessAll = async () => {
    if (filteredDocuments.length === 0) {
      message.warning(t('documentManager.noDocumentsToProcess'));
      return;
    }

    modal.confirm({
      title: t('documentManager.confirmProcessAll'),
      content: t('documentManager.processAllContent', { count: filteredDocuments.length }),
      okText: t('documentManager.batchProcess.confirmOk'),
      cancelText: t('documentManager.batchProcess.cancel'),
      onOk: async () => {
        for (const record of filteredDocuments) {
          await executeProcess(selectedKnowledgeId, record.path || record.name, record);
        }
        message.success(t('documentManager.processAllStarted', { count: filteredDocuments.length }));
      }
    });
  };

  // 批量删除文档
  const handleBatchDelete = async (fileIds) => {
    if (!fileIds || fileIds.length === 0) {
      message.warning(t('documentManager.selectAtLeastOne'));
      return;
    }

    modal.confirm({
      title: t('documentManager.confirmBatchDelete'),
      content: t('documentManager.batchDeleteContent', { count: fileIds.length }),
      okText: t('documentManager.confirmDeleteOk'),
      cancelText: t('documentManager.batchDelete.cancel'),
      okType: 'danger',
      onOk: async () => {
        let successCount = 0;
        let failCount = 0;

        for (const fileId of fileIds) {
          const record = documents.find(doc => doc.id === fileId);
          if (record) {
            try {
              const response = await knowledgeAPI.deleteFile(selectedKnowledgeId, record.name);
              if (response.success) {
                successCount++;
              } else {
                failCount++;
              }
            } catch (error) {
              console.error('delete document failed:', error);
              failCount++;
            }
          }
        }

        if (successCount > 0) {
          message.success(t('documentManager.batchDeleteSuccess', { count: successCount }));
        }
        if (failCount > 0) {
          message.error(t('documentManager.batchDeleteFailed', { count: failCount }));
        }

        fetchDocuments(selectedKnowledgeId);
        setSelectedRowKeys([]);
      }
    });
  };

  // 动态生成列定义
  const getColumns = () => {
    const baseColumns: any[] = [
      {
        title: t('documentManager.columns.filename'),
        dataIndex: 'name',
        key: 'name',
        width: 200,
        fixed: 'left' as const,
        render: (text, record) => (
          <Space>
            {getFileIcon(record.name)}
            <span>{text}</span>
          </Space>
        ),
      },
    ];

    if (selectedKnowledgeId === 0) {
      baseColumns.push({
        title: t('documentManager.columns.knowledgeBase'),
        dataIndex: 'knowledge_name',
        key: 'knowledge_name',
        width: 150,
        render: (text) => (
          <Tag color="blue">{text}</Tag>
        ),
      });
    }

    baseColumns.push(
      {
        title: t('documentManager.columns.size'),
        dataIndex: 'size',
        key: 'size',
        width: 100,
      },
      {
        title: t('documentManager.columns.status'),
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status, record) => {
          const statusMap = {
            'pending': { text: t('documentManager.status.pending'), color: 'default' },
            'processing': { text: t('documentManager.status.processing'), color: 'processing' },
            'completed': { text: t('documentManager.status.completed'), color: 'success' },
            'failed': { text: t('documentManager.status.failed'), color: 'error' }
          };

          const config = statusMap[status] || { text: t('documentManager.status.pending'), color: 'default' };

          if (status === 'failed' && record.error_message) {
            return (
              <Tooltip title={record.error_message}>
                <Tag color={config.color}>{config.text}</Tag>
              </Tooltip>
            );
          }

          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      {
        title: t('documentManager.columns.conversionStatus'),
        dataIndex: 'conversion_status',
        key: 'conversion_status',
        width: 120,
        render: (status, record) => {
          const statusMap = {
            'not_converted': { text: t('documentManager.conversionStatus.notConverted'), color: 'default' },
            'converting': { text: t('documentManager.conversionStatus.converting'), color: 'processing' },
            'converted': { text: t('documentManager.conversionStatus.converted'), color: 'success' },
            'conversion_failed': { text: t('documentManager.conversionStatus.failed'), color: 'error' }
          };
          const actualStatus = status || 'not_converted';
          const config = statusMap[actualStatus] || { text: t('documentManager.conversionStatus.notConverted'), color: 'default' };
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      {
        title: t('documentManager.columns.chunkingStatus'),
        dataIndex: 'chunking_status',
        key: 'chunking_status',
        width: 120,
        render: (status) => {
          const statusMap = {
            'not_chunked': { text: t('documentManager.chunkingStatus.notChunked'), color: 'default' },
            'chunking': { text: t('documentManager.chunkingStatus.chunking'), color: 'processing' },
            'chunked': { text: t('documentManager.chunkingStatus.chunked'), color: 'success' },
            'chunking_failed': { text: t('documentManager.chunkingStatus.failed'), color: 'error' }
          };
          const actualStatus = status || 'not_chunked';
          const config = statusMap[actualStatus] || { text: t('documentManager.chunkingStatus.notChunked'), color: 'default' };
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      {
        title: t('documentManager.columns.embeddingStatus'),
        dataIndex: 'embedding_status',
        key: 'embedding_status',
        width: 120,
        render: (status) => {
          const statusMap = {
            'not_embedded': { text: t('documentManager.embeddingStatus.notEmbedded'), color: 'default' },
            'embedding': { text: t('documentManager.embeddingStatus.embedding'), color: 'processing' },
            'embedded': { text: t('documentManager.embeddingStatus.embedded'), color: 'success' },
            'embedding_failed': { text: t('documentManager.embeddingStatus.failed'), color: 'error' }
          };
          const actualStatus = status || 'not_embedded';
          const config = statusMap[actualStatus] || { text: t('documentManager.embeddingStatus.notEmbedded'), color: 'default' };
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      {
        title: t('documentManager.columns.chunks'),
        dataIndex: 'chunks',
        key: 'chunks',
        width: 100,
      },
      {
        title: t('documentManager.columns.tokens'),
        dataIndex: 'tokens',
        key: 'tokens',
        width: 100,
      },
      {
        title: t('documentManager.columns.uploadTime'),
        dataIndex: 'upload_time',
        key: 'upload_time',
        render: (date) => new Date(date).toLocaleString(),
      },
      {
        title: t('documentManager.columns.actions'),
        key: 'action',
        width: 200,
        fixed: 'right' as const,
        render: (_, record) => {
          const filePath = record.path || record.name;
          const isProcessing = record.conversion_status === 'converting' ||
                              record.chunking_status === 'chunking' ||
                              record.embedding_status === 'embedding';
          const isConverted = record.conversion_status === 'converted';
          const isChunked = record.chunking_status === 'chunked';
          const isEmbedded = record.embedding_status === 'embedded';

          // 生成处理步骤下拉菜单项
          const processMenuItems = [
            {
              key: 'convert',
              icon: <SyncOutlined spin={record.conversion_status === 'converting'} />,
              label: t('documentManager.action.convert'),
              onClick: () => handleConvert(record),
            },
            {
              key: 'chunk',
              icon: <ScissorOutlined />,
              label: t('documentManager.action.chunk'),
              onClick: () => handleChunk(record),
              disabled: !isConverted,
            },
            {
              key: 'embed',
              icon: <DatabaseOutlined />,
              label: t('documentManager.action.embed'),
              onClick: () => handleEmbed(record),
              disabled: !isChunked,
            },
          ];

          return (
            <Space>
              <Space.Compact>
                <Tooltip title={t('documentManager.action.processTooltip')}>
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    onClick={() => handleProcess(record)}
                    loading={isProcessing}
                  >
                    {t('documentManager.action.process')}
                  </Button>
                </Tooltip>
                <Dropdown
                  menu={{ items: processMenuItems }}
                  placement="bottomLeft"
                  trigger={['click']}
                >
                  <Button type="primary" icon={<DownOutlined />} />
                </Dropdown>
              </Space.Compact>

              {isConverted && (
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'markdown',
                        icon: <FileMarkdownOutlined />,
                        label: t('documentManager.action.viewMarkdown'),
                        onClick: () => handleViewMarkdown(record),
                      },
                      {
                        key: 'chunks',
                        icon: <ScissorOutlined />,
                        label: t('documentManager.action.viewChunks'),
                        onClick: () => handleViewChunks(record),
                        disabled: !isChunked,
                      },
                    ]
                  }}
                  trigger={['hover']}
                  placement="bottomLeft"
                >
                  <Tooltip title={t('documentManager.action.viewDocument')}>
                    <Button
                      type="text"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewMarkdown(record);
                      }}
                      style={{ color: '#1677ff' }}
                    >
                      <Space size={4}>
                        <FileMarkdownOutlined />
                        <DownOutlined style={{ fontSize: '10px' }} />
                      </Space>
                    </Button>
                  </Tooltip>
                </Dropdown>
              )}

              <Tooltip title={t('documentManager.action.delete')}>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record)}
                />
              </Tooltip>
            </Space>
          );
        },
      }
    );

    return baseColumns;
  };



  // 复选框选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys) => {
      setSelectedRowKeys(selectedKeys);
    },
    getCheckboxProps: (record) => ({
      disabled: false,
      name: record.name,
    }),
  };

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Search
            placeholder={t('documentManager.search.placeholder')}
            allowClear
            onSearch={handleSearch}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: 250 }}
          />
          <Select
            defaultValue="all"
            style={{ width: 120 }}
            onChange={handleFileTypeChange}
          >
            <Option value="all">{t('documentManager.filter.allTypes')}</Option>
            <Option value="pdf">PDF</Option>
            <Option value="docx">Word</Option>
            <Option value="xlsx">Excel</Option>
            <Option value="md">Markdown</Option>
          </Select>
        </div>

        <Space>
          {selectedRowKeys.length > 0 && (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'batch-process',
                    icon: <ThunderboltOutlined />,
                    label: t('documentManager.batch.process'),
                    onClick: () => handleBatchProcess(selectedRowKeys),
                  },
                  {
                    key: 'batch-download',
                    icon: <DownloadOutlined />,
                    label: t('documentManager.batch.download'),
                  },
                  {
                    type: 'divider' as const,
                  },
                  {
                    key: 'batch-delete',
                    icon: <DeleteOutlined />,
                    label: t('documentManager.batch.delete'),
                    danger: true,
                    onClick: () => handleBatchDelete(selectedRowKeys),
                  },
                ]
              }}
              placement="bottomRight"
            >
              <Button>
                {t('documentManager.modal.batchOpsLabel', { count: selectedRowKeys.length })} <DownOutlined />
              </Button>
            </Dropdown>
          )}
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} title={t('documentManager.button.refresh')}>{t('documentManager.button.refresh')}</Button>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={handleProcessAll}
            disabled={filteredDocuments.length === 0}
          >
            {t('documentManager.button.processAll')}
          </Button>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={handleOpenUploadDialog}
          >
            {t('documentManager.button.upload')}
          </Button>
        </Space>
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : (
        <Table
          rowSelection={rowSelection}
          columns={getColumns()}
          dataSource={filteredDocuments}
          rowKey="id"
          scroll={{ x: 'max-content' }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => t('documentManager.pagination.total', { total }),
          }}
        />
      )}

      {/* 批量上传对话框 */}
      <BatchUploadDialog
        visible={uploadDialogVisible}
        onClose={handleCloseUploadDialog}
        onUploadComplete={handleUploadComplete}
        defaultKnowledgeBaseId={selectedKnowledgeId !== 0 ? selectedKnowledgeId : null}
      />

      {/* 分段查看对话框 */}
      <Modal
        title={<span>{t('documentManager.modal.chunksTitle', { filename: currentFile?.name || '' })}</span>}
        open={chunksModalVisible}
        onCancel={() => {
          setChunksModalVisible(false);
          setChunksData([]);
          setCurrentFile(null);
        }}
        width={1000}
        footer={[
          <Button key="close" onClick={() => {
            setChunksModalVisible(false);
            setChunksData([]);
            setCurrentFile(null);
          }}>
            {t('documentManager.modal.close')}
          </Button>
        ]}
        style={{ top: 20 }}
      >
        {chunksLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : chunksData.length > 0 ? (
          <div style={{
            maxHeight: '70vh',
              overflowY: 'auto',
              padding: '16px',
            }}>
              <div style={{ marginBottom: '16px', color: 'var(--custom-text-secondary)' }}>
                {t('documentManager.modal.chunksTotal', { count: chunksData.length })}
              </div>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {chunksData.map((chunk, index) => (
                  <div
                    key={chunk.id || index}
                    style={{
                      padding: '16px',
                      backgroundColor: 'var(--custom-header-bg)',
                      borderRadius: '4px',
                      border: '1px solid var(--custom-border)',
                    }}
                  >
                    <div style={{
                      marginBottom: '8px',
                      color: 'var(--custom-text-secondary)',
                      fontSize: '12px',
                      fontWeight: '500',
                    }}>
                      {t('documentManager.modal.chunkIndex', { index: chunk.chunk_index !== undefined ? chunk.chunk_index + 1 : index + 1 })}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      lineHeight: '1.8',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: 'var(--custom-text)',
                    }}>
                      {chunk.content}
                    </div>
                  </div>
                ))}
              </Space>
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: 'var(--custom-text-secondary)'
            }}>
              {t('documentManager.modal.noChunks')}
            </div>
          )
        }
      </Modal>

      {/* Markdown 预览对话框 */}
      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '40px' }}>
            <span>{t('documentManager.modal.markdownTitle', { filename: currentFile?.name || '' })}</span>
            <Segmented
              value={markdownViewMode}
              onChange={setMarkdownViewMode}
              options={[
                { label: t('documentManager.modal.renderedView'), value: 'rendered', icon: <PreviewOutlined /> },
                { label: t('documentManager.modal.sourceView'), value: 'source', icon: <FileTextOutlined /> }
              ]}
            />
          </div>
        }
        open={markdownModalVisible}
        onCancel={() => {
          setMarkdownModalVisible(false);
          setMarkdownContent('');
          setCurrentFile(null);
        }}
        width={1000}
        footer={[
          <Button
            key="copy"
            icon={<CopyOutlined />}
            onClick={handleOpenCopyToWorkspace}
            disabled={!markdownContent || markdownLoading}
          >
            {t('documentManager.copyToWorkspace.button')}
          </Button>,
          <Button
            key="download"
            icon={<DownloadOutlined />}
            onClick={handleDownloadMarkdown}
            disabled={!markdownContent || markdownLoading}
          >
            {t('documentManager.modal.download')}
          </Button>,
          <Button key="close" onClick={() => {
            setMarkdownModalVisible(false);
            setMarkdownContent('');
            setCurrentFile(null);
          }}>
            {t('documentManager.modal.close')}
          </Button>
        ]}
        style={{ top: 20 }}
      >
        {markdownLoading ? (
          <Skeleton active paragraph={{ rows: 15 }} />
        ) : markdownContent ? (
          <div style={{
            maxHeight: '70vh',
              overflowY: 'auto',
              padding: '16px',
              backgroundColor: 'var(--custom-header-bg)',
              borderRadius: '4px',
              minHeight: '200px'
            }}>
              {markdownViewMode === 'rendered' ? (
                <MarkdownRenderer content={markdownContent} />
              ) : (
                <pre style={{
                  fontFamily: 'Monaco, Consolas, monospace',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'var(--custom-text)'
                }}>
                  {markdownContent}
                </pre>
              )}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: 'var(--custom-text-secondary)'
            }}>
              {t('documentManager.modal.noContent')}
            </div>
          )
        }
      </Modal>

      {/* 复制到工作空间对话框 */}
      <Modal
        title={t('documentManager.copyToWorkspace.title')}
        open={copyToWorkspaceModalVisible}
        onCancel={() => setCopyToWorkspaceModalVisible(false)}
        onOk={handleCopyToWorkspace}
        confirmLoading={copyLoading}
        okText={t('documentManager.copyToWorkspace.confirm')}
        cancelText={t('documentManager.copyToWorkspace.cancel')}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, color: 'var(--custom-text-secondary)' }}>
            {t('documentManager.copyToWorkspace.intro')}
          </div>
          <Select
            placeholder={t('documentManager.copyToWorkspace.placeholder')}
            style={{ width: '100%' }}
            value={selectedTaskId}
            onChange={setSelectedTaskId}
            showSearch
            optionFilterProp="children"
          >
            {actionTasks.map((task: any) => (
              <Option key={task.id} value={task.id}>
                {task.title || task.name || t('documentManager.copyToWorkspace.taskFallback', { id: task.id })}
              </Option>
            ))}
          </Select>
        </div>
      </Modal>
    </div>
  );
};

export default DocumentManager;
