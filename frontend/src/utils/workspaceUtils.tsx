import React from 'react';
import { 
  FolderOutlined, 
  FileTextOutlined, 
  FileMarkdownOutlined,
  FileOutlined,
  CodeOutlined,
  PictureOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  FileZipOutlined,
  VideoCameraOutlined,
  AudioOutlined
} from '@ant-design/icons';

/**
 * 根据文件扩展名获取对应的图标
 */
export const getFileIcon = (fileName, isDirectory = false) => {
  if (isDirectory) {
    return <FolderOutlined style={{ color: '#1677ff', fontSize: '16px' }} />;
  }

  const extension = fileName.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'md':
    case 'markdown':
      return <FileMarkdownOutlined style={{ color: '#1677ff', fontSize: '16px' }} />;
    
    case 'txt':
    case 'log':
      return <FileTextOutlined style={{ color: '#52c41a', fontSize: '16px' }} />;
    
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'json':
      return <CodeOutlined style={{ color: '#faad14', fontSize: '16px' }} />;
    
    case 'py':
    case 'java':
    case 'cpp':
    case 'c':
    case 'h':
    case 'cs':
    case 'php':
    case 'rb':
    case 'go':
    case 'rs':
      return <CodeOutlined style={{ color: '#722ed1', fontSize: '16px' }} />;
    
    case 'html':
    case 'htm':
    case 'xml':
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return <CodeOutlined style={{ color: '#eb2f96', fontSize: '16px' }} />;
    
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'bmp':
    case 'svg':
    case 'webp':
      return <PictureOutlined style={{ color: '#13c2c2', fontSize: '16px' }} />;
    
    case 'pdf':
      return <FilePdfOutlined style={{ color: '#f5222d', fontSize: '16px' }} />;
    
    case 'doc':
    case 'docx':
      return <FileWordOutlined style={{ color: '#1677ff', fontSize: '16px' }} />;
    
    case 'xls':
    case 'xlsx':
      return <FileExcelOutlined style={{ color: '#52c41a', fontSize: '16px' }} />;
    
    case 'ppt':
    case 'pptx':
      return <FilePptOutlined style={{ color: '#fa8c16', fontSize: '16px' }} />;
    
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return <FileZipOutlined style={{ color: '#722ed1', fontSize: '16px' }} />;
    
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'wmv':
    case 'flv':
    case 'mkv':
      return <VideoCameraOutlined style={{ color: '#fa541c', fontSize: '16px' }} />;
    
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'aac':
    case 'ogg':
      return <AudioOutlined style={{ color: '#eb2f96', fontSize: '16px' }} />;
    
    default:
      return <FileOutlined style={{ color: 'var(--custom-text-secondary)', fontSize: '16px' }} />;
  }
};

/**
 * 获取文件显示名称（友好名称，用作副标题）
 */
export const getDisplayName = (fileName, isDirectory = false, agentInfo = {}) => {
  if (isDirectory) {
    // 对于Agent-X目录，显示智能体名称
    if (fileName.startsWith('Agent-')) {
      // 提取完整的UUID（Agent-后面的所有内容）
      const agentId = fileName.substring(6); // 'Agent-'.length = 6
      const agent = agentInfo[agentId];
      // 确保agent对象存在且有必要的属性
      if (agent && agent.name && agent.role_name) {
        return `${agent.name}[${agent.role_name}]`;
      }
      return `智能体 ${agentId.substring(0, 8)}...`; // 显示UUID前8位加省略号
    }
    return null; // 其他目录不显示副标题
  }

  // 根据文件名设置显示名称
  if (fileName === 'ProjectIndex.md') {
    return '项目索引';
  } else if (fileName === 'ProjectSummary.md') {
    return '项目总结';
  } else if (fileName === 'AgentWorkspace.md') {
    return '智能体工作空间';
  } else if (fileName.startsWith('AgentWorkspace_')) {
    return fileName.replace('AgentWorkspace_', '').replace('.md', '') + ' 的工作空间';
  }
  // 对于其他文件，返回null表示不显示副标题
  return null;
};

/**
 * 格式化文件大小
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * 处理文件数据，添加显示名称和图标
 */
export const processFileData = (data, agentInfo = {}) => {
  if (!data.items || data.items.length === 0) {
    return [];
  }

  return data.items.map(item => ({
    key: item.file_name,
    ...item,
    display_name: getDisplayName(item.file_name, item.is_directory, agentInfo),
    isDirectory: item.is_directory,
    size: item.is_directory ? '' : formatFileSize(item.size || 0),
    updated_at: item.modified_time ? new Date(item.modified_time * 1000).toISOString() : new Date().toISOString(),
    icon: getFileIcon(item.file_name, item.is_directory)
  }));
};
