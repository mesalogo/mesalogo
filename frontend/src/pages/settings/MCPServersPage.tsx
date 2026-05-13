import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Button, Table, Space, Modal, Form, Input,
  Typography, Tag, Switch, Collapse,
  Input as AntInput, Spin, List, Descriptions, Radio, App, Tooltip
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  PlayCircleOutlined, PauseCircleOutlined, CodeOutlined,
  SaveOutlined, ToolOutlined,
  FormatPainterOutlined, CopyOutlined,
  SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import Editor from '@monaco-editor/react';
import api from '../../services/api/axios';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = AntInput;

const MCPServersPage = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [form] = Form.useForm();
  const [configVisible, setConfigVisible] = useState(false);
  const [configContent, setConfigContent] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [serverTools, setServerTools] = useState({});
  const [loadingTools, setLoadingTools] = useState({});
  const [currentCommType, setCurrentCommType] = useState('stdio'); // 添加状态来跟踪当前通信方式
  const [operatingServers, setOperatingServers] = useState<Record<string, 'enabling' | 'disabling'>>({}); // 跟踪正在操作的服务器

  // 辅助常量和函数 - 遵循KISS原则
  const URL_BASED_COMM_TYPES = ['http', 'sse', 'streamable_http'];
  const isUrlBasedCommType = (commType) => URL_BASED_COMM_TYPES.includes(commType);

  // 获取MCP服务器工具列表
  const fetchServerTools = useCallback(async (serverId, refresh = false) => {
    setLoadingTools(prev => ({ ...prev, [serverId]: true }));
    try {
      // 使用环境变量中的API URL
      console.log(`正在获取服务器 ${serverId} 的工具列表${refresh ? '(强制刷新)' : ''}`);
      // 添加refresh参数，指示后端是否强制刷新缓存
      const response = await api.post(`/mcp/tools/${serverId}`, { refresh });

      // 设置工具列表 - 处理MCP标准格式
      if (response.data) {
        // 如果响应是数组，则直接作为工具列表使用
        if (Array.isArray(response.data)) {
          setServerTools(prev => ({
            ...prev,
            [serverId]: response.data
          }));
          console.log(`获取到服务器 ${serverId} 的工具列表:`, response.data);
        }
        // 如果响应含有tools属性，使用旧格式处理
        else if (response.data.tools) {
          setServerTools(prev => ({
            ...prev,
            [serverId]: response.data.tools
          }));
          console.log(`获取到服务器 ${serverId} 的工具列表:`, response.data.tools);
        }
        else {
          console.warn(`获取到的服务器 ${serverId} 的工具列表格式不支持:`, response.data);
          message.warning(t('mcpServers.tools.formatUnsupported', { id: serverId }));
        }
      } else {
        console.warn(`获取到的服务器 ${serverId} 的工具列表为空`);
        message.warning(t('mcpServers.tools.empty', { id: serverId }));
      }
    } catch (error) {
      console.error(`获取服务器 ${serverId} 的工具列表失败:`, error);
      message.error(t('mcpServers.tools.loadFailed', { id: serverId, error: error.message }));
    } finally {
      setLoadingTools(prev => ({ ...prev, [serverId]: false }));
    }
  }, [message, setLoadingTools, setServerTools, t]);

  // 对服务器列表进行排序：已启用的在前，未启用的在后，每组内按名称排序
  const sortServers = (serverList) => {
    return [...serverList].sort((a, b) => {
      const aEnabled = a.enabled !== undefined ? a.enabled : (a.status === 'running');
      const bEnabled = b.enabled !== undefined ? b.enabled : (b.status === 'running');
      
      // 先按启用状态排序（已启用在前）
      if (aEnabled !== bEnabled) {
        return aEnabled ? -1 : 1;
      }
      // 同组内按名称排序
      return a.id.localeCompare(b.id);
    });
  };

  // 获取服务器列表
  const fetchServers = useCallback(async (refreshTools = true) => {
    setLoading(true);
    try {
      console.log('正在请求MCP服务器列表');
      const response = await api.get('/mcp/servers');
      setServers(sortServers(response.data));
      console.log('获取到MCP服务器列表:', response.data);

      // 只有当明确要求刷新工具列表时才刷新
      // 这样在展开/收起工具时就不会触发不必要的刷新
      if (refreshTools && expandedRowKeys.length > 0) {
        expandedRowKeys.forEach(serverId => {
          fetchServerTools(serverId, false); // 使用false参数，避免强制刷新
        });
      }
    } catch (error) {
      console.error('获取MCP服务器列表失败:', error);
      console.error('错误详情:', error.response || error.message);
      message.error(t('mcpServers.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [fetchServerTools, message, setLoading, setServers, expandedRowKeys, t]);

  // 使用useRef保存fetchServers函数的引用，避免依赖项问题
  const fetchServersRef = useRef(null);
  useEffect(() => {
    // 更新ref中的函数引用
    fetchServersRef.current = fetchServers;
  }, [fetchServers]);

  // 只在组件挂载时获取服务器列表
  useEffect(() => {
    // 使用ref中的函数，避免依赖于fetchServers
    if (fetchServersRef.current) {
      fetchServersRef.current(true); // 初始加载时刷新工具列表
    }
  }, []);

  // 启用服务器
  const enableServer = async (serverId) => {
    setOperatingServers(prev => ({ ...prev, [serverId]: 'enabling' }));
    try {
      const response = await api.post(`/mcp/servers/${serverId}/enable`);

      // 检查API返回的状态
      if (response.data.status === "error") {
        // 如果返回错误状态，显示错误消息
        console.error(`启用服务器失败:`, response.data.message);
        message.error(response.data.message || t('mcpServers.enableFailed', { id: serverId, error: t('common.unknown') }));
      } else {
        // 如果成功，显示成功消息
        message.success(response.data.message || t('mcpServers.enableSuccess', { id: serverId }));
      }

      // 无论成功还是失败，都刷新服务器列表，但不自动刷新工具列表
      await fetchServers(false);

      // 如果当前服务器已展开，则手动刷新工具列表
      if (expandedRowKeys.includes(serverId)) {
        fetchServerTools(serverId);
      }
    } catch (error) {
      console.error(`启用服务器请求失败:`, error);
      message.error(t('mcpServers.enableFailed', { id: serverId, error: error.message }));
    } finally {
      setOperatingServers(prev => {
        const newState = { ...prev };
        delete newState[serverId];
        return newState;
      });
    }
  };

  // 禁用服务器
  const disableServer = async (serverId) => {
    setOperatingServers(prev => ({ ...prev, [serverId]: 'disabling' }));
    try {
      const response = await api.post(`/mcp/servers/${serverId}/disable`);

      // 检查API返回的状态
      if (response.data.status === "error") {
        // 如果返回错误状态，显示错误消息
        console.error(`禁用服务器失败:`, response.data.message);
        message.warning(response.data.message || t('mcpServers.disableWarn', { id: serverId }));
      } else {
        // 如果成功，显示成功消息
        message.success(response.data.message || t('mcpServers.disableSuccess', { id: serverId }));
      }

      // 无论成功还是失败，都刷新服务器列表，但不自动刷新工具列表
      await fetchServers(false);

      // 如果当前服务器已展开，则手动刷新工具列表
      if (expandedRowKeys.includes(serverId)) {
        fetchServerTools(serverId);
      }
    } catch (error) {
      console.error(`禁用服务器请求失败:`, error);
      message.error(t('mcpServers.disableFailed', { id: serverId, error: error.message }));
    } finally {
      setOperatingServers(prev => {
        const newState = { ...prev };
        delete newState[serverId];
        return newState;
      });
    }
  };

  // 删除服务器
  const deleteServer = async (serverId) => {
    modal.confirm({
      title: t('mcpServers.confirmDeleteTitle'),
      content: t('mcpServers.confirmDeleteContent', { id: serverId }),
      onOk: async () => {
        try {
          await api.delete(`/mcp/servers/${serverId}`);
          message.success(t('mcpServers.deleteSuccess', { id: serverId }));
          fetchServers(false); // 刷新服务器列表，但不刷新工具列表
        } catch (error) {
          console.error(`删除服务器失败:`, error);
          message.error(t('mcpServers.deleteFailed', { id: serverId, error: error.response?.data?.message || error.message }));
        }
      }
    });
  };

  // 打开编辑模态框
  const openEditModal = (server = null) => {
    setEditingServer(server);
    if (server) {
      // 将环境变量对象转换为JSON字符串
      const envString = server.env ? JSON.stringify(server.env, null, 2) : '{}';
      const commType = server.comm_type || 'stdio';

      // 设置当前通信方式状态
      setCurrentCommType(commType);

      // 设置表单初始值
      form.setFieldsValue({
        id: server.id,
        description: server.description,
        internal: server.internal,
        comm_type: commType,
        env: envString
      });

      // 根据通信方式设置不同字段
      if (commType === 'stdio') {
        // 安全处理args字段，支持数组、字符串或空值
        let argsString = '';
        if (server.args) {
          if (Array.isArray(server.args)) {
            argsString = server.args.join(' ');
          } else if (typeof server.args === 'string') {
            argsString = server.args;
          }
        }

        form.setFieldsValue({
          command: server.command,
          args: argsString
        });
      } else if (isUrlBasedCommType(commType)) {
        form.setFieldsValue({
          url: server.url,
          // 对于HTTP通信方式，加载API规范类型（默认为mcp）
          api_spec_type: commType === 'http' ? (server.api_spec_type || 'mcp') : 'mcp'
        });
      }
    } else {
      // 设置默认通信方式状态
      setCurrentCommType('stdio');

      form.resetFields();
      // 确保新建服务器时internal默认为false，并设置空环境变量
      form.setFieldsValue({
        internal: false,
        comm_type: 'stdio',
        api_spec_type: 'mcp',  // 默认API规范类型
        env: '{}'
      });
    }
    setModalVisible(true);
  };

  // 保存服务器
  const saveServer = async () => {
    try {
      // 根据当前通信方式确定需要验证的字段
      const commType = form.getFieldValue('comm_type');
      let fieldsToValidate = ['id', 'description', 'comm_type'];

      // 根据通信方式添加需要验证的字段
      if (commType === 'stdio') {
        fieldsToValidate.push('command');
        // args字段改为非必填，不添加到验证列表中
      } else if (isUrlBasedCommType(commType)) {
        fieldsToValidate.push('url');
      }

      // 只验证相关字段
      const values = await form.validateFields(fieldsToValidate);

      // 获取所有表单值，包括未验证的字段
      const allValues = form.getFieldsValue();

      const config: any = {
        description: values.description,
        internal: false, // 强制设置为false，不允许创建内部服务器
        comm_type: values.comm_type || 'stdio',
        enabled: false  // 默认为禁用状态，需要用户手动启用
      };

      // 根据通信方式设置不同的配置项
      if (values.comm_type === 'stdio') {
        // 标准输入输出通信方式需要command和args
        config.command = values.command;
        // 安全处理args字段，允许为空，使用allValues获取args值
        if (allValues.args && allValues.args.trim()) {
          config.args = allValues.args.split(' ').filter((arg: string) => arg.trim() !== '');
        } else {
          config.args = [];
        }
      } else if (isUrlBasedCommType(values.comm_type)) {
        // HTTP/SSE/StreamableHTTP通信方式需要url
        config.url = values.url;
        
        // 对于HTTP通信方式，添加API规范类型（默认为mcp）
        if (values.comm_type === 'http') {
          config.api_spec_type = allValues.api_spec_type || 'mcp';
        }
      }

      // 解析并添加环境变量，使用allValues获取env值
      try {
        if (allValues.env) {
          const envObj = JSON.parse(allValues.env);
          if (typeof envObj === 'object' && envObj !== null) {
            config.env = envObj;
          }
        }
      } catch (e) {
        message.warning(t('mcpServers.envInvalidJson'));
        config.env = {};
      }

      if (editingServer) {
        // 更新服务器时，保留原来的internal值和enabled值
        config.internal = editingServer.internal;

        // 如果是内部服务器，则始终为启用状态
        if (editingServer.internal) {
          config.enabled = true;
        } else {
          // 保留原来的启用状态
          config.enabled = editingServer.enabled !== undefined ? editingServer.enabled :
                          (editingServer.status === 'running');
        }

        // 更新服务器
        await api.put(`/mcp/servers/${values.id}`, config);
        message.success(t('mcpServers.serverUpdated', { id: values.id }));
      } else {
        // 添加服务器
        await api.post('/mcp/servers', { id: values.id, config });
        message.success(t('mcpServers.serverAdded', { id: values.id }));
      }

      setModalVisible(false);
      fetchServers(false); // 刷新服务器列表，但不刷新工具列表
    } catch (error) {
      if (error.errorFields) {
        message.error(t('mcpServers.completeRequired'));
      } else {
        console.error('保存服务器失败:', error);
        message.error(t('mcpServers.saveServerFailed', { error: error.response?.data?.message || error.message }));
      }
    }
  };

  // 打开配置编辑模态框
  const openConfigEditor = async () => {
    try {
      // 获取完整的MCP配置文件内容
      console.log('正在获取MCP配置文件');
      const response = await api.get('/mcp/servers/config');

      if (response.data) {
        // 使用后端返回的完整配置
        setConfigContent(JSON.stringify(response.data, null, 2));
        console.log('成功获取MCP配置文件');
      } else {
        // 如果后端没有返回配置，使用服务器列表生成临时配置
        const config = {
          mcpServers: {}
        };

        servers.forEach(server => {
          config.mcpServers[server.id] = {
            command: server.command,
            args: server.args,
            description: server.description,
            internal: server.internal,
            comm_type: server.comm_type || 'stdio'
          };

          // 如果是http/sse/streamable_http通信方式且有URL，则添加URL
          if (isUrlBasedCommType(server.comm_type) && server.url) {
            config.mcpServers[server.id].url = server.url;
            
            // 对于HTTP通信方式，添加API规范类型
            if (server.comm_type === 'http' && server.api_spec_type) {
              config.mcpServers[server.id].api_spec_type = server.api_spec_type;
            }
          }

          // 如果有环境变量，则添加到配置中
          if (server.env) {
            config.mcpServers[server.id].env = server.env;
          }
        });

        setConfigContent(JSON.stringify(config, null, 2));
        console.warn('后端未返回配置，使用临时配置');
      }

      setConfigVisible(true);
    } catch (error) {
      console.error('获取MCP配置失败:', error);
      message.error(t('mcpServers.config.loadFailed', { error: error.message }));

      // 发生错误时，仍然打开模态框并使用临时配置
      const config = {
        mcpServers: {}
      };

      servers.forEach(server => {
        config.mcpServers[server.id] = {
          command: server.command,
          args: server.args,
          description: server.description,
          internal: server.internal,
          comm_type: server.comm_type || 'stdio'
        };

        // 如果是http/sse/streamable_http通信方式且有URL，则添加URL
        if (isUrlBasedCommType(server.comm_type) && server.url) {
          config.mcpServers[server.id].url = server.url;
          
          // 对于HTTP通信方式，添加API规范类型
          if (server.comm_type === 'http' && server.api_spec_type) {
            config.mcpServers[server.id].api_spec_type = server.api_spec_type;
          }
        }

        // 如果有环境变量，则添加到配置中
        if (server.env) {
          config.mcpServers[server.id].env = server.env;
        }
      });

      setConfigContent(JSON.stringify(config, null, 2));
      setConfigVisible(true);
    }
  };

  // 保存MCP配置
  const saveConfig = async () => {
    try {
      setSavingConfig(true);

      // 验证JSON格式
      let configObj;
      try {
        configObj = JSON.parse(configContent);
      } catch (e) {
        message.error(t('mcpServers.config.invalidJson'));
        return;
      }

      // 验证配置结构
      if (!configObj.mcpServers) {
        message.error(t('mcpServers.config.invalidStructure'));
        return;
      }

      // 确保所有服务器都有enabled属性，内部服务器始终为启用状态
      Object.keys(configObj.mcpServers).forEach(serverId => {
        const serverConfig = configObj.mcpServers[serverId];

        // 移除auto_start属性
        if ('auto_start' in serverConfig) {
          delete serverConfig.auto_start;
        }

        // 确保内部服务器始终为启用状态
        if (serverConfig.internal) {
          serverConfig.enabled = true;
        } else if (!('enabled' in serverConfig)) {
          // 如果没有enabled属性，默认为禁用状态
          serverConfig.enabled = false;
        }
      });

      // 保存配置文件
      await api.post('/mcp/servers/config', { config: configObj });
      message.success(t('mcpServers.config.saved'));
      setConfigVisible(false);

      // 重新加载服务器列表，但不刷新工具列表
      fetchServers(false);
    } catch (error) {
      console.error('保存MCP配置失败:', error);
      message.error(t('mcpServers.config.saveFailed', { error: error.response?.data?.message || error.message }));
    } finally {
      setSavingConfig(false);
    }
  };

  // 格式化JSON配置
  const formatConfig = () => {
    try {
      const configObj = JSON.parse(configContent);
      const formatted = JSON.stringify(configObj, null, 2);
      setConfigContent(formatted);
      message.success(t('mcpServers.config.formatted'));
    } catch (e) {
      message.error(t('mcpServers.config.formatFailed'));
    }
  };

  // 复制配置到剪贴板
  const copyConfig = () => {
    navigator.clipboard.writeText(configContent)
      .then(() => {
        message.success(t('mcpServers.config.copied'));
      })
      .catch(() => {
        message.error(t('mcpServers.config.copyFailed'));
      });
  };

  // 展开行处理
  const handleExpand = (expanded, record) => {
    if (expanded) {
      // 当展开一行时，加载该服务器的工具列表，但不强制刷新
      // 注意：这里只刷新工具列表，不刷新服务器列表
      fetchServerTools(record.id, false);
      setExpandedRowKeys([record.id]);
    } else {
      // 收起行时，只清空展开状态，不触发任何刷新
      setExpandedRowKeys([]);
    }
  };

  // 渲染工具参数
  const renderToolParams = (schema) => {
    if (!schema || !schema.properties) {
      return <Text type="secondary">{t('mcpServers.noParams')}</Text>;
    }

    // 从inputSchema的properties中提取参数
    const paramsList = Object.entries(schema.properties).map(([name, prop]: [string, any]) => ({
      name,
      type: Array.isArray((prop as any).type) ? (prop as any).type.join(' | ') : (prop as any).type,
      description: (prop as any).description || '',
      required: schema.required && schema.required.includes(name)
    }));

    if (paramsList.length === 0) {
      return <Text type="secondary">{t('mcpServers.noParams')}</Text>;
    }

    return (
      <List
       
        dataSource={paramsList}
        renderItem={param => (
          <List.Item>
            <Text strong>{param.name}</Text>{param.required && <Tag color="red" style={{marginLeft: 5}}>{t('mcpServers.requiredTag')}</Tag>}: {param.type}
            {param.description && <div><Text type="secondary">{param.description}</Text></div>}
          </List.Item>
        )}
      />
    );
  };

  // 添加监听函数，用于处理通信方式变更
  const handleCommTypeChange = (e) => {
    const commType = e.target.value;
    setCurrentCommType(commType);
  };

  // 表格列定义
  const columns = [
    {
      title: t('mcpServers.columns.id'),
      dataIndex: 'id',
      key: 'id',
      width: 150,
      fixed: 'left' as const,
    },
    {
      title: t('mcpServers.columns.tools'),
      key: 'tools',
      width: 100,
      render: (_, record) => (
        <Button
          type="text"
          icon={<ToolOutlined />}
          style={{ color: '#1677ff' }}
          onClick={(e) => {
            // 阻止事件冒泡，避免触发行点击
            e.stopPropagation();
            // 判断当前行是否已展开
            const isExpanded = expandedRowKeys.includes(record.id);
            if (isExpanded) {
              // 如果已展开则收起，不触发任何刷新
              setExpandedRowKeys([]);
            } else {
              // 如果未展开则展开并加载工具，并强制刷新
              // 注意：这里只刷新工具列表，不刷新服务器列表
              fetchServerTools(record.id, true);
              setExpandedRowKeys([record.id]);
            }
          }}
        >
          {expandedRowKeys.includes(record.id) ? t('mcpServers.collapse') : t('mcpServers.refreshTools')}
        </Button>
      ),
    },
    {
      title: t('mcpServers.columns.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status, record) => {
        // 优先使用enabled字段，如果不存在则使用status字段
        const isEnabled = record.enabled !== undefined ? record.enabled : (status === 'running');
        return isEnabled ?
          <Tag color="green">{t('status.enabled')}</Tag> :
          <Tag color="red">{t('status.disabled')}</Tag>;
      }
    },
    {
      title: t('mcpServers.columns.running'),
      dataIndex: 'running',
      key: 'running',
      width: 100,
      render: (running, record) => {
        // 使用running字段显示运行状态，不再回退到status字段
        // 因为status字段表示的是启用状态，而不是运行状态
        const isRunning = running === true;
        return isRunning ?
          <Tag icon={<CheckCircleOutlined />} color="green">{t('status.running')}</Tag> :
          <Tag icon={<CloseCircleOutlined />} color="red">{t('status.stopped')}</Tag>;
      }
    },
    {
      title: t('mcpServers.columns.description'),
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('mcpServers.columns.type'),
      dataIndex: 'internal',
      key: 'internal',
      width: 100,
      render: internal => internal ?
        <Tag color="blue">{t('mcpServers.internal')}</Tag> :
        <Tag color="orange">{t('mcpServers.external')}</Tag>
    },
    {
      title: t('mcpServers.columns.commType'),
      dataIndex: 'comm_type',
      key: 'comm_type',
      width: 120,
      render: commType => {
        if (commType === 'stdio') {
          return <Tag color="purple">{t('mcpServers.stdioTag')}</Tag>;
        } else if (commType === 'streamable_http') {
          return <Tag color="green">StreamableHTTP</Tag>;
        } else if (commType === 'sse') {
          return <Tag color="orange">SSE</Tag>;
        } else if (commType === 'http') {
          return <Tag color="cyan">HTTP</Tag>;
        } else {
          return <Tag color="default">{commType || t('common.unknown')}</Tag>;
        }
      }
    },

    {
      title: t('mcpServers.columns.action'),
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_, record) => {
        const isOperating = !!operatingServers[record.id];
        const operationType = operatingServers[record.id];
        
        return (
        <Space>
          {/* 优先使用enabled字段，如果不存在则使用status字段 */}
          {(!record.enabled && record.enabled !== undefined) || (record.enabled === undefined && record.status !== 'running') ? (
            !record.internal ? (
              <Tooltip title={isOperating ? t('mcpServers.enabling') : t('status.enabled')}>
                <Button
                  type="text"
                  icon={operationType === 'enabling' ? <LoadingOutlined /> : <PlayCircleOutlined />}
                  onClick={() => enableServer(record.id)}
                  disabled={isOperating}
                  style={{ color: '#1677ff' }}
                />
              </Tooltip>
            ) : null
          ) : (
            record.internal ? null : (
              <Tooltip title={isOperating ? t('mcpServers.disabling') : t('status.disabled')}>
                <Button
                  type="text"
                  danger
                  icon={operationType === 'disabling' ? <LoadingOutlined /> : <PauseCircleOutlined />}
                  onClick={() => disableServer(record.id)}
                  disabled={isOperating}
                />
              </Tooltip>
            )
          )}

          <Tooltip title={t('edit')}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>

          {!record.internal && (
            <Tooltip title={t('delete')}>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => deleteServer(record.id)}
              />
            </Tooltip>
          )}
        </Space>
      );
      },
    },
  ];

  // 展开行内容渲染
  const expandedRowRender = (record) => {
    const serverId = record.id;
    const isLoading = loadingTools[serverId];
    const tools = serverTools[serverId] || [];

    if (isLoading) {
      return (
        <div style={{ textAlign: 'center', padding: 8 }}>
          <Spin />
          <div style={{ marginTop: 4 }}>{t('mcpServers.loadingTools')}</div>
        </div>
      );
    }

    if (tools.length === 0) {
      return (
        <div style={{ padding: 8 }}>
          <Text type="secondary">{t('mcpServers.noTools')}</Text>
        </div>
      );
    }

    return (
      <div style={{ padding: '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0' }}>
          <ToolOutlined style={{ marginRight: 8 }} />
          <Text strong>{t('mcpServers.availableTools')} ({tools.length})</Text>
        </div>

        <Collapse
          style={{ marginBottom: 8 }}
          items={tools.map(tool => ({
            key: tool.name,
            label: (
              <Space>
                <Text strong>{tool.name}</Text>
                <Tag color="blue">{t('mcpServers.tool')}</Tag>
                {tool.annotations?.title && <Tag color="purple">{tool.annotations.title}</Tag>}
                {tool.annotations?.readOnlyHint && <Tag color="green">{t('mcpServers.readOnly')}</Tag>}
                {tool.annotations?.destructiveHint && <Tag color="red">{t('mcpServers.destructive')}</Tag>}
              </Space>
            ),
            children: (
              <Descriptions column={1} bordered>
                <Descriptions.Item label={t('mcpServers.description')}>
                  {tool.description || t('mcpServers.noDescription')}
                </Descriptions.Item>
                <Descriptions.Item label={t('mcpServers.parameters')}>
                  {renderToolParams(tool.inputSchema)}
                </Descriptions.Item>
                {tool.annotations && (
                  <Descriptions.Item label={t('mcpServers.annotations')}>
                    <div>
                      {tool.annotations.readOnlyHint !== undefined &&
                        <div>{t('mcpServers.readOnlyOp')}: {tool.annotations.readOnlyHint ? t('mcpServers.yes') : t('mcpServers.no')}</div>}
                      {tool.annotations.destructiveHint !== undefined &&
                        <div>{t('mcpServers.destructiveOp')}: {tool.annotations.destructiveHint ? t('mcpServers.yes') : t('mcpServers.no')}</div>}
                      {tool.annotations.idempotentHint !== undefined &&
                        <div>{t('mcpServers.idempotentOp')}: {tool.annotations.idempotentHint ? t('mcpServers.yes') : t('mcpServers.no')}</div>}
                      {tool.annotations.openWorldHint !== undefined &&
                        <div>{t('mcpServers.openWorld')}: {tool.annotations.openWorldHint ? t('mcpServers.yes') : t('mcpServers.no')}</div>}
                    </div>
                  </Descriptions.Item>
                )}
              </Descriptions>
            )
          }))}
        />
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>{t('mcpServers.title')}</Title>
            <Text type="secondary">
              {t('mcpServers.subtitle')}
            </Text>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openEditModal()}
            >
              {t('mcpServers.addServer')}
            </Button>

            <Button
              type="default"
              icon={<CodeOutlined />}
              onClick={openConfigEditor}
            >
              {t('mcpServers.editConfigFile')}
            </Button>

            <Button
              type="default"
              icon={<SyncOutlined />}
              onClick={() => fetchServers(true)}
            >
              {t('mcpServers.refresh')}
            </Button>
          </Space>
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={servers}
        rowKey="id"
        loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={false}
        expandable={{
          expandedRowRender,
          expandedRowKeys,
          onExpand: handleExpand,
          expandRowByClick: false
        }}
      />

      {/* 添加/编辑服务器模态框 */}
      <Modal
        title={editingServer ? t('mcpServers.editServer') : t('mcpServers.addServer')}
        open={modalVisible}
        onOk={saveServer}
        onCancel={() => setModalVisible(false)}
        width={700}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ internal: false, comm_type: 'stdio', api_spec_type: 'mcp' }}
        >
          <Form.Item
            name="id"
            label="服务器ID"
            rules={[{ required: true, message: '请输入服务器ID' }]}
            extra="唯一标识符，如 playwright, searxng"
          >
            <Input placeholder="例如: playwright" disabled={!!editingServer} />
          </Form.Item>

          <Form.Item
            name="comm_type"
            label="通信方式"
            extra="选择与MCP服务器的通信方式"
          >
            <Radio.Group onChange={handleCommTypeChange}>
              <Radio value="stdio">标准输入输出 (stdio)</Radio>
              <Radio value="streamable_http">StreamableHTTP</Radio>
              <Radio value="sse">Server-Sent Events (SSE)</Radio>
              <Radio value="http">HTTP</Radio>
            </Radio.Group>
          </Form.Item>

          {/* 当通信方式为stdio时显示的字段 */}
          <div className="stdio-fields" style={{ display: currentCommType === 'stdio' ? 'block' : 'none' }}>
            <Form.Item
              name="command"
              label="命令"
              rules={[{
                required: currentCommType === 'stdio',
                message: '请输入命令',
                validator: (_, value) => {
                  // 只在stdio模式下验证
                  if (currentCommType !== 'stdio') {
                    return Promise.resolve();
                  }
                  if (!value && currentCommType === 'stdio') {
                    return Promise.reject('请输入命令');
                  }
                  return Promise.resolve();
                }
              }]}
              extra="执行MCP服务器的命令，如 npx, curl"
            >
              <Input placeholder="例如: npx" />
            </Form.Item>

            <Form.Item
              name="args"
              label="参数"
              extra="命令参数，用空格分隔（可选）"
            >
              <Input placeholder="例如: @playwright/mcp@latest --vision" />
            </Form.Item>
          </div>

          {/* 当通信方式为http/sse/streamable_http时显示的字段 */}
          <Form.Item
            name="url"
            label={currentCommType === 'sse' ? 'SSE URL' : currentCommType === 'streamable_http' ? 'StreamableHTTP URL' : 'HTTP URL'}
            rules={[{
              required: isUrlBasedCommType(currentCommType),
              message: '请输入URL',
              validator: (_, value) => {
                // 只在http/sse/streamable_http模式下验证
                if (!isUrlBasedCommType(currentCommType)) {
                  return Promise.resolve();
                }
                if (!value && isUrlBasedCommType(currentCommType)) {
                  return Promise.reject('请输入URL');
                }
                return Promise.resolve();
              }
            }]}
            extra={currentCommType === 'sse'
              ? "SSE端点URL (如 http://localhost:8000/sse)"
              : currentCommType === 'streamable_http'
              ? "StreamableHTTP端点URL (如 http://localhost:8000/mcp)"
              : "HTTP服务器URL"
            }
            className="http-fields"
            style={{ display: isUrlBasedCommType(currentCommType) ? 'block' : 'none' }}
          >
            <Input placeholder={currentCommType === 'sse'
              ? "例如: http://localhost:8000/sse"
              : currentCommType === 'streamable_http'
              ? "例如: http://localhost:8000/mcp"
              : "例如: http://localhost:3000/tools"
            } />
          </Form.Item>

          {/* 仅对HTTP通信方式显示API规范类型选择 */}
          <Form.Item
            name="api_spec_type"
            label="API规范类型"
            extra="指定HTTP服务器返回的API格式"
            className="http-fields"
            style={{ display: currentCommType === 'http' ? 'block' : 'none' }}
          >
            <Radio.Group>
              <Radio value="mcp">MCP标准格式（默认）</Radio>
              <Radio value="openapi">OpenAPI 3.0规范</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
            extra="服务器功能描述"
          >
            <Input placeholder="例如: Playwright浏览器自动化服务器" />
          </Form.Item>

          <Form.Item
            name="env"
            label="环境变量"
            extra="JSON格式的环境变量，例如：{'KEY1': 'value1', 'KEY2': 'value2'}"
          >
            <TextArea
              rows={4}
              placeholder='{"KEY1": "value1", "KEY2": "value2"}'
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item
            name="internal"
            label="内部服务器"
            valuePropName="checked"
            extra="内部服务器由应用内部提供，不需要单独启动"
          >
            <Switch disabled={true} />
          </Form.Item>

        </Form>
      </Modal>

      {/* 配置文件编辑模态框 */}
      <Modal
        title={t('mcpServers.editConfigFile')}
        open={configVisible}
        onCancel={() => setConfigVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setConfigVisible(false)}>
            {t('cancel')}
          </Button>,
          <Button
            key="format"
            icon={<FormatPainterOutlined />}
            onClick={formatConfig}
          >
            {t('mcpServers.config.format')}
          </Button>,
          <Button
            key="copy"
            icon={<CopyOutlined />}
            onClick={copyConfig}
          >
            {t('mcpServers.config.copy')}
          </Button>,
          <Button
            key="save"
            type="primary"
            icon={<SaveOutlined />}
            loading={savingConfig}
            onClick={saveConfig}
          >
            {t('mcpServers.config.saveApply')}
          </Button>
        ]}
        width={900}
        styles={{ body: { maxHeight: '80vh', overflow: 'auto' } }}
      >
        <Paragraph>
          {t('mcpServers.configEditDesc')}
        </Paragraph>

        <Collapse
          defaultActiveKey={['1']}
          items={[
            {
              key: '1',
              label: '配置文件使用说明',
              children: (
                <>
                  <Paragraph>
                    <Text strong>配置格式说明:</Text>
                  </Paragraph>
                  <Paragraph>
                    <ul>
                      <li>配置必须是有效的JSON格式</li>
                      <li>根对象必须包含 <Text code>mcpServers</Text> 属性</li>
                      <li>每个服务器必须指定 <Text code>command</Text> 和 <Text code>args</Text> 属性（使用stdio通信方式时）</li>
                      <li>内部服务器(如variables-server)请保留 <Text code>internal</Text> 属性为 <Text code>true</Text></li>
                      <li>通信方式 <Text code>comm_type</Text> 可以是 <Text code>stdio</Text>(默认)、<Text code>streamable_http</Text>(推荐)、<Text code>sse</Text> 或 <Text code>http</Text></li>
                      <li>使用 <Text code>http</Text>、<Text code>sse</Text> 或 <Text code>streamable_http</Text> 通信时需要提供 <Text code>url</Text> 属性</li>
                      <li><Text code>streamable_http</Text> 是官方推荐的HTTP传输方式，支持双向流式通信（如<Text code>http://localhost:8000/mcp</Text>）</li>
                      <li><Text code>sse</Text> 类型用于Server-Sent Events连接（如<Text code>http://localhost:8000/sse</Text>）</li>
                      <li><Text code>http</Text> 类型支持OpenAPI规范URL（如<Text code>http://example.com/openapi.json</Text>），将自动转换为MCP工具</li>
                    </ul>
                  </Paragraph>
                </>
              )
            }
          ]}
        />

        <div style={{ marginTop: 16, border: '1px solid var(--custom-border)', borderRadius: '6px', overflow: 'hidden' }}>
          <Editor
            height="400px"
            defaultLanguage="json"
            theme="vs-dark"
            value={configContent}
            onChange={(value) => setConfigContent(value || '')}
            options={{
              fontSize: 14,
              fontFamily: 'JetBrains Mono, Consolas, Menlo, Monaco, monospace',
              lineNumbers: 'on',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              insertSpaces: true,
              wordWrap: 'on',
              formatOnPaste: true,
              formatOnType: true,
              folding: true,
              bracketPairColorization: { enabled: true },
              autoClosingBrackets: 'always',
              autoClosingQuotes: 'always',
              autoIndent: 'full',
              cursorBlinking: 'blink',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              mouseWheelZoom: true,
              contextmenu: true,
              find: {
                addExtraSpaceOnTop: false,
                autoFindInSelection: 'never',
                seedSearchStringFromSelection: 'always'
              }
            }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default MCPServersPage;