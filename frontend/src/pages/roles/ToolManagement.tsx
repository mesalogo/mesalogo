import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, message, Tag, Select, Typography, Checkbox, Tooltip, Alert, Popover, TreeSelect, App, Skeleton } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ToolOutlined,
  ApiOutlined,
  CodeOutlined,

  CloudOutlined,
  FileOutlined,
  GlobalOutlined,
  FunctionOutlined,
  BranchesOutlined,
  LockOutlined,
  EyeOutlined,
  EnvironmentOutlined,
  RobotOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  SyncOutlined,

  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import capabilityAPI from '../../services/api/capability';
import { roleAPI } from '../../services/api/role';
import api from '../../services/api/axios';

const { TextArea } = Input;
const { Title, Text } = Typography;

const ToolManagement = () => {
  const { t } = useTranslation();
  const { modal } = App.useApp();
  const [capabilities, setCapabilities] = useState([]);
  const [categories, setCategories] = useState([]); // 分类列表
  const [tempCategories, setTempCategories] = useState([]); // 临时分类列表，用于UI展示但尚未提交到后端
  const [roles, setRoles] = useState([]);
  const [roleCapabilityMap, setRoleCapabilityMap] = useState({});
  const [capabilityToolsMap, setCapabilityToolsMap] = useState({}); // 能力-工具/服务器映射
  const [mcpServers, setMcpServers] = useState([]);
  const [mcpServersLoading, setMcpServersLoading] = useState(false);
  const [serverTools, setServerTools] = useState({});
  const [loadingServerTools, setLoadingServerTools] = useState({});

  const [loadingCapabilities, setLoadingCapabilities] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [capabilityModalVisible, setCapabilityModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignToolsModalVisible, setAssignToolsModalVisible] = useState(false); // 添加工具关联模态框状态
  const [selectedCapability, setSelectedCapability] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedTools, setSelectedTools] = useState([]); // 选中的工具状态
  const [capabilityForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [assignToolsForm] = Form.useForm(); // 添加工具关联表单
  const [editingCapabilityId, setEditingCapabilityId] = useState(null);
  const [customCategoryName, setCustomCategoryName] = useState(''); // 用户自定义分类名称
  const [treeSelectKey, setTreeSelectKey] = useState(0); // 用于强制TreeSelect重新渲染

  // 能力表格分页状态
  const [capabilityPagination, setCapabilityPagination] = useState({
    current: 1,
    pageSize: 10,
  });





  // 获取MCP服务器列表
  const fetchMcpServers = async () => {
    try {
      setMcpServersLoading(true);
      console.log('requesting MCP server list');
      const response = await api.get('/mcp/servers');
      setMcpServers(response.data);
      console.log('MCP server list:', response.data);
    } catch (error) {
      console.error('fetch MCP server list failed:', error);
      message.error(t('toolManagement.fetchMcpFailed'));
    } finally {
      setMcpServersLoading(false);
    }
  };

  // 获取所有MCP服务器提供的工具列表
  const fetchAllServerTools = async () => {
    try {
      setMcpServersLoading(true);
      // build parallel requests for every server
      const promises = mcpServers.map(async (server) => {
        if (serverTools[server.id]) {
          return; // already cached
        }

        try {
          setLoadingServerTools(prev => ({ ...prev, [server.id]: true }));
          console.log(`fetching tool list for server ${server.id}`);
          const response = await api.post(`/mcp/tools/${server.id}`);

          // 处理响应数据
          if (response.data) {
            if (Array.isArray(response.data)) {
              setServerTools(prev => ({
                ...prev,
                [server.id]: response.data
              }));
            } else if (response.data.tools) {
              setServerTools(prev => ({
                ...prev,
                [server.id]: response.data.tools
              }));
            }
          }
        } catch (error) {
          console.error(`fetch tool list for server ${server.id} failed:`, error);
        } finally {
          setLoadingServerTools(prev => ({ ...prev, [server.id]: false }));
        }
      });

      // wait for all parallel requests
      await Promise.all(promises);
      console.log('all server tools loaded');
    } catch (error) {
      console.error('fetch all server tools failed:', error);
    } finally {
      setMcpServersLoading(false);
    }
  };

  // 获取MCP服务器提供的工具列表
  const fetchServerTools = async (serverId) => {
    if (serverTools[serverId]) {
      return; // 已经加载过工具列表
    }

    setLoadingServerTools(prev => ({ ...prev, [serverId]: true }));
    try {
      console.log(`fetching tool list for server ${serverId}`);
      const response = await api.post(`/mcp/tools/${serverId}`);

      // handle the MCP standard format
      if (response.data) {
        if (Array.isArray(response.data)) {
          setServerTools(prev => ({
            ...prev,
            [serverId]: response.data
          }));
          console.log(`server ${serverId} tool list:`, response.data);
        }
        else if (response.data.tools) {
          setServerTools(prev => ({
            ...prev,
            [serverId]: response.data.tools
          }));
          console.log(`server ${serverId} tool list:`, response.data.tools);
        }
        else {
          console.warn(`unsupported tool-list format for server ${serverId}:`, response.data);
          message.warning(t('toolManagement.serverToolsUnsupported', { id: serverId }));
        }
      } else {
        console.warn(`empty tool list for server ${serverId}`);
        message.warning(t('toolManagement.serverToolsEmpty', { id: serverId }));
      }
    } catch (error) {
      console.error(`fetch tool list for server ${serverId} failed:`, error);
      message.error(t('toolManagement.fetchServerToolsFailed', { id: serverId, error: error.message }));
    } finally {
      setLoadingServerTools(prev => ({ ...prev, [serverId]: false }));
    }
  };



  // 获取分类列表
  const fetchCategories = async () => {
    try {
      const response = await api.get('/capabilities/categories');
      setCategories(response.data || []);
      console.log('categories:', response.data);
      return response.data;
    } catch (error) {
      console.error('fetch categories failed:', error);
      message.error(t('toolManagement.fetchCategoriesFailed'));
      return [];
    }
  };

  // 获取能力列表
  const fetchCapabilities = async () => {
    try {
      setLoadingCapabilities(true);
      const response = await capabilityAPI.getAll();

      // 输出完整的API响应以便调试
      console.log('capability API response:', response);

      let capabilitiesData = [];
      if (Array.isArray(response.data)) {
        capabilitiesData = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        capabilitiesData = response.data.data;
      } else if (Array.isArray(response)) {
        capabilitiesData = response;
      }

      console.log('parsed capability data:', capabilitiesData);

      // filter out invalid rows and function_calling (model-feature owned)
      const validCapabilities = capabilitiesData.filter(cap =>
        cap && cap.name && typeof cap.name === 'string' && cap.id && cap.name !== 'function_calling'
      );

      console.log(`valid capabilities after filter: ${validCapabilities.length}`);

      // dedupe by name
      const uniqueCapabilities = new Map();
      validCapabilities.forEach(cap => {
        if (!uniqueCapabilities.has(cap.name)) {
          uniqueCapabilities.set(cap.name, cap);
        }
      });

      const uniqueCapabilitiesArray = Array.from(uniqueCapabilities.values());
      console.log(`capabilities: total=${capabilitiesData.length} valid=${validCapabilities.length} unique=${uniqueCapabilitiesArray.length}`);

      setCapabilities(uniqueCapabilitiesArray);

      // extract capability-to-tool/server associations
      const toolsMap = {};
      uniqueCapabilitiesArray.forEach(cap => {
        if (cap.tools) {
          try {
            const toolsData = typeof cap.tools === 'string'
              ? JSON.parse(cap.tools)
              : cap.tools;
            toolsMap[cap.name] = toolsData;
          } catch (e) {
            console.error(`parse tools for capability ${cap.name} failed:`, e);
          }
        }
      });

      setCapabilityToolsMap(toolsMap);
    } catch (error) {
      console.error('fetch capabilities failed', error);
      message.error(t('toolManagement.fetchCapabilitiesFailed'));
    } finally {
      setLoadingCapabilities(false);
    }
  };

  // fetch capability ↔ tool associations
  const fetchCapabilityTools = async () => {
    try {
      const response = await capabilityAPI.getTools();
      setCapabilityToolsMap(response);
    } catch (error) {
      console.error('fetch capability-tools failed:', error);
      // intentionally not user-visible to avoid noise
    }
  };

  // fetch role list + association map
  const fetchRoles = async () => {
    try {
      setLoadingRoles(true);

      const rolesResponse = await roleAPI.getAll();
      const roles = rolesResponse || [];
      setRoles(roles);

      const capabilityRolesMap = await capabilityAPI.getAllWithRoles();
      setRoleCapabilityMap(capabilityRolesMap);

    } catch (error) {
      console.error('fetch roles failed', error);
      setTimeout(() => {
        message.error(t('toolManagement.fetchRolesFailed'));
      }, 0);
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => {
    fetchCapabilities();
    fetchCategories(); // 获取分类列表
    fetchCapabilityTools(); // 获取能力与工具的关联关系
    fetchMcpServers(); // 保留这个调用以便工具关联功能可用
  }, []);

  // 在类型列表中添加从现有能力中提取的类型
  useEffect(() => {
    if (capabilities.length > 0) {
      // 从能力列表中提取所有唯一的类型
      const existingTypes = [...new Set(capabilities.map(cap => cap.type))];

      // 过滤掉已有的默认类型
      const defaultTypes = ['core', 'advanced', 'supervision', 'execution', 'specialized'];
      const customTypes = existingTypes.filter(type => !defaultTypes.includes(type));

      // 检查是否有新的自定义类型需要添加到分类列表中
      if (customTypes.length > 0) {
        const existingCategories = categories.map(cat => cat.name);
        const newTypes = customTypes.filter(type => !existingCategories.includes(type));

        if (newTypes.length > 0) {
          // 创建新的临时分类
          const newTempCategories = newTypes.map(type => ({
            id: `existing-${type}`,
            name: type
          }));

          // append to category list
          setTempCategories(prev => [...prev, ...newTempCategories]);
          console.log('added temporary categories from existing capabilities:', newTempCategories);
        }
      }
    }
  }, [capabilities, categories]);

  // 当能力列表加载完成后才获取角色列表，确保能力数据已经可用
  useEffect(() => {
    if (capabilities.length > 0) {
      fetchRoles();
    }
  }, [capabilities]);

  // 处理创建/编辑能力
  const handleSubmitCapability = async (values) => {
    try {
      // 提取并移除工具关联信息，以便单独处理
      const { tools, ...capabilityValues } = values;

      // 如果选择了临时分类，先保存分类
      if (capabilityValues.type && tempCategories.some(cat => cat.name === capabilityValues.type)) {
        await addCustomCategory(capabilityValues.type);
      }

      let capabilityId;
      if (editingCapabilityId) {
        await capabilityAPI.update(editingCapabilityId, capabilityValues);
        capabilityId = editingCapabilityId;
        message.success(t('toolManagement.capabilityUpdated'));
      } else {
        const response = await capabilityAPI.create(capabilityValues);
        capabilityId = response.data?.id;
        message.success(t('toolManagement.capabilityCreated'));
      }

      // 如果能力ID有效，处理工具关联（包括清空的情况）
      if (capabilityId && tools !== undefined) {
        // 将表单值转换成后端需要的格式
        const toolsMap = {};
        (tools || []).forEach(item => {
          const [server, tool] = item.split(':');
          if (!toolsMap[server]) {
            toolsMap[server] = [];
          }
          toolsMap[server].push(tool);
        });

        // 保存能力与工具的关联关系（包括空对象，用于清空工具）
        await capabilityAPI.updateTools(capabilityId, {
          tools: toolsMap
        });

        // 如果当前正在编辑的能力有名称，更新本地映射
        if (selectedCapability && selectedCapability.name) {
          setCapabilityToolsMap(prev => ({
            ...prev,
            [selectedCapability.name]: toolsMap
          }));
        }
      }

      setCapabilityModalVisible(false);
      capabilityForm.resetFields();
      // 清空临时分类
      setTempCategories([]);

      // 完成后重新获取所有需要的数据
      await fetchCategories();
      await fetchCapabilities();
      await fetchCapabilityTools(); // 重新获取能力与工具关联数据
    } catch (error) {
      console.error(editingCapabilityId ? 'update capability failed' : 'create capability failed', error);
      message.error(editingCapabilityId ? t('toolManagement.updateCapabilityFailed') : t('toolManagement.createFailed'));
    }
  };

  // delete capability
  const handleDeleteCapability = (record) => {
    modal.confirm({
      title: t('toolManagement.confirmDelete'),
      icon: <ExclamationCircleOutlined />,
      content: t('toolManagement.confirmDeleteContent', { name: record.name }),
      onOk: async () => {
        try {
          await capabilityAPI.delete(record.id);
          message.success(t('toolManagement.deleteSuccess'));
          fetchCapabilities();
        } catch (error) {
          message.error(t('toolManagement.deleteFailed'));
        }
      },
    });
  };

  // 将服务器和工具数据转换为TreeSelect组件所需的树形结构
  const convertToTreeData = () => {
    // 创建服务器节点
    const treeData = mcpServers.map(server => {
      const serverToolsList = serverTools[server.id] || [];

      // 创建工具子节点
      const children = serverToolsList.map(tool => ({
        title: (
          <span>
            {tool.name}
            {tool.annotations?.title && <Tag color="purple" style={{marginLeft: 4}}>{tool.annotations.title}</Tag>}
          </span>
        ),
        value: `${server.id}:${tool.name}`,
        key: `${server.id}:${tool.name}`,
      }));

      return {
        title: t('toolManagement.serverNode', { id: server.id }),
        value: `server:${server.id}`,
        key: `server:${server.id}`,
        children: children,
        selectable: true,
      };
    });

    return treeData;
  };

  // 处理TreeSelect选择变化
  const handleTreeSelectChange = (value, formInstance) => {
    // 确定要使用的表单实例
    let form = formInstance;
    if (!form || typeof form.setFieldsValue !== 'function') {
      // 如果没有传入有效的表单实例，尝试根据当前打开的模态框确定
      if (capabilityModalVisible) {
        form = capabilityForm;
      } else if (assignToolsModalVisible) {
        form = assignToolsForm;
      } else {
        console.error('cannot determine which form instance to use');
        return;
      }
    }

    // 处理服务器节点的选择/取消选择
    const newValues = [...value];

    // 检查是否有服务器节点被选中/取消选中
    value.forEach(val => {
      if (val && val.startsWith('server:')) {
        const serverId = val.replace('server:', '');

        // 如果是服务器节点，检查其所有工具是否已被选中
        const serverToolsList = serverTools[serverId] || [];
        const toolValues = serverToolsList.map(tool => `${serverId}:${tool.name}`);

        // 将该服务器的所有工具添加到选中列表
        toolValues.forEach(toolVal => {
          if (!newValues.includes(toolVal)) {
            newValues.push(toolVal);
          }
        });
      }
    });

    // 过滤掉服务器节点，只保留工具节点
    const filteredValues = newValues.filter(val => val && !val.startsWith('server:'));

    // 更新表单值
    try {
      form.setFieldsValue({ tools: filteredValues });
    } catch (error) {
      console.error('update form value failed:', error);
    }
  };

  // 创建TreeSelect通用配置
  const getTreeSelectProps = (onChange?: (value: any) => void) => ({
    treeData: convertToTreeData(),
    treeCheckable: true,
    showCheckedStrategy: TreeSelect.SHOW_CHILD,
    placeholder: t('toolManagement.toolSelectPlaceholder'),
    style: { width: '100%' },
    onChange: onChange || handleTreeSelectChange,
    treeDefaultExpandAll: true,
    allowClear: true,
    showSearch: true,
    tagRender: renderTreeSelectTags,
    filterTreeNode: (input, node) => {
      if (node.title && typeof node.title !== 'string') {
        // 处理React节点
        const nodeTitle = node.title.props?.children?.[0];
        return nodeTitle && nodeTitle.toLowerCase().includes(input.toLowerCase());
      }
      return node.title && node.title.toLowerCase().includes(input.toLowerCase());
    },
    treeNodeFilterProp: "title",
    popupMatchSelectWidth: false,
    styles: { 
      popup: { 
        maxHeight: 400, 
        overflow: 'auto' 
      } 
    }
  });

  // 生成自定义标签显示
  const renderTreeSelectTags = (props) => {
    const { label, value, closable, onClose } = props;

    // 如果是单个标签，直接返回原始标签
    if (!value || typeof value !== 'string') {
      return (
        <Tag
          closable={closable}
          onClose={onClose}
          color="blue"
        >
          {label}
        </Tag>
      );
    }

    // 解析值，获取服务器名称
    const [server] = value.split(':');

    // 获取当前表单中所有选中的工具
    let allSelectedTools = [];
    let currentForm = null;
    if (capabilityModalVisible) {
      allSelectedTools = capabilityForm.getFieldValue('tools') || [];
      currentForm = capabilityForm;
    } else if (assignToolsModalVisible) {
      allSelectedTools = assignToolsForm.getFieldValue('tools') || [];
      currentForm = assignToolsForm;
    }

    // 按服务器分组工具
    const serverToolsMap = {};
    allSelectedTools.forEach(val => {
      if (!val) return;
      const [srv, tl] = val.split(':');
      if (!serverToolsMap[srv]) {
        serverToolsMap[srv] = [];
      }
      serverToolsMap[srv].push(tl);
    });

    // 获取当前服务器的工具数量
    const toolCount = serverToolsMap[server]?.length || 0;

    // 检查是否已经渲染过这个服务器的标签
    // 通过检查当前值是否是该服务器的第一个工具来决定是否显示
    const isFirstToolOfServer = allSelectedTools.findIndex(t => t && t.startsWith(`${server}:`)) === allSelectedTools.findIndex(t => t === value);

    if (!isFirstToolOfServer) {
      // 如果不是该服务器的第一个工具，则不显示标签
      return null;
    }

    // 自定义关闭处理函数，移除当前服务器的所有工具
    const handleServerTagClose = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (currentForm && typeof currentForm.getFieldValue === 'function' && typeof currentForm.setFieldsValue === 'function') {
        try {
          // 获取当前所有选中的工具
          const currentTools = currentForm.getFieldValue('tools') || [];

          // 过滤掉当前服务器的所有工具
          const filteredTools = currentTools.filter(tool => tool && !tool.startsWith(`${server}:`));

          // 更新表单值
          currentForm.setFieldsValue({ tools: filteredTools });
          
          // 强制TreeSelect重新渲染以同步显示
          setTreeSelectKey(prev => prev + 1);
        } catch (error) {
          console.error('server tag close failed:', error);
          message.error(t('toolManagement.removeServerFailed'));
        }
      } else {
        console.error('no valid form instance');
        message.error(t('toolManagement.removeServerFailed'));
      }
    };

    // formatted tag
    return (
      <Tag
        closable={closable}
        onClose={handleServerTagClose}
        color="blue"
      >
        {t('toolManagement.toolsSelectedSummary', { server, count: toolCount })}
      </Tag>
    );
  };

  // 打开创建能力模态框
  const showCreateCapabilityModal = async () => {
    setEditingCapabilityId(null);

    // 获取最新的分类列表
    await fetchCategories();

    // 首先获取所有服务器的工具列表
    await fetchAllServerTools();

    capabilityForm.resetFields();
    capabilityForm.setFieldsValue({
      type: 'core',
      security_level: 1,
      default_enabled: false
    });
    setCapabilityModalVisible(true);
  };

  // 打开编辑能力模态框
  const showEditCapabilityModal = async (record) => {
    setEditingCapabilityId(record.id);
    setSelectedCapability(record);

    // 获取最新的分类列表
    await fetchCategories();

    // 首先获取所有服务器的工具列表
    await fetchAllServerTools();

    // 设置能力表单的基本字段值
    capabilityForm.setFieldsValue(record);

    // 处理工具关联
    const currentTools = capabilityToolsMap[record.name] || {};

    // 将当前关联工具转换成表单需要的格式
    const formattedTools = Object.entries(currentTools).reduce((acc, [server, tools]) => {
      if (Array.isArray(tools)) {
        tools.forEach(tool => {
          acc.push(`${server}:${tool}`);
        });
      }
      return acc;
    }, []);

    // 设置工具值
    capabilityForm.setFieldsValue({
      tools: formattedTools
    });

    // 显示模态框
    setCapabilityModalVisible(true);
  };

  // 打开关联角色模态框
  const showAssignRoleModal = (record) => {
    setSelectedCapability(record);
    const currentRoleIds = (roleCapabilityMap[record.name] || []).map(role => role.id);
    setSelectedRoles(currentRoleIds);
    assignForm.setFieldsValue({
      roles: currentRoleIds
    });
    setAssignModalVisible(true);
  };

  // 处理关联角色
  const handleAssignRoles = async (values) => {
    try {
      if (!selectedCapability) return;

      const currentRoleIds = (roleCapabilityMap[selectedCapability.name] || []).map(role => role.id);
      const newRoleIds = values.roles || [];

      // 要添加的角色IDs
      const rolesToAdd = newRoleIds.filter(id => !currentRoleIds.includes(id));
      // 要移除的角色IDs
      const rolesToRemove = currentRoleIds.filter(id => !newRoleIds.includes(id));

      // 添加新角色关联
      const addPromises = rolesToAdd.map(roleId =>
        capabilityAPI.assignToRole(roleId, selectedCapability.id, true)
      );

      // 移除旧角色关联
      const removePromises = rolesToRemove.map(roleId =>
        capabilityAPI.unassignFromRole(roleId, selectedCapability.id)
      );

      await Promise.all([...addPromises, ...removePromises]);

      message.success(t('toolManagement.roleAssignSuccess'));
      setAssignModalVisible(false);
      // refresh role associations
      await fetchRoles();
    } catch (error) {
      console.error('update role assignment failed:', error);
      message.error(t('toolManagement.roleAssignFailed'));
    }
  };

  // 根据能力类型进行分组
  const coreCapabilities = capabilities.filter(cap => cap.type === 'core');
  const advancedCapabilities = capabilities.filter(cap => cap.type === 'advanced');
  const supervisionCapabilities = capabilities.filter(cap => cap.type === 'supervision');
  const executionCapabilities = capabilities.filter(cap => cap.type === 'execution');
  const specializedCapabilities = capabilities.filter(cap => cap.type === 'specialized');

  // 添加类型标签列渲染函数
  const renderTypeTag = (type) => {
    const typeColors = {
      'core': 'blue',
      'advanced': 'purple',
      'supervision': 'orange',
      'execution': 'red',
      'specialized': 'cyan'
    };

    const typeLabels = {
      'core': t('toolManagement.type.core'),
      'advanced': t('toolManagement.type.advanced'),
      'supervision': t('toolManagement.type.supervision'),
      'execution': t('toolManagement.type.execution'),
      'specialized': t('toolManagement.type.specialized')
    };

    return <Tag color={typeColors[type] || 'default'}>{typeLabels[type] || t('toolManagement.type.unknown')}</Tag>;
  };

  // 打开关联工具模态框
  const showAssignToolsModal = async (record) => {
    setSelectedCapability(record);

    message.loading({
      content: t('toolManagement.toolsLoading'),
      key: 'loadingTools',
      duration: 0
    });

    await fetchAllServerTools();

    message.success({
      content: t('toolManagement.toolsLoaded'),
      key: 'loadingTools',
      duration: 2
    });

    const currentTools = capabilityToolsMap[record.name] || {};

    // 将当前关联工具转换成表单需要的格式
    const formattedTools = Object.entries(currentTools).reduce((acc, [server, tools]) => {
      if (Array.isArray(tools)) {
        tools.forEach(tool => {
          acc.push(`${server}:${tool}`);
        });
      }
      return acc;
    }, []);

    setSelectedTools(formattedTools);
    assignToolsForm.setFieldsValue({
      tools: formattedTools
    });

    // 确保有工具数据后再显示模态框
    setAssignToolsModalVisible(true);
  };

  // 处理关联工具
  const handleAssignTools = async (values) => {
    try {
      if (!selectedCapability) return;

      // 将表单值转换成后端需要的格式
      const toolsMap = {};
      (values.tools || []).forEach(item => {
        const [server, tool] = item.split(':');
        if (!toolsMap[server]) {
          toolsMap[server] = [];
        }
        toolsMap[server].push(tool);
      });

      // 保存能力与工具的关联关系
      await capabilityAPI.updateTools(selectedCapability.id, {
        tools: toolsMap
      });

      // 更新本地映射
      setCapabilityToolsMap(prev => ({
        ...prev,
        [selectedCapability.name]: toolsMap
      }));

      message.success(t('toolManagement.updateSuccess'));
      setAssignToolsModalVisible(false);

      await fetchCapabilityTools();
    } catch (error) {
      console.error('update tool assignment failed:', error);
      message.error(t('toolManagement.updateFailed'));
    }
  };

  // 处理自定义分类输入
  const handleCustomCategoryInput = value => {
    setCustomCategoryName(value);
  };

  // 处理自定义分类选择
  const handleCustomCategorySelect = value => {
    // 如果是已有的分类，直接使用
    if ([...categories, ...tempCategories].some(cat => cat.name === value)) {
capabilityForm.setFieldsValue({ type: value });
    } else if (value && value.trim()) {
      // 如果是新分类，添加到临时分类列表
      const newTempCategory = { id: `temp-${Date.now()}`, name: value.trim() };
      setTempCategories(prev => [...prev, newTempCategory]);
      message.success(t('toolManagement.tempCategoryAdded', { name: value }));

      capabilityForm.setFieldsValue({ type: value });
    }
  };

  // persist a custom category to the backend
  const addCustomCategory = async (name) => {
    if (!name || !name.trim()) return;

    try {
      await api.post('/capabilities/categories', { name: name.trim() });
      message.success(t('toolManagement.categoryAdded', { name }));

      const updatedCategories = await fetchCategories();

      setTempCategories(prev => prev.filter(cat => cat.name !== name.trim()));

      return updatedCategories;
    } catch (error) {
      console.error('add category failed:', error);
      message.error(t('toolManagement.categoryAddFailed'));
      return null;
    }
  };

  // capability table columns
  const capabilityColumns = [
    {
      title: t('toolManagement.col.name'),
      dataIndex: 'name',
      key: 'name',
      width: 180,
      fixed: 'left' as const,
      render: (text, record) => (
        <Space>
          {record.name === 'agent_coordination' ?
              <BranchesOutlined style={{ color: '#722ed1' }} /> :
              record.name === 'tool_use' ?
                <ToolOutlined style={{ color: '#52c41a' }} /> :
                record.name === 'code_execution' ?
                  <CodeOutlined style={{ color: '#fa8c16' }} /> :
                  record.name === 'web_browsing' ?
                    <GlobalOutlined style={{ color: '#eb2f96' }} /> :
                    record.name === 'external_api' ?
                      <ApiOutlined style={{ color: '#faad14' }} /> :
                      record.name === 'environment_sensing' ?
                        <EnvironmentOutlined style={{ color: '#13c2c2' }} /> :
                        record.name === 'supervision' ?
                          <EyeOutlined style={{ color: '#722ed1' }} /> :
                          record.name === 'execution' ?
                            <ThunderboltOutlined style={{ color: '#fa541c' }} /> :
                            <RobotOutlined style={{ color: '#1677ff' }} />
          }
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: t('toolManagement.col.description'),
      dataIndex: 'description',
      key: 'description',
      width: 300,
      render: (description) => (
        <Tooltip 
          placement="topLeft" 
          title={description}
          overlayStyle={{ maxWidth: '800px' }}
          overlayInnerStyle={{ 
            whiteSpace: 'pre-wrap', 
            wordBreak: 'break-word',
            maxHeight: '600px',
            overflowY: 'auto'
          }}
        >
          <div style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            wordBreak: 'break-word',
            lineHeight: '1.5em',
            maxHeight: '4.5em'
          }}>
            {description}
          </div>
        </Tooltip>
      ),
    },
    {
      title: t('toolManagement.col.type'),
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const typeColors = {
          'core': 'blue',
          'advanced': 'purple',
          'supervision': 'orange',
          'execution': 'red',
          'specialized': 'cyan'
        };

        const typeLabels = {
          'core': t('toolManagement.type.core'),
          'advanced': t('toolManagement.type.advanced'),
          'supervision': t('toolManagement.type.supervision'),
          'execution': t('toolManagement.type.execution'),
          'specialized': t('toolManagement.type.specialized')
        };

        if (typeColors[type]) {
          return <Tag color={typeColors[type]}>{typeLabels[type] || type}</Tag>;
        }
        return <Tag color="default">{type}</Tag>;
      },
    },
    {
      title: t('toolManagement.col.source'),
      dataIndex: 'created_by',
      key: 'resource_source',
      width: 100,
      render: (created_by, record) => {
        if (!created_by) {
          return (
            <Tooltip title={t('toolManagement.source.systemTip')}>
              <Tag icon={<GlobalOutlined />} color="blue">
                {t('toolManagement.source.system')}
              </Tag>
            </Tooltip>
          );
        }

        if (record.is_shared) {
          return (
            <Tooltip title={t('toolManagement.source.sharedTip')}>
              <Tag icon={<TeamOutlined />} color="green">
                {t('toolManagement.source.shared')}
              </Tag>
            </Tooltip>
          );
        }

        return (
          <Tooltip title={t('toolManagement.source.privateTip')}>
            <Tag icon={<LockOutlined />} color="orange">
              {t('toolManagement.source.private')}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: t('toolManagement.col.associatedTools'),
      key: 'associated_tools',
      render: (_, record) => {
        const tools = capabilityToolsMap[record.name] || {};
        const serverList = Object.keys(tools);

        if (!serverList || serverList.length === 0) {
          return <Tag color="default">{t('toolManagement.noTools')}</Tag>;
        }

        const totalToolCount = serverList.reduce((sum, server) => {
          const list = Array.isArray(tools[server]) ? tools[server] : [];
          return sum + list.length;
        }, 0);

        return (
          <Popover
            content={
              <div style={{ maxWidth: 300, maxHeight: 300, overflow: 'auto' }}>
                {serverList.map(server => {
                  const serverToolList = Array.isArray(tools[server]) ? tools[server] : [];
                  return (
                    <div key={server} style={{ marginBottom: '8px' }}>
                      <div style={{ fontWeight: 'bold', color: '#1677ff' }}>
                        {server}:
                      </div>
                      <div style={{ marginLeft: '16px' }}>
                        {serverToolList.length > 0 ? (
                          serverToolList.map(tool => (
                            <div key={`${server}-${tool}`} style={{ marginBottom: '4px' }}>
                              • {tool}
                            </div>
                          ))
                        ) : (
                          <div style={{ color: 'var(--custom-text-secondary)', fontStyle: 'italic' }}>{t('toolManagement.noToolsInline')}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            }
            title={t('toolManagement.popoverTitle.tools')}
            placement="right"
            mouseEnterDelay={0.5}
            trigger="hover"
          >
            <Tag color="cyan" style={{ cursor: 'pointer' }}>
              {t('toolManagement.serverCount', { count: serverList.length })}
              {totalToolCount > 0 ? t('toolManagement.serverDetailsSuffix') : t('toolManagement.serverNoToolsSuffix')}
            </Tag>
          </Popover>
        );
      },
    },
    {
      title: t('toolManagement.col.associatedRoles'),
      key: 'associated_roles',
      render: (_, record) => {
        const relatedRoles = roleCapabilityMap[record.name] || [];

        if (!relatedRoles || relatedRoles.length === 0) {
          return <Tag color="default">{t('toolManagement.noRoles')}</Tag>;
        }

        return (
          <Space>
            {relatedRoles.length <= 2 ? (
              relatedRoles.map(role => (
                <Tag key={role.id || `role-${Math.random()}`} color="geekblue">{role.name}</Tag>
              ))
            ) : (
              <>
                <Tag color="geekblue">{relatedRoles[0].name}</Tag>
                <Popover
                  content={
                    <div style={{ maxWidth: 250, maxHeight: 200, overflow: 'auto' }}>
                      {relatedRoles.map(role => (
                        <Tag
                          key={role.id || `role-${Math.random()}`}
                          color="geekblue"
                          style={{ margin: '2px' }}
                        >
                          {role.name}
                        </Tag>
                      ))}
                    </div>
                  }
                  title={t('toolManagement.popoverTitle.roles')}
                  placement="right"
                  mouseEnterDelay={0.5}
                >
                  <Tag color="geekblue" style={{ cursor: 'pointer' }}>
                    {t('toolManagement.moreRoles', { count: relatedRoles.length - 1 })}
                  </Tag>
                </Popover>
              </>
            )}
          </Space>
        );
      },
    },
    {
      title: t('toolManagement.col.securityLevel'),
      dataIndex: 'security_level',
      key: 'security_level',
      render: (level) => {
        const colors = { 1: 'green', 2: 'orange', 3: 'red' };
        const texts = {
          1: t('toolManagement.security.low'),
          2: t('toolManagement.security.medium'),
          3: t('toolManagement.security.high')
        };
        return <Tag color={colors[level] || 'default'}>{texts[level] || t('toolManagement.type.unknown')}</Tag>;
      }
    },
    {
      title: t('toolManagement.col.defaultEnabled'),
      dataIndex: 'default_enabled',
      key: 'default_enabled',
      render: (enabled) => (
        <Tag color={enabled ? 'success' : 'default'}>
          {enabled ? t('toolManagement.yes') : t('toolManagement.no')}
        </Tag>
      ),
    },
    {
      title: t('toolManagement.col.actions'),
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Tooltip title={t('toolManagement.action.edit')}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showEditCapabilityModal(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title={t('toolManagement.action.linkRoles')}>
            <Button
              type="text"
              icon={<TeamOutlined />}
              onClick={() => showAssignRoleModal(record)}
              style={{ color: '#722ed1' }}
            />
          </Tooltip>
          <Tooltip title={t('toolManagement.action.delete')}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteCapability(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>{t('toolManagement.title')}</Title>
            <Text type="secondary">
              {t('toolManagement.subtitle')}
            </Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={showCreateCapabilityModal}
          >
            {t('toolManagement.action.newCapability')}
          </Button>
        </div>
      </div>

      <Card
        style={{
          borderRadius: '12px',
          boxShadow: 'var(--custom-shadow)'
        }}
      >
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <Space size="middle">
            <Tag color="blue">{t('toolManagement.summary.core', { count: coreCapabilities.length })}</Tag>
            <Tag color="purple">{t('toolManagement.summary.advanced', { count: advancedCapabilities.length })}</Tag>
            <Tag color="orange">{t('toolManagement.summary.supervision', { count: supervisionCapabilities.length })}</Tag>
            <Tag color="red">{t('toolManagement.summary.execution', { count: executionCapabilities.length })}</Tag>
            <Tag color="cyan">{t('toolManagement.summary.specialized', { count: specializedCapabilities.length })}</Tag>
          </Space>
          <Space>
            <Tag color="default">{t('toolManagement.summary.total', { count: capabilities.length })}</Tag>
          </Space>
        </div>

        {(loadingCapabilities || loadingRoles) ? (
          <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(item => (
              <Card key={item} style={{ marginBottom: 8 }}>
                <Skeleton active paragraph={{ rows: 2 }} />
              </Card>
            ))}
          </Space>
        ) : (
          <Table
            columns={capabilityColumns}
            dataSource={capabilities.map(cap => ({
              ...cap,
              key: cap.id
            }))}
            rowKey="id"
            scroll={{ x: 'max-content' }}
            pagination={{
              current: capabilityPagination.current,
              pageSize: capabilityPagination.pageSize,
              defaultPageSize: 10,
              pageSizeOptions: [10, 50, 100],
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => t('toolManagement.pagination.total', { total }),
              position: ['bottomRight'],
              simple: false,
              onChange: (page, pageSize) => {
                setCapabilityPagination({
                  current: page,
                  pageSize: pageSize,
                });
              },
              onShowSizeChange: (current, size) => {
                setCapabilityPagination({
                  current: 1,
                  pageSize: size,
                });
              }
            }}
            rowClassName={(record) => {
              const typeClasses = {
                'core': 'core-capability-row',
                'advanced': 'advanced-capability-row',
                'supervision': 'supervision-capability-row',
                'execution': 'execution-capability-row',
                'specialized': 'specialized-capability-row'
              };
              return typeClasses[record.type] || 'custom-capability-row';
            }}
          />
        )}
      </Card>

      {/* capability edit modal */}
      <Modal
        title={editingCapabilityId ? t('toolManagement.modal.editTitle') : t('toolManagement.modal.newTitle')}
        open={capabilityModalVisible}
        onOk={capabilityForm.submit}
        onCancel={() => {
          setCapabilityModalVisible(false);
          capabilityForm.resetFields();
          setTempCategories([]);
        }}
        width={600}
      >
        <Form
          form={capabilityForm}
          layout="vertical"
          onFinish={handleSubmitCapability}
        >
          <Form.Item
            name="name"
            label={t('toolManagement.form.name')}
            rules={[{ required: true, message: t('toolManagement.form.nameRequired') }]}
          >
            <Input placeholder={t('toolManagement.form.namePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="description"
            label={t('toolManagement.form.descLabel')}
            rules={[{ required: true, message: t('toolManagement.form.descRequired') }]}
          >
            <Input.TextArea rows={3} placeholder={t('toolManagement.form.descPlaceholder')} />
          </Form.Item>
          <Form.Item
            name="type"
            label={t('toolManagement.form.typeLabel')}
            rules={[{ required: true, message: t('toolManagement.form.typeRequired') }]}
          >
            <Select
              placeholder={t('toolManagement.form.typePlaceholder')}
              showSearch
              allowClear
              onSearch={handleCustomCategoryInput}
              onSelect={handleCustomCategorySelect}
              popupRender={menu => (
                <>
                  {menu}
                  {customCategoryName && ![...categories, ...tempCategories].some(c => c.name === customCategoryName) && (
                    <div
                      style={{ padding: '8px', cursor: 'pointer', borderTop: '1px solid var(--custom-border)' }}
                      onClick={() => handleCustomCategorySelect(customCategoryName)}
                    >
                      <PlusOutlined /> {t('toolManagement.form.addCustom', { name: customCategoryName })}
                    </div>
                  )}
                </>
              )}
            >
              <Select.Option value="core">{t('toolManagement.type.core')}</Select.Option>
              <Select.Option value="advanced">{t('toolManagement.type.advanced')}</Select.Option>
              <Select.Option value="supervision">{t('toolManagement.type.supervision')}</Select.Option>
              <Select.Option value="execution">{t('toolManagement.type.execution')}</Select.Option>
              <Select.Option value="specialized">{t('toolManagement.type.specialized')}</Select.Option>
              {[...categories, ...tempCategories].map(category => {
                if (['core', 'advanced', 'supervision', 'execution', 'specialized'].includes(category.name)) {
                  return null;
                }
                return (
                  <Select.Option
                    key={category.id || category.name}
                    value={category.name}
                    style={tempCategories.some(c => c.id === category.id) ? {color: '#1677ff', fontStyle: 'italic'} : {}}
                  >
                    {category.name}
                    {tempCategories.some(c => c.id === category.id) && <Tag color="processing" style={{marginLeft: 4}}>{t('toolManagement.form.unsaved')}</Tag>}
                  </Select.Option>
                );
              })}
            </Select>
          </Form.Item>
          <Form.Item
            name="icon"
            label={t('toolManagement.form.iconLabel')}
          >
            <Input placeholder={t('toolManagement.form.iconPlaceholder')} />
          </Form.Item>
          <Form.Item
            name="security_level"
            label={t('toolManagement.form.securityLabel')}
            rules={[{ required: true, message: t('toolManagement.form.securityRequired') }]}
          >
            <Select placeholder={t('toolManagement.form.securityPlaceholder')}>
              <Select.Option value={1}>{t('toolManagement.security.lowOpt')}</Select.Option>
              <Select.Option value={2}>{t('toolManagement.security.mediumOpt')}</Select.Option>
              <Select.Option value={3}>{t('toolManagement.security.highOpt')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="default_enabled"
            valuePropName="checked"
          >
            <Checkbox>{t('toolManagement.form.defaultEnabled')}</Checkbox>
          </Form.Item>

          <Form.Item
            name="is_shared"
            valuePropName="checked"
            tooltip={t('toolManagement.form.sharedTooltip')}
          >
            <Checkbox>
              <Space>
                <TeamOutlined />
                {t('toolManagement.form.shared')}
              </Space>
            </Checkbox>
          </Form.Item>

          <Form.Item
            name="tools"
            label={t('toolManagement.form.linkToolsLabel')}
          >
            <TreeSelect
              key={treeSelectKey}
              treeData={convertToTreeData()}
              treeCheckable={true}
              showCheckedStrategy={TreeSelect.SHOW_CHILD}
              placeholder={t('toolManagement.toolSelectPlaceholder')}
              style={{ width: '100%' }}
              onChange={(value) => {
                console.log('capability modal tree select change:', value);
                handleTreeSelectChange(value, capabilityForm);
              }}
              treeDefaultExpandAll
              allowClear
              showSearch
              tagRender={renderTreeSelectTags}
              filterTreeNode={(input: any, node: any) => {
                if (node.title && typeof node.title !== 'string') {
                  const nodeTitle = node.title.props?.children?.[0];
                  return nodeTitle && String(nodeTitle).toLowerCase().includes(input.toLowerCase());
                }
                return node.title && String(node.title).toLowerCase().includes(input.toLowerCase());
              }}
              treeNodeFilterProp="title"
              popupMatchSelectWidth={false}
              styles={{
                popup: {
                  maxHeight: 400,
                  overflow: 'auto'
                } as any
              }}
            />
          </Form.Item>

          <Alert
            message={t('toolManagement.alert.title')}
            description={t('toolManagement.alert.description')}
            type="info"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        </Form>
      </Modal>

      {/* role-link modal */}
      <Modal
        title={t('toolManagement.modal.linkRolesTitle', { name: selectedCapability?.name || '' })}
        open={assignModalVisible}
        onOk={assignForm.submit}
        onCancel={() => {
          setAssignModalVisible(false);
          assignForm.resetFields();
        }}
        width={500}
      >
        <Form
          form={assignForm}
          layout="vertical"
          onFinish={handleAssignRoles}
        >
          <Form.Item
            name="roles"
            label={t('toolManagement.form.selectRolesLabel')}
            rules={[{ required: false, message: t('toolManagement.form.selectRolesRequired') }]}
          >
            <Select
              mode="multiple"
              placeholder={t('toolManagement.form.selectRolesPlaceholder')}
              style={{ width: '100%' }}
              options={roles.map(role => ({
                label: role.name,
                value: role.id
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* tool-link modal */}
      <Modal
        title={t('toolManagement.modal.linkToolsTitle', { name: selectedCapability?.name || '' })}
        open={assignToolsModalVisible}
        onOk={assignToolsForm.submit}
        onCancel={() => {
          setAssignToolsModalVisible(false);
          assignToolsForm.resetFields();
        }}
        width={600}
      >
        <Form
          form={assignToolsForm}
          layout="vertical"
          onFinish={handleAssignTools}
        >
          <Form.Item
            name="tools"
            label={t('toolManagement.form.selectToolsLabel')}
            rules={[{ required: false, message: t('toolManagement.form.selectToolsRequired') }]}
          >
            <TreeSelect
              key={treeSelectKey}
              treeData={convertToTreeData()}
              treeCheckable={true}
              showCheckedStrategy={TreeSelect.SHOW_CHILD}
              placeholder={t('toolManagement.toolSelectPlaceholder')}
              style={{ width: '100%' }}
              onChange={(value) => {
                console.log('link-tools modal tree select change:', value);
                handleTreeSelectChange(value, assignToolsForm);
              }}
              treeDefaultExpandAll
              allowClear
              showSearch
              tagRender={renderTreeSelectTags}
              filterTreeNode={(input: any, node: any) => {
                if (node.title && typeof node.title !== 'string') {
                  const nodeTitle = node.title.props?.children?.[0];
                  return nodeTitle && String(nodeTitle).toLowerCase().includes(input.toLowerCase());
                }
                return node.title && String(node.title).toLowerCase().includes(input.toLowerCase());
              }}
              treeNodeFilterProp="title"
              popupMatchSelectWidth={false}
              styles={{
                popup: {
                  maxHeight: 400,
                  overflow: 'auto'
                } as any
              }}
            />
          </Form.Item>
          <Alert
            message={t('toolManagement.alert.title')}
            description={t('toolManagement.alert.description')}
            type="info"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        </Form>
      </Modal>
    </div>
  );
};

export default ToolManagement;