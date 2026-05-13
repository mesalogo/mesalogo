import React, { useState, useEffect } from 'react';
import {
  Modal,
  Table,
  Button,
  Form,
  Input,
  Select,
  ColorPicker,
  Space,
  message,
  Popconfirm,
  Tag,
  Typography,
  Divider
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { actionSpaceAPI } from '../services/api/actionspace';

const { Option } = Select;
const { TextArea } = Input;
const { Title } = Typography;

/**
 * 标签管理Modal组件
 * 支持标签的增删改查功能
 */
const TagManagementModal = ({ visible, onCancel, onTagsChange }) => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [form] = Form.useForm();

  // 预定义的颜色选项
  const colorOptions = [
    '#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
    '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#2f54eb'
  ];

  // 标签类型选项
  const tagTypeOptions = [
    { value: 'industry', label: '行业标签' },
    { value: 'scenario', label: '场景标签' }
  ];

  // 加载标签列表
  const loadTags = async () => {
    setLoading(true);
    try {
      const tagsData = await actionSpaceAPI.getAllTags();
      setTags(tagsData);
    } catch (error) {
      message.error('获取标签列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载标签
  useEffect(() => {
    if (visible) {
      loadTags();
    }
  }, [visible]);

  // 处理新建标签
  const handleCreateTag = () => {
    setEditingTag(null);
    setIsFormVisible(true);
    form.resetFields();
    // 设置默认颜色
    form.setFieldsValue({ color: '#1677ff' });
  };

  // 处理编辑标签
  const handleEditTag = (tag) => {
    setEditingTag(tag);
    setIsFormVisible(true);
    form.setFieldsValue({
      name: tag.name,
      type: tag.type,
      description: tag.description,
      color: tag.color || '#1677ff' // 确保颜色值是字符串
    });
  };

  // 处理删除标签
  const handleDeleteTag = async (tagId) => {
    try {
      await actionSpaceAPI.deleteTag(tagId);
      message.success('标签删除成功');
      loadTags();
      // 通知父组件标签已更改
      if (onTagsChange) {
        onTagsChange();
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || '删除标签失败';
      const associatedSpaces = error.response?.data?.associated_spaces;

      if (associatedSpaces && associatedSpaces.length > 0) {
        message.error(`${errorMsg}：${associatedSpaces.join('、')}`);
      } else {
        message.error(errorMsg);
      }
    }
  };

  // 处理颜色值转换
  const processColorValue = (colorValue) => {
    if (typeof colorValue === 'string') {
      return colorValue;
    }

    // 处理Ant Design ColorPicker返回的对象
    if (colorValue && typeof colorValue === 'object') {
      // 尝试调用toHexString方法
      if (typeof colorValue.toHexString === 'function') {
        return colorValue.toHexString();
      }

      // 如果有metaColor属性，从中提取RGB值
      if (colorValue.metaColor && colorValue.metaColor.r !== undefined) {
        const { r, g, b } = colorValue.metaColor;
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
      }
    }

    // 默认返回蓝色
    return '#1677ff';
  };

  // 处理表单提交
  const handleFormSubmit = async (values) => {
    try {
      // 处理颜色值 - 确保转换为字符串格式
      const processedValues = {
        ...values,
        color: processColorValue(values.color)
      };

      if (editingTag) {
        // 更新标签
        await actionSpaceAPI.updateTag(editingTag.id, processedValues);
        message.success('标签更新成功');
      } else {
        // 创建标签
        await actionSpaceAPI.createTag(processedValues);
        message.success('标签创建成功');
      }

      setIsFormVisible(false);
      loadTags();
      // 通知父组件标签已更改
      if (onTagsChange) {
        onTagsChange();
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || (editingTag ? '更新标签失败' : '创建标签失败');
      message.error(errorMsg);
    }
  };

  // 处理表单取消
  const handleFormCancel = () => {
    setIsFormVisible(false);
    setEditingTag(null);
    form.resetFields();
  };

  // 表格列定义
  const columns = [
    {
      title: '标签名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Tag color={record.color} style={{ margin: 0 }}>
          {text}
        </Tag>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const typeOption = tagTypeOptions.find(opt => opt.value === type);
        return typeOption ? typeOption.label : type;
      }
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      width: 80,
      render: (color) => (
        <div
          style={{
            width: 20,
            height: 20,
            backgroundColor: color,
            borderRadius: 4,
            border: '1px solid var(--custom-border)'
          }}
        />
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
           
            icon={<EditOutlined />}
            onClick={() => handleEditTag(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个标签吗？"
            description="删除后无法恢复，且正在使用此标签的行动空间将受到影响。"
            onConfirm={() => handleDeleteTag(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
             
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <>
      <Modal
        title="标签管理"
        open={visible}
        onCancel={onCancel}
        width={800}
        style={{ top: 20 }}
        styles={{ body: { height: 500, overflow: 'hidden' } }}
        footer={[
          <Button key="close" onClick={onCancel}>
            关闭
          </Button>
        ]}
      >
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 16, flexShrink: 0 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateTag}
            >
              新建标签
            </Button>
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Table
              columns={columns}
              dataSource={tags}
              rowKey="id"
              loading={loading}
              pagination={false}
              scroll={{ y: 420 }}
              size="middle"
            />
          </div>
        </div>
      </Modal>

      {/* 标签编辑表单Modal */}
      <Modal
        title={editingTag ? '编辑标签' : '新建标签'}
        open={isFormVisible}
        onCancel={handleFormCancel}
        onOk={() => form.submit()}
        confirmLoading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFormSubmit}
        >
          <Form.Item
            name="name"
            label="标签名称"
            rules={[
              { required: true, message: '请输入标签名称' },
              { max: 50, message: '标签名称不能超过50个字符' }
            ]}
          >
            <Input placeholder="输入标签名称" />
          </Form.Item>

          <Form.Item
            name="type"
            label="标签类型"
            rules={[{ required: true, message: '请选择标签类型' }]}
          >
            <Select placeholder="选择标签类型">
              {tagTypeOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea
              rows={3}
              placeholder="输入标签描述（可选）"
              maxLength={200}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="color"
            label="标签颜色"
            rules={[{ required: true, message: '请选择标签颜色' }]}
          >
            <ColorPicker
              presets={[
                {
                  label: '推荐颜色',
                  colors: colorOptions
                }
              ]}
              showText
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default TagManagementModal;
