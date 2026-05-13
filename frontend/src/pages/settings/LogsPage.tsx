import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Typography,
  Card,
  Button,
  Space,
  Input,
  Select,
  Spin,
  Divider,
  Row,
  Col,
  App
} from 'antd';
import {
  ReloadOutlined,
  DownloadOutlined,
  SearchOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignTopOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { logsAPI } from '../../services/api/logs';

const { Title, Text } = Typography;
const { Option } = Select;

const LogsPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileInfo, setFileInfo] = useState<any>({
    file_path: '',
    file_size: 0,
    total_lines: 0
  });
  const [filter, setFilter] = useState('');
  const [logLevel, setLogLevel] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [maxLines, setMaxLines] = useState(1000);
  const logContainerRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  // 格式化文件大小的辅助函数
  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // 获取日志数据的函数
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await logsAPI.tailLogs({ lines: maxLines });
      if (response.status === 'success') {
        setLogs(response.data.content);
        setFileInfo({
          file_path: response.data.file_path,
          file_size: formatFileSize(response.data.file_size),
          total_lines: Number(response.data.total_lines)
        });
      } else {
        message.error(`${t('logs.loadFailed')}: ${response.message}`);
      }
    } catch (error) {
      console.error('获取日志失败:', error);
      message.error(`${t('logs.loadFailed')}: ${error.message || t('message.unknownError')}`);
    } finally {
      setLoading(false);
    }
  }, [maxLines, message, formatFileSize]);

  // 获取日志
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // 当显示行数变化时重新获取日志
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 处理自动刷新
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchLogs();
      }, 5000); // 每5秒刷新一次
      refreshIntervalRef.current = interval;

      return () => {
        clearInterval(interval);
      };
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }
  }, [autoRefresh, fetchLogs]);

  // 日志内容更新后自动滚动到底部
  useEffect(() => {
    if (logs.length > 0 && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleRefresh = () => {
    fetchLogs();
  };

  const handleDownload = () => {
    // 创建一个Blob对象
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    // 创建一个a标签并模拟点击
    const a = document.createElement('a');
    a.href = url;
    a.download = 'app.log';
    document.body.appendChild(a);
    a.click();

    // 清理
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFilterChange = (e) => {
    setFilter(e.target.value);
  };

  const handleLogLevelChange = (value) => {
    setLogLevel(value);
  };

  const handleClearFilter = () => {
    setFilter('');
    setLogLevel('all');
  };

  const handleMaxLinesChange = (value) => {
    setMaxLines(value);
  };

  const handleScrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  const handleScrollToTop = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  // 过滤日志
  const filteredLogs = logs.filter(log => {
    // 应用文本过滤
    const textMatch = filter ? log.toLowerCase().includes(filter.toLowerCase()) : true;

    // 应用日志级别过滤
    let levelMatch = true;
    if (logLevel !== 'all') {
      levelMatch = log.includes(`[${logLevel.toUpperCase()}]`);
    }

    return textMatch && levelMatch;
  });

  // 获取日志行的样式
  const getLogLineStyle = (log) => {
    if (log.includes('[ERROR]') || log.includes('错误')) {
      return { color: '#ff4d4f' };
    } else if (log.includes('[WARNING]') || log.includes('警告')) {
      return { color: '#faad14' };
    } else if (log.includes('[INFO]')) {
      return { color: '#1677ff' };
    } else if (log.includes('[DEBUG]')) {
      return { color: '#52c41a' };
    }
    return {};
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20
        }}>
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>{t('logs.title')}</Title>
            <Text type="secondary">
              {t('logs.subtitle')}
            </Text>
          </div>
        </div>
      </div>

      <Card
        style={{
          borderRadius: '12px',
          boxShadow: 'var(--custom-shadow)',
          marginBottom: 0
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <Row gutter={[16, 12]}>
            <Col xs={24}>
              <Space wrap>
                <Input
                  placeholder={t('logs.search')}
                  value={filter}
                  onChange={handleFilterChange}
                  prefix={<SearchOutlined />}
                  allowClear
                />
                <Select
                  style={{ width: 120 }}
                  value={logLevel}
                  onChange={handleLogLevelChange}
                  placeholder={t('logs.logLevel')}
                >
                  <Option value="all">{t('logs.all')}</Option>
                  <Option value="debug">DEBUG</Option>
                  <Option value="info">INFO</Option>
                  <Option value="warning">WARNING</Option>
                  <Option value="error">ERROR</Option>
                </Select>
                <Select
                  style={{ width: 120 }}
                  value={maxLines}
                  onChange={handleMaxLinesChange}
                  placeholder={t('logs.maxLines')}
                >
                  <Option value={1000}>{t('logs.lines', { count: 1000 })}</Option>
                  <Option value={10000}>{t('logs.lines', { count: 10000 })}</Option>
                </Select>
              </Space>
            </Col>
            <Col xs={24}>
              <Space wrap>
                <Button
                  type={autoRefresh ? 'primary' : 'default'}
                  onClick={toggleAutoRefresh}
                  icon={<ReloadOutlined spin={autoRefresh} />}
                >
                  {autoRefresh ? t('logs.stopAutoRefresh') : t('logs.autoRefresh')}
                </Button>
                <Button
                  onClick={handleRefresh}
                  icon={<ReloadOutlined />}
                  loading={loading}
                >
                  {t('refresh')}
                </Button>
                <Button
                  onClick={handleDownload}
                  icon={<DownloadOutlined />}
                  disabled={logs.length === 0}
                >
                  {t('logs.download')}
                </Button>
                <Button
                  icon={<VerticalAlignTopOutlined />}
                  onClick={handleScrollToTop}
                >
                  {t('logs.scrollToTop')}
                </Button>
                <Button
                  icon={<VerticalAlignBottomOutlined />}
                  onClick={handleScrollToBottom}
                >
                  {t('logs.scrollToBottom')}
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        <div style={{ marginBottom: '16px' }}>
          <Space split={<span style={{ color: 'var(--custom-border-color)', margin: '0 8px' }}>|</span>}>
            <span><Text strong>{t('logs.filePath')}:</Text> <Text>{fileInfo.file_path}</Text></span>
            <span><Text strong>{t('logs.fileSize')}:</Text> <Text>{fileInfo.file_size}</Text></span>
            <span><Text strong>{t('logs.totalLines')}:</Text> <Text>{fileInfo.total_lines}</Text></span>
            <span><Text strong>{t('logs.loadedLines')}:</Text> <Text>{logs.length}</Text></span>
            <span><Text strong>{t('logs.filteredLines')}:</Text> <Text>{filteredLogs.length}</Text></span>
          </Space>
        </div>

        <div
          ref={logContainerRef}
          style={{
            height: '70vh',
            overflow: 'auto',
            backgroundColor: 'var(--custom-hover-bg)',
            padding: '12px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '12px',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            minHeight: '400px'
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Spin>
                <div style={{ padding: '20px' }}>{t('logs.loading')}</div>
              </Spin>
            </div>
          ) : filteredLogs.length > 0 ? (
            filteredLogs.map((log, index) => (
              <div key={index} style={getLogLineStyle(log)}>
                {log}
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Text type="secondary">{t('logs.noMatches')}</Text>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default LogsPage;
