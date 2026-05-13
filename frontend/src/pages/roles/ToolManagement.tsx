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
      console.log('正在请求MCP服务器列表');
      const response = await api.get('/mcp/servers');
      setMcpServers(response.data);
      console.log('获取到MCP服务器列表:', response.data);
    } catch (error) {
      console.error('获取MCP服务器列表失败:', error);
      message.error('获取MCP服务器列表失败');
    } finally {
      setMcpServersLoading(false);
    }
  };

  // 获取所有MCP服务器提供的工具列表
  const fetchAllServerTools = async () => {
    try {
      setMcpServersLoading(true);
      // 为所有服务器创建并行请求
      const promises = mcpServers.map(async (server) => {
        if (serverTools[server.id]) {
          return; // 如果已经加载过该服务器的工具，则跳过
        }

        try {
          setLoadingServerTools(prev => ({ ...prev, [server.id]: true }));
          console.log(`正在获取服务器 ${server.id} 的工具列表`);
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
          console.error(`获取服务器 ${server.id} 的工具列表失败:`, error);
        } finally {
          setLoadingServerTools(prev => ({ ...prev, [server.id]: false }));
        }
      });

      // 等待所有请求完成
      await Promise.all(promises);
      console.log('所有服务器工具加载完成');
    } catch (error) {
      console.error('获取所有服务器工具列表失败:', error);
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
      console.log(`正在获取服务器 ${serverId} 的工具列表`);
      const response = await api.post(`/mcp/tools/${serverId}`);

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
          message.warning(`服务器 ${serverId} 的工具列表格式不支持`);
        }
      } else {
        console.warn(`获取到的服务器 ${serverId} 的工具列表为空`);
        message.warning(`服务器 ${serverId} 的工具列表为空`);
      }
    } catch (error) {
      console.error(`获取服务器 ${serverId} 的工具列表失败:`, error);
      message.error(`获取服务器 ${serverId} 的工具列表失败: ${error.message}`);
    } finally {
      setLoadingServerTools(prev => ({ ...prev, [serverId]: false }));
    }
  };



  // 获取分类列表
  const fetchCategories = async () => {
    try {
      const response = await api.get('/capabilities/categories');
      setCategories(response.data || []);
      console.log('获取到分类列表:', response.data);
      return response.data;
    } catch (error) {
      console.error('获取分类列表失败:', error);
      message.error('获取分类列表失败');
      return [];
    }
  };

  // 获取能力列表
  const fetchCapabilities = async () => {
    try {
      setLoadingCapabilities(true);
      const response = await capabilityAPI.getAll();

      // 输出完整的API响应以便调试
      console.log('能力API响应:', response);

      // 确定正确的数据路径
      let capabilitiesData = [];
      if (Array.isArray(response.data)) {
        capabilitiesData = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        capabilitiesData = response.data.data;
      } else if (Array.isArray(response)) {
        capabilitiesData = response;
      }

      console.log('解析后的能力数据:', capabilitiesData);

      // 过滤无效数据和 function_calling（由模型特性决定）
      const validCapabilities = capabilitiesData.filter(cap =>
        cap && cap.name && typeof cap.name === 'string' && cap.id && cap.name !== 'function_calling'
      );

      console.log(`过滤后有效的能力数据: ${validCapabilities.length}个`);

      // 使用Map进行去重，以name为键
      const uniqueCapabilities = new Map();
      validCapabilities.forEach(cap => {
        if (!uniqueCapabilities.has(cap.name)) {
          uniqueCapabilities.set(cap.name, cap);
        }
      });

      // 转换回数组
      const uniqueCapabilitiesArray = Array.from(uniqueCapabilities.values());
      console.log(`获取到${capabilitiesData.length}个能力，有效${validCapabilities.length}个，去重后剩余${uniqueCapabilitiesArray.length}个`);

      setCapabilities(uniqueCapabilitiesArray);

      // 提取能力与工具/服务器的关联关系
      const toolsMap = {};
      uniqueCapabilitiesArray.forEach(cap => {
        if (cap.tools) {
          // 如果tools字段是字符串，尝试解析成JSON对象
          try {
            const toolsData = typeof cap.tools === 'string'
              ? JSON.parse(cap.tools)
              : cap.tools;
            toolsMap[cap.name] = toolsData;
          } catch (e) {
            console.error(`解析能力 ${cap.name} 的工具关联失败:`, e);
          }
        }
      });

      setCapabilityToolsMap(toolsMap);
    } catch (error) {
      console.error('获取能力列表失败', error);
      message.error('获取能力列表失败');
    } finally {
      setLoadingCapabilities(false);
    }
  };

  // 获取能力与工具的关联关系
  const fetchCapabilityTools = async () => {
    try {
      const response = await capabilityAPI.getTools();
      setCapabilityToolsMap(response);
    } catch (error) {
      console.error('获取能力与工具关联关系失败:', error);
      // 不显示错误消息，避免干扰用户体验
    }
  };

  // 获取角色列表和关联信息
  const fetchRoles = async () => {
    try {
      setLoadingRoles(true);

      // 获取所有角色
      const rolesResponse = await roleAPI.getAll();
      const roles = rolesResponse || [];
      setRoles(roles);

      // 一次性获取所有能力与角色的映射关系
      const capabilityRolesMap = await capabilityAPI.getAllWithRoles();
      setRoleCapabilityMap(capabilityRolesMap);

    } catch (error) {
      console.error('获取角色列表失败', error);
      setTimeout(() => {
        message.error('获取角色列表失败');
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

          // 添加到分类列表
          setTempCategories(prev => [...prev, ...newTempCategories]);
          console.log('从现有能力中添加的临时类型:', newTempCategories);
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
        message.success('能力更新成功');
      } else {
        const response = await capabilityAPI.create(capabilityValues);
        capabilityId = response.data?.id;
        message.success('能力创建成功');
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
      console.error(editingCapabilityId ? '更新能力失败' : '创建能力失败', error);
      message.error(editingCapabilityId ? '更新能力失败' : '创建能力失败');
    }
  };

  // 处理删除能力
  const handleDeleteCapability = (record) => {
    modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除能力 "${record.name}" 吗？`,
      onOk: async () => {
        try {
          await capabilityAPI.delete(record.id);
          message.success('能力删除成功');
          fetchCapabilities();
        } catch (error) {
          message.error('删除能力失败');
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
        title: `${server.id} 服务器`,
        value: `server:${server.id}`, // 特殊前缀，用于标识这是服务器节点
        key: `server:${server.id}`,
        children: children,
        selectable: true, // 允许选择服务器节点
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
        console.error('无法确定要使用的表单实例');
        return; // 如果无法确定表单实例，直接返回
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
      console.error('更新表单值失败:', error);
    }
  };

  // 创建TreeSelect通用配置
  const getTreeSelectProps = (onChange?: (value: any) => void) => ({
    treeData: convertToTreeData(),
    treeCheckable: true,
    showCheckedStrategy: TreeSelect.SHOW_CHILD,
    placeholder: "请选择要关联的工具",
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
          console.error('处理服务器标签关闭失败:', error);
          message.error('移除服务器工具失败，请重试');
        }
      } else {
        console.error('无法获取有效的表单实例');
        message.error('移除服务器工具失败，请重试');
      }
    };

    // 返回格式化的标签
    return (
      <Tag
        closable={closable}
        onClose={handleServerTagClose}
        color="blue"
      >
        {server}[{toolCount}个工具已选]
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

      message.success('角色关联更新成功');
      setAssignModalVisible(false);
      // 重新获取角色关联数据
      await fetchRoles();
    } catch (error) {
      console.error('更新角色关联失败:', error);
      message.error('更新角色关联失败');
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
      'core': '基础能力',
      'advanced': '高级能力',
      'supervision': '监督能力',
      'execution': '执行能力',
      'specialized': '专业能力'
    };

    return <Tag color={typeColors[type] || 'default'}>{typeLabels[type] || '未知'}</Tag>;
  };

  // 打开关联工具模态框
  const showAssignToolsModal = async (record) => {
    setSelectedCapability(record);

    // 显示加载中的消息
    message.loading({
      content: '正在加载所有服务器工具，请稍候...',
      key: 'loadingTools',
      duration: 0
    });

    // 首先获取所有服务器的工具列表
    await fetchAllServerTools();

    // 关闭加载消息
    message.success({
      content: '所有服务器工具加载完成',
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

      message.success('工具关联更新成功');
      setAssignToolsModalVisible(false);

      // 重新获取能力与工具关联数据
      await fetchCapabilityTools();
    } catch (error) {
      console.error('更新工具关联失败:', error);
      message.error('更新工具关联失败');
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
      message.success(`已添加临时分类："${value}"，提交表单后生效`);

      // 更新表单值 - 由于只有能力管理，直接设置能力表单
      capabilityForm.setFieldsValue({ type: value });
    }
  };

  // 添加自定义分类到后端
  const addCustomCategory = async (name) => {
    if (!name || !name.trim()) return;

    try {
      await api.post('/capabilities/categories', { name: name.trim() });
      message.success(`已成功保存分类："${name}"`);

      // 获取更新后的分类列表
      const updatedCategories = await fetchCategories();

      // 从临时分类中移除
      setTempCategories(prev => prev.filter(cat => cat.name !== name.trim()));

      return updatedCategories;
    } catch (error) {
      console.error('添加分类失败:', error);
      message.error('添加分类失败');
      return null;
    }
  };

  // 能力列表列定义
  const capabilityColumns = [
    {
      title: '名称',
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
      title: '描述提示词',
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
      title: '类型',
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
          'core': '基础能力',
          'advanced': '高级能力',
          'supervision': '监督能力',
          'execution': '执行能力',
          'specialized': '专业能力'
        };

        // 如果是预定义类型，使用预定义的颜色和标签
        if (typeColors[type]) {
          return <Tag color={typeColors[type]}>{typeLabels[type] || type}</Tag>;
        }

        // 对于自定义类型，使用默认样式
        return <Tag color="default">{type}</Tag>;
      },
    },
    {
      title: '来源',
      dataIndex: 'created_by',
      key: 'resource_source',
      width: 100,
      render: (created_by, record) => {
        // 系统资源：created_by 为 null
        if (!created_by) {
          return (
            <Tooltip title="系统资源，所有用户可见可用">
              <Tag icon={<GlobalOutlined />} color="blue">
                系统
              </Tag>
            </Tooltip>
          );
        }

        // 用户共享资源：created_by 有值且 is_shared 为 true
        if (record.is_shared) {
          return (
            <Tooltip title="用户共享资源，所有用户可见可用">
              <Tag icon={<TeamOutlined />} color="green">
                共享
              </Tag>
            </Tooltip>
          );
        }

        // 私有资源：created_by 有值且 is_shared 为 false
        return (
          <Tooltip title="私有资源，仅创建者可见">
            <Tag icon={<LockOutlined />} color="orange">
              私有
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '关联服务器/工具',
      key: 'associated_tools',
      render: (_, record) => {
        const tools = capabilityToolsMap[record.name] || {};
        const serverList = Object.keys(tools);

        // 检查是否有关联工具
        if (!serverList || serverList.length === 0) {
          return <Tag color="default">无关联工具</Tag>;
        }

        // 使用树形结构展示服务器与工具
        return (
          <Popover
            content={
              <div style={{ maxWidth: 300, maxHeight: 300, overflow: 'auto' }}>
                {serverList.map(server => {
                  const serverTools = Array.isArray(tools[server]) ? tools[server] : [];
                  return (
                    <div key={server} style={{ marginBottom: '8px' }}>
                      <div style={{ fontWeight: 'bold', color: '#1677ff' }}>
                        {server}:
                      </div>
                      <div style={{ marginLeft: '16px' }}>
                        {serverTools.length > 0 ? (
                          serverTools.map(tool => (
                            <div key={`${server}-${tool}`} style={{ marginBottom: '4px' }}>
                              • {tool}
                            </div>
                          ))
                        ) : (
                          <div style={{ color: 'var(--custom-text-secondary)', fontStyle: 'italic' }}>无工具</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            }
            title="关联工具/服务器"
            placement="right"
            mouseEnterDelay={0.5}
            trigger="hover"
          >
            <Tag color="cyan" style={{ cursor: 'pointer' }}>
              {serverList.length} 个服务器
              {serverList.reduce((sum, server) => {
                const serverTools = Array.isArray(tools[server]) ? tools[server] : [];
                return sum + serverTools.length;
              }, 0) > 0 ? ' (点击查看详情)' : ' (无工具)'}
            </Tag>
          </Popover>
        );
      },
    },
    {
      title: '关联角色',
      key: 'associated_roles',
      render: (_, record) => {
        const relatedRoles = roleCapabilityMap[record.name] || [];

        // 检查是否有关联角色
        if (!relatedRoles || relatedRoles.length === 0) {
          return <Tag color="default">无关联角色</Tag>;
        }

        // 展示关联角色
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
                  title="关联角色"
                  placement="right"
                  mouseEnterDelay={0.5}
                >
                  <Tag color="geekblue" style={{ cursor: 'pointer' }}>
                    +{relatedRoles.length - 1} 个角色
                  </Tag>
                </Popover>
              </>
            )}
          </Space>
        );
      },
    },
    {
      title: '安全级别',
      dataIndex: 'security_level',
      key: 'security_level',
      render: (level) => {
        const colors = { 1: 'green', 2: 'orange', 3: 'red' };
        const texts = { 1: '低风险', 2: '中风险', 3: '高风险' };
        return <Tag color={colors[level] || 'default'}>{texts[level] || '未知'}</Tag>;
      }
    },
    {
      title: '默认启用',
      dataIndex: 'default_enabled',
      key: 'default_enabled',
      render: (enabled) => (
        <Tag color={enabled ? 'success' : 'default'}>
          {enabled ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Tooltip title="编辑能力">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showEditCapabilityModal(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title="关联角色">
            <Button
              type="text"
              icon={<TeamOutlined />}
              onClick={() => showAssignRoleModal(record)}
              style={{ color: '#722ed1' }}
            />
          </Tooltip>
          <Tooltip title="删除能力">
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
            新建能力
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
            <Tag color="blue">基础能力: {coreCapabilities.length}</Tag>
            <Tag color="purple">高级能力: {advancedCapabilities.length}</Tag>
            <Tag color="orange">监督能力: {supervisionCapabilities.length}</Tag>
            <Tag color="red">执行能力: {executionCapabilities.length}</Tag>
            <Tag color="cyan">专业能力: {specializedCapabilities.length}</Tag>
          </Space>
          <Space>
            <Tag color="default">总计: {capabilities.length}</Tag>
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
              key: cap.id // 确保每行有唯一的key
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
              showTotal: (total) => `共 ${total} 条`,
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
                  current: 1, // 切换每页条数时重置为第一页
                  pageSize: size,
                });
              }
            }}
            rowClassName={(record) => {
              // 为不同类型的能力添加不同的行样式
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

      {/* 能力编辑模态框 */}
      <Modal
        title={editingCapabilityId ? '编辑能力' : '新建能力'}
        open={capabilityModalVisible}
        onOk={capabilityForm.submit}
        onCancel={() => {
          setCapabilityModalVisible(false);
          capabilityForm.resetFields();
          setTempCategories([]); // 清空临时分类
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
            label="名称"
            rules={[{ required: true, message: '请输入能力名称' }]}
          >
            <Input placeholder="请输入能力名称，例如: environment_sensing" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述提示词"
            rules={[{ required: true, message: '请输入能力描述提示词' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入能力描述提示词，例如: 你具备记忆能力，在记忆的时候要使用记忆工具，比如read_graph来获取图谱信息、search_node来搜索知识节点" />
          </Form.Item>
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择能力类型' }]}
          >
            <Select
              placeholder="请选择能力类型"
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
                      <PlusOutlined /> 添加 "{customCategoryName}"
                    </div>
                  )}
                </>
              )}
            >
              <Select.Option value="core">基础能力</Select.Option>
              <Select.Option value="advanced">高级能力</Select.Option>
              <Select.Option value="supervision">监督能力</Select.Option>
              <Select.Option value="execution">执行能力</Select.Option>
              <Select.Option value="specialized">专业能力</Select.Option>
              {[...categories, ...tempCategories].map(category => {
                // 跳过已经有的固定选项
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
                    {tempCategories.some(c => c.id === category.id) && <Tag color="processing" style={{marginLeft: 4}}>未保存</Tag>}
                  </Select.Option>
                );
              })}
            </Select>
          </Form.Item>
          <Form.Item
            name="icon"
            label="图标"
          >
            <Input placeholder="请输入图标名称，例如: function" />
          </Form.Item>
          <Form.Item
            name="security_level"
            label="安全级别"
            rules={[{ required: true, message: '请选择安全级别' }]}
          >
            <Select placeholder="请选择安全级别">
              <Select.Option value={1}>低风险 (1级)</Select.Option>
              <Select.Option value={2}>中风险 (2级)</Select.Option>
              <Select.Option value={3}>高风险 (3级)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="default_enabled"
            valuePropName="checked"
          >
            <Checkbox>默认启用</Checkbox>
          </Form.Item>

          <Form.Item
            name="is_shared"
            valuePropName="checked"
            tooltip="勾选后，该能力将对所有用户可见可用（但只有创建者可编辑）"
          >
            <Checkbox>
              <Space>
                <TeamOutlined />
                共享给所有用户
              </Space>
            </Checkbox>
          </Form.Item>

          <Form.Item
            name="tools"
            label="关联工具"
          >
            <TreeSelect
              key={treeSelectKey}
              treeData={convertToTreeData()}
              treeCheckable={true}
              showCheckedStrategy={TreeSelect.SHOW_CHILD}
              placeholder="请选择要关联的工具"
              style={{ width: '100%' }}
              onChange={(value) => {
                console.log('能力编辑模态框选择变化:', value);
                handleTreeSelectChange(value, capabilityForm);
              }}
              treeDefaultExpandAll
              allowClear
              showSearch
              tagRender={renderTreeSelectTags}
              filterTreeNode={(input: any, node: any) => {
                if (node.title && typeof node.title !== 'string') {
                  // 处理React节点
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
            message="提示"
            description="请选择该能力可以使用的工具。拥有此能力的角色将可以使用这些工具。系统会自动加载所有可用的工具，包括所有MCP服务器工具和自定义工具。"
            type="info"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        </Form>
      </Modal>

      {/* 关联角色模态框 */}
      <Modal
        title={`关联角色 - ${selectedCapability?.name || ''}`}
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
            label="选择角色"
            rules={[{ required: false, message: '请选择要关联的角色' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择要关联的角色"
              style={{ width: '100%' }}
              options={roles.map(role => ({
                label: role.name,
                value: role.id
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 关联工具模态框 */}
      <Modal
        title={`关联工具 - ${selectedCapability?.name || ''}`}
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
            label="选择工具"
            rules={[{ required: false, message: '请选择要关联的工具' }]}
          >
            <TreeSelect
              key={treeSelectKey}
              treeData={convertToTreeData()}
              treeCheckable={true}
              showCheckedStrategy={TreeSelect.SHOW_CHILD}
              placeholder="请选择要关联的工具"
              style={{ width: '100%' }}
              onChange={(value) => {
                console.log('关联工具模态框选择变化:', value);
                handleTreeSelectChange(value, assignToolsForm);
              }}
              treeDefaultExpandAll
              allowClear
              showSearch
              tagRender={renderTreeSelectTags}
              filterTreeNode={(input: any, node: any) => {
                if (node.title && typeof node.title !== 'string') {
                  // 处理React节点
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
            message="提示"
            description="请选择该能力可以使用的工具。拥有此能力的角色将可以使用这些工具。系统会自动加载所有可用的工具，包括所有MCP服务器工具和自定义工具。"
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