import React, { useState, useEffect } from 'react';
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
        console.log('获取到的文件列表:', response.data);
        console.log('第一个文件的转换状态:', response.data[0]?.conversion_status);
        console.log('第一个文件的完整数据:', JSON.stringify(response.data[0], null, 2));
        setDocuments(response.data);
      } else {
        message.error(response.message || '获取文件列表失败');
        setDocuments([]);
      }
    } catch (error) {
      console.error('获取文件列表失败:', error);
      message.error('获取文件列表失败');
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
      message.success(`成功上传 ${successCount} 个文件`);
    }
    if (failCount > 0) {
      message.error(`${failCount} 个文件上传失败`);
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
      message.error('无法确定文件所属的知识库');
      return;
    }

    modal.confirm({
      title: '确认删除文档',
      content: `确定要删除文档 "${filename}" 吗？删除后无法恢复。`,
      okText: '确定删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const response = await knowledgeAPI.deleteFile(knowledgeId, filename);
          if (response.success) {
            message.success('文档删除成功');
            fetchDocuments(selectedKnowledgeId); // 重新获取文件列表
          } else {
            message.error(response.message || '删除文档失败');
          }
        } catch (error) {
          console.error('删除文档失败:', error);
          message.error('删除文档失败');
        }
      }
    });
  };

  // 处理文件转换
  const handleConvert = async (record) => {
    const knowledgeId = selectedKnowledgeId === 0 ? record.knowledge_id : selectedKnowledgeId;

    if (!knowledgeId) {
      message.error('无法确定文件所属的知识库');
      return;
    }

    // 如果已有任何处理数据，提示会清理
    if (record.conversion_status === 'converted' || 
        record.chunking_status === 'chunked' || 
        record.embedding_status === 'embedded') {
      // 根据当前状态决定提示内容
      let content = '重新转换将清除当前的转换结果';
      if (record.chunking_status === 'chunked') {
        content += '、分段数据';
      }
      if (record.embedding_status === 'embedded') {
        content += '和向量嵌入';
      }
      content += '，是否继续？';
      
      modal.confirm({
        title: '确认重新转换',
        content: content,
        okText: '继续',
        cancelText: '取消',
        onOk: async () => {
          await executeConvert(knowledgeId, record);
        }
      });
    } else {
      // 未转换的文档直接执行
      await executeConvert(knowledgeId, record);
    }
  };

  const executeConvert = async (knowledgeId, record) => {
    const filePath = record.path || record.name; // 用于状态跟踪的显示名称
    try {
      setConvertingFiles(prev => new Set(prev).add(filePath));

      const response = await knowledgeAPI.convertFile(knowledgeId, record.id);

      if (response.success) {
        message.success('文件转换任务已创建，正在后台处理...');

        // 立即刷新文档列表以显示状态变化
        fetchDocuments(selectedKnowledgeId);

        // 轮询检查转换状态
        const checkStatus = async () => {
          try {
            const statusResponse = await knowledgeAPI.getConversionStatus(knowledgeId, record.id);

            if (statusResponse.success) {
              const status = statusResponse.data.status;
              console.log('转换状态:', status, statusResponse.data);

              if (status === 'converted') {
                message.success('文件转换完成！');
                setConvertingFiles(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(filePath);
                  return newSet;
                });
                // 刷新文档列表以更新转换状态
                fetchDocuments(selectedKnowledgeId);
              } else if (status === 'conversion_failed') {
                message.error(`文件转换失败: ${statusResponse.data.error_message || '未知错误'}`);
                setConvertingFiles(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(filePath);
                  return newSet;
                });
                // 刷新文档列表以更新转换状态
                fetchDocuments(selectedKnowledgeId);
              } else if (status === 'converting') {
                // 继续轮询（5秒间隔，降低频率）
                setTimeout(checkStatus, 5000);
              }
            }
          } catch (error) {
            console.error('检查转换状态失败:', error);
            setConvertingFiles(prev => {
              const newSet = new Set(prev);
              newSet.delete(filePath);
              return newSet;
            });
          }
        };

        // 开始轮询（首次2秒后启动）
        setTimeout(checkStatus, 2000);
      } else {
        message.error(response.message || '创建转换任务失败');
        setConvertingFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(filePath);
          return newSet;
        });
      }
    } catch (error) {
      console.error('文件转换失败:', error);
      message.error('文件转换失败');
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
      message.error('无法确定文件所属的知识库');
      return;
    }

    // 打开 Modal 并设置加载状态
    setChunksModalVisible(true);
    setCurrentFile(record);
    setChunksLoading(true);

    try {
      const response = await knowledgeAPI.getFileChunks(knowledgeId, record.id);

      if (response.success) {
        setChunksData(response.data.chunks || []);
      } else {
        message.error(response.message || '获取分段数据失败');
        setChunksModalVisible(false);
        setChunksData([]);
        setCurrentFile(null);
      }
    } catch (error) {
      console.error('获取分段数据失败:', error);
      message.error('获取分段数据失败');
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
      message.error('无法确定文件所属的知识库');
      return;
    }

    // 打开 Modal 并设置加载状态
    setMarkdownModalVisible(true);
    setCurrentFile(record);
    setMarkdownLoading(true);
    setMarkdownViewMode('rendered'); // 重置为渲染视图

    try {
      const response = await knowledgeAPI.getMarkdownContent(knowledgeId, record.id);

      if (response.success) {
        setMarkdownContent(response.data.content);
      } else {
        message.error(response.message || '获取 Markdown 内容失败');
        setMarkdownModalVisible(false);
        setMarkdownContent('');
        setCurrentFile(null);
      }
    } catch (error) {
      console.error('获取 Markdown 内容失败:', error);
      message.error('获取 Markdown 内容失败');
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
      message.error('无法确定文件所属的知识库');
      return;
    }

    // 如果未转换，提示需要先转换
    if (record.conversion_status !== 'converted') {
      message.warning('请先转换文档为Markdown格式');
      return;
    }

    // 如果已分段或已嵌入，提示会清理数据
    if (record.chunking_status === 'chunked' || record.embedding_status === 'embedded') {
      modal.confirm({
        title: '确认重新分段',
        content: '重新分段将清除当前的分段数据和向量嵌入，是否继续？',
        okText: '继续',
        cancelText: '取消',
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
        message.success('文件分段任务已创建，正在后台处理...');
        
        // 立即刷新文档列表以显示状态变化
        fetchDocuments(selectedKnowledgeId);
        
        // 轮询检查分段状态
        const checkStatus = async () => {
          try {
            const statusResponse = await knowledgeAPI.getChunkingStatus(knowledgeId, record.id);
            
            if (statusResponse.success) {
              const status = statusResponse.data.status;
              
              if (status === 'chunked') {
                message.success('文件分段完成！');
                fetchDocuments(selectedKnowledgeId);
              } else if (status === 'chunking_failed') {
                message.error(`文件分段失败: ${statusResponse.data.error_message || '未知错误'}`);
                fetchDocuments(selectedKnowledgeId);
              } else if (status === 'chunking') {
                // 继续轮询（5秒间隔，降低频率）
                setTimeout(checkStatus, 5000);
              }
            }
          } catch (error) {
            console.error('检查分段状态失败:', error);
          }
        };
        
        setTimeout(checkStatus, 2000);
      } else {
        message.error(response.message || '创建分段任务失败');
      }
    } catch (error) {
      console.error('文件分段失败:', error);
      message.error('文件分段失败');
    }
  };

  // 处理文件嵌入
  const handleEmbed = async (record) => {
    const knowledgeId = selectedKnowledgeId === 0 ? record.knowledge_id : selectedKnowledgeId;
    
    if (!knowledgeId) {
      message.error('无法确定文件所属的知识库');
      return;
    }

    // 如果未分段，提示需要先分段
    if (record.chunking_status !== 'chunked') {
      message.warning('请先对文档进行分段处理');
      return;
    }

    // 如果已嵌入，提示会重新生成
    if (record.embedding_status === 'embedded') {
      modal.confirm({
        title: '确认重新生成嵌入',
        content: '重新生成向量嵌入将替换当前的向量数据，是否继续？',
        okText: '继续',
        cancelText: '取消',
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
        message.success('向量嵌入任务已创建，正在后台处理...');
        
        // 立即刷新文档列表以显示状态变化
        fetchDocuments(selectedKnowledgeId);
        
        // 轮询检查嵌入状态
        const checkStatus = async () => {
          try {
            const statusResponse = await knowledgeAPI.getEmbeddingStatus(knowledgeId, record.id);
            
            if (statusResponse.success) {
              const status = statusResponse.data.status;
              
              if (status === 'embedded') {
                message.success('向量嵌入完成！');
                fetchDocuments(selectedKnowledgeId);
              } else if (status === 'embedding_failed') {
                message.error(`向量嵌入失败: ${statusResponse.data.error_message || '未知错误'}`);
                fetchDocuments(selectedKnowledgeId);
              } else if (status === 'embedding') {
                // 继续轮询（5秒间隔，降低频率）
                setTimeout(checkStatus, 5000);
              }
            }
          } catch (error) {
            console.error('检查嵌入状态失败:', error);
          }
        };
        
        setTimeout(checkStatus, 2000);
      } else {
        message.error(response.message || '创建嵌入任务失败');
      }
    } catch (error) {
      console.error('向量嵌入失败:', error);
      message.error('向量嵌入失败');
    }
  };

  // 处理一键处理（完整流程）
  const handleProcess = async (record) => {
    const knowledgeId = selectedKnowledgeId === 0 ? record.knowledge_id : selectedKnowledgeId;
    const filePath = record.path || record.name;
    
    if (!knowledgeId) {
      message.error('无法确定文件所属的知识库');
      return;
    }

    // 显示确认弹窗
    const hasProcessing = record.conversion_status === 'converted' || 
                         record.chunking_status === 'chunked' || 
                         record.embedding_status === 'embedded';
    
    modal.confirm({
      title: hasProcessing ? '确认重新处理' : '确认处理文档',
      content: hasProcessing 
        ? '将重新执行完整的处理流程（转换→分段→嵌入），清除所有现有数据，是否继续？'
        : '将执行完整的处理流程：转换→分段→嵌入，是否继续？',
      okText: '继续',
      cancelText: '取消',
      onOk: async () => {
        await executeProcess(knowledgeId, filePath, record);
      }
    });
  };

  const executeProcess = async (knowledgeId, filePath, record) => {
    try {
      const response = await knowledgeAPI.processFile(knowledgeId, record.id);
      
      if (response.success) {
        message.success('文档处理流水线已启动，正在后台执行（转换→分段→嵌入）...');
        
        const jobId = response.data?.job_id;
        if (!jobId) {
          message.warning('未获取到Job ID，请手动刷新查看处理进度');
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
              message.success('文档处理流水线完成！');
              // 只在完成时刷新列表以获取完整数据
              fetchDocuments(selectedKnowledgeId);
            } else if (jobStatus.status === 'failed') {
              const errorMsg = jobStatus.error || '未知错误';
              message.error(`文档处理失败: ${errorMsg}`);
              // 失败时也刷新列表
              fetchDocuments(selectedKnowledgeId);
            } else if (jobStatus.status === 'running' || jobStatus.status === 'pending') {
              // 显示进度（运行中不刷新列表，只更新状态）
              const progressMsg = jobStatus.message || '处理中...';
              console.log(`Pipeline进度: ${jobStatus.progress}% - ${progressMsg}`);
              setTimeout(checkStatus, 5000);
            } else {
              // 未知状态，继续轮询
              setTimeout(checkStatus, 5000);
            }
          } catch (error) {
            console.error('检查Pipeline状态失败:', error);
            // 出错时也继续轮询，避免误判
            setTimeout(checkStatus, 5000);
          }
        };
        
        setTimeout(checkStatus, 1000);
      } else {
        message.error(response.message || '创建处理任务失败');
      }
    } catch (error) {
      console.error('文档处理失败:', error);
      message.error('文档处理失败');
    }
  };

  // 处理下载Markdown文件
  const handleDownloadMarkdown = () => {
    if (!markdownContent || !currentFile) {
      message.error('没有可下载的内容');
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
    
    message.success('Markdown文件下载成功');
  };

  // 打开复制到工作空间对话框
  const handleOpenCopyToWorkspace = async () => {
    if (!currentFile) {
      message.error('请先选择文件');
      return;
    }
    
    try {
      // 获取行动任务列表，过滤掉并行实验克隆的任务
      const tasks = await actionTaskAPI.getAll();
      const filteredTasks = tasks.filter((task: any) => !task.is_experiment_clone);
      setActionTasks(filteredTasks);
      setSelectedTaskId(null);
      setCopyToWorkspaceModalVisible(true);
    } catch (error) {
      console.error('获取行动任务列表失败:', error);
      message.error('获取行动任务列表失败');
    }
  };

  // 执行复制到工作空间
  const handleCopyToWorkspace = async () => {
    if (!selectedTaskId) {
      message.error('请选择目标行动任务');
      return;
    }
    
    if (!currentFile) {
      message.error('请先选择文件');
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
        message.success(`已复制到工作空间: ${response.data?.file_path || ''}`);
        setCopyToWorkspaceModalVisible(false);
      } else {
        message.error(response.message || '复制失败');
      }
    } catch (error) {
      console.error('复制到工作空间失败:', error);
      message.error('复制到工作空间失败');
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
      console.error('检查转换状态失败:', error);
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
      message.warning('请至少选择一个文件');
      return;
    }

    modal.confirm({
      title: '确认批量处理',
      content: `确定要处理选中的 ${fileIds.length} 个文档吗？将执行完整的处理流程（转换→分段→嵌入）`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        for (const fileId of fileIds) {
          const record = documents.find(doc => doc.id === fileId);
          if (record) {
            await executeProcess(selectedKnowledgeId, record.path || record.name, record);
          }
        }
        message.success(`已启动 ${fileIds.length} 个文档的处理任务`);
        setSelectedRowKeys([]);
      }
    });
  };

  // 处理全部文档
  const handleProcessAll = async () => {
    if (filteredDocuments.length === 0) {
      message.warning('没有可处理的文档');
      return;
    }

    modal.confirm({
      title: '确认处理全部',
      content: `确定要处理全部 ${filteredDocuments.length} 个文档吗？将执行完整的处理流程（转换→分段→嵌入）`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        for (const record of filteredDocuments) {
          await executeProcess(selectedKnowledgeId, record.path || record.name, record);
        }
        message.success(`已启动全部 ${filteredDocuments.length} 个文档的处理任务`);
      }
    });
  };

  // 批量删除文档
  const handleBatchDelete = async (fileIds) => {
    if (!fileIds || fileIds.length === 0) {
      message.warning('请至少选择一个文件');
      return;
    }

    modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${fileIds.length} 个文档吗？删除后无法恢复。`,
      okText: '确定删除',
      cancelText: '取消',
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
              console.error('删除文档失败:', error);
              failCount++;
            }
          }
        }

        if (successCount > 0) {
          message.success(`成功删除 ${successCount} 个文档`);
        }
        if (failCount > 0) {
          message.error(`${failCount} 个文档删除失败`);
        }

        fetchDocuments(selectedKnowledgeId);
        setSelectedRowKeys([]);
      }
    });
  };

  // 动态生成列定义，当显示所有知识库时添加"所属知识库"列
  const getColumns = () => {
    const baseColumns: any[] = [
      {
        title: '文件名',
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

    // 如果显示所有知识库，添加"所属知识库"列
    if (selectedKnowledgeId === 0) {
      baseColumns.push({
        title: '所属知识库',
        dataIndex: 'knowledge_name',
        key: 'knowledge_name',
        width: 150,
        render: (text) => (
          <Tag color="blue">{text}</Tag>
        ),
      });
    }

    // 添加其他列
    baseColumns.push(
      {
        title: '大小',
        dataIndex: 'size',
        key: 'size',
        width: 100,
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status, record) => {
          const statusMap = {
            'pending': { text: '未处理', color: 'default' },
            'processing': { text: '处理中', color: 'processing' },
            'completed': { text: '已处理', color: 'success' },
            'failed': { text: '错误', color: 'error' }
          };
          
          const config = statusMap[status] || { text: '未处理', color: 'default' };
          
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
        title: '转换状态',
        dataIndex: 'conversion_status',
        key: 'conversion_status',
        width: 120,
        render: (status, record) => {
          const statusMap = {
            'not_converted': { text: '未转换', color: 'default' },
            'converting': { text: '转换中', color: 'processing' },
            'converted': { text: '已转换', color: 'success' },
            'conversion_failed': { text: '转换失败', color: 'error' }
          };
          // 处理缺失值：如果状态为 null/undefined/空字符串，默认为 not_converted
          const actualStatus = status || 'not_converted';
          const config = statusMap[actualStatus] || { text: '未转换', color: 'default' };
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      {
        title: '分段状态',
        dataIndex: 'chunking_status',
        key: 'chunking_status',
        width: 120,
        render: (status) => {
          const statusMap = {
            'not_chunked': { text: '未分段', color: 'default' },
            'chunking': { text: '分段中', color: 'processing' },
            'chunked': { text: '已分段', color: 'success' },
            'chunking_failed': { text: '分段失败', color: 'error' }
          };
          // 处理缺失值：如果状态为 null/undefined/空字符串，默认为 not_chunked
          const actualStatus = status || 'not_chunked';
          const config = statusMap[actualStatus] || { text: '未分段', color: 'default' };
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      {
        title: '嵌入状态',
        dataIndex: 'embedding_status',
        key: 'embedding_status',
        width: 120,
        render: (status) => {
          const statusMap = {
            'not_embedded': { text: '未嵌入', color: 'default' },
            'embedding': { text: '嵌入中', color: 'processing' },
            'embedded': { text: '已嵌入', color: 'success' },
            'embedding_failed': { text: '嵌入失败', color: 'error' }
          };
          // 处理缺失值：如果状态为 null/undefined/空字符串，默认为 not_embedded
          const actualStatus = status || 'not_embedded';
          const config = statusMap[actualStatus] || { text: '未嵌入', color: 'default' };
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      {
        title: '分块数',
        dataIndex: 'chunks',
        key: 'chunks',
        width: 100,
      },
      {
        title: 'Token数',
        dataIndex: 'tokens',
        key: 'tokens',
        width: 100,
      },
      {
        title: '上传时间',
        dataIndex: 'upload_time',
        key: 'upload_time',
        render: (date) => new Date(date).toLocaleString(),
      },
      {
        title: '操作',
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
              label: '转换',
              onClick: () => handleConvert(record),
            },
            {
              key: 'chunk',
              icon: <ScissorOutlined />,
              label: '分段',
              onClick: () => handleChunk(record),
              disabled: !isConverted,
            },
            {
              key: 'embed',
              icon: <DatabaseOutlined />,
              label: '嵌入',
              onClick: () => handleEmbed(record),
              disabled: !isChunked,
            },
          ];

          return (
            <Space>
              <Space.Compact>
                <Tooltip title="一键处理（转换→分段→嵌入）">
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    onClick={() => handleProcess(record)}
                    loading={isProcessing}
                  >
                    处理
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
                        label: '查看Markdown',
                        onClick: () => handleViewMarkdown(record),
                      },
                      {
                        key: 'chunks',
                        icon: <ScissorOutlined />,
                        label: '查看分段',
                        onClick: () => handleViewChunks(record),
                        disabled: !isChunked,
                      },
                    ]
                  }}
                  trigger={['hover']}
                  placement="bottomLeft"
                >
                  <Tooltip title="查看文档">
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
              
              <Tooltip title="删除文档">
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
            placeholder="搜索文件名"
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
            <Option value="all">所有类型</Option>
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
                    label: '批量处理',
                    onClick: () => handleBatchProcess(selectedRowKeys),
                  },
                  {
                    key: 'batch-download',
                    icon: <DownloadOutlined />,
                    label: '批量下载',
                  },
                  {
                    type: 'divider' as const,
                  },
                  {
                    key: 'batch-delete',
                    icon: <DeleteOutlined />,
                    label: '批量删除',
                    danger: true,
                    onClick: () => handleBatchDelete(selectedRowKeys),
                  },
                ]
              }}
              placement="bottomRight"
            >
              <Button>
                批量操作（{selectedRowKeys.length}） <DownOutlined />
              </Button>
            </Dropdown>
          )}
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} title="刷新">刷新</Button>
          <Button 
            icon={<ThunderboltOutlined />}
            onClick={handleProcessAll}
            disabled={filteredDocuments.length === 0}
          >
            处理全部
          </Button>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={handleOpenUploadDialog}
          >
            上传文件
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
            showTotal: (total) => `共 ${total} 个文档`,
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
        title={<span>分段查看 - {currentFile?.name || ''}</span>}
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
            关闭
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
                共 {chunksData.length} 个分段
              </div>
              <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
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
                      分段 #{chunk.chunk_index !== undefined ? chunk.chunk_index + 1 : index + 1}
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
              暂无分段数据
            </div>
          )
        }
      </Modal>

      {/* Markdown 预览对话框 */}
      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '40px' }}>
            <span>Markdown 预览 - {currentFile?.name || ''}</span>
            <Segmented
              value={markdownViewMode}
              onChange={setMarkdownViewMode}
              options={[
                { label: '渲染视图', value: 'rendered', icon: <PreviewOutlined /> },
                { label: '原文', value: 'source', icon: <FileTextOutlined /> }
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
            复制到工作空间
          </Button>,
          <Button 
            key="download" 
            icon={<DownloadOutlined />}
            onClick={handleDownloadMarkdown}
            disabled={!markdownContent || markdownLoading}
          >
            下载
          </Button>,
          <Button key="close" onClick={() => {
            setMarkdownModalVisible(false);
            setMarkdownContent('');
            setCurrentFile(null);
          }}>
            关闭
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
              暂无内容
            </div>
          )
        }
      </Modal>

      {/* 复制到工作空间对话框 */}
      <Modal
        title="复制到行动任务工作空间"
        open={copyToWorkspaceModalVisible}
        onCancel={() => setCopyToWorkspaceModalVisible(false)}
        onOk={handleCopyToWorkspace}
        confirmLoading={copyLoading}
        okText="复制"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, color: 'var(--custom-text-secondary)' }}>
            将 Markdown 文件复制到选定行动任务的工作空间中
          </div>
          <Select
            placeholder="请选择目标行动任务"
            style={{ width: '100%' }}
            value={selectedTaskId}
            onChange={setSelectedTaskId}
            showSearch
            optionFilterProp="children"
          >
            {actionTasks.map((task: any) => (
              <Option key={task.id} value={task.id}>
                {task.title || task.name || `任务 ${task.id}`}
              </Option>
            ))}
          </Select>
        </div>
      </Modal>
    </div>
  );
};

export default DocumentManager;
