/**
 * 文件处理相关的工具函数
 */
import React from 'react';
import {
  FileTextOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FileMarkdownOutlined,
  FileUnknownOutlined
} from '@ant-design/icons';

// 推荐的文件扩展名（常用的知识库文件类型）
export const RECOMMENDED_EXTENSIONS = ['txt', 'pdf', 'doc', 'docx', 'md', 'json'];

// 所有允许的文件扩展名（现在允许所有类型）
export const ALLOWED_EXTENSIONS = null; // null 表示允许所有文件类型

/**
 * 验证文件类型是否被允许
 * @param {File|string} file - 文件对象或文件名
 * @returns {boolean} 是否允许的文件类型
 */
export const validateFileType = (file) => {
  const filename = typeof file === 'string' ? file : file.name;
  const fileExt = filename.split('.').pop()?.toLowerCase();

  // 现在允许所有有扩展名的文件
  return fileExt && fileExt.length > 0;
};

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 文件扩展名（小写）
 */
export const getFileExtension = (filename) => {
  return filename.split('.').pop()?.toLowerCase() || '';
};

/**
 * 格式化文件大小
 * @param {number} bytes - 文件大小（字节）
 * @returns {string} 格式化后的文件大小
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
export const generateUniqueId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

/**
 * 获取支持的文件类型描述
 * @returns {string} 支持的文件类型描述
 */
export const getSupportedFileTypesDescription = () => {
  return `支持所有文件类型。推荐类型：${RECOMMENDED_EXTENSIONS.map(ext => ext.toUpperCase()).join('、')}`;
};

/**
 * 获取文件accept属性值
 * @returns {string} accept属性值 - 返回undefined表示接受所有文件类型
 */
export const getFileAcceptString = () => {
  return undefined; // 返回undefined表示接受所有文件类型，避免空字符串导致的问题
};

/**
 * 获取文件图标
 * @param {string} filename - 文件名或文件类型
 * @returns {React.Element} 文件图标组件
 */
export const getFileIcon = (filename) => {
  const ext = getFileExtension(filename);

  switch (ext) {
    case 'pdf':
      return <FilePdfOutlined style={{ color: '#f5222d' }} />;
    case 'doc':
    case 'docx':
      return <FileWordOutlined style={{ color: '#1677ff' }} />;
    case 'xls':
    case 'xlsx':
      return <FileExcelOutlined style={{ color: '#52c41a' }} />;
    case 'md':
    case 'markdown':
      return <FileMarkdownOutlined style={{ color: '#722ed1' }} />;
    case 'txt':
    case 'text':
    case 'log':
      return <FileTextOutlined style={{ color: 'var(--custom-text-secondary)' }} />;
    case 'json':
    case 'xml':
    case 'yaml':
    case 'yml':
    case 'csv':
      return <FileTextOutlined style={{ color: '#fa8c16' }} />;
    case 'html':
    case 'htm':
    case 'css':
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'py':
    case 'java':
    case 'cpp':
    case 'c':
    case 'h':
    case 'php':
    case 'rb':
    case 'go':
    case 'rs':
    case 'sql':
      return <FileTextOutlined style={{ color: '#13c2c2' }} />;
    default:
      return <FileUnknownOutlined style={{ color: 'var(--custom-text-secondary)' }} />;
  }
};
