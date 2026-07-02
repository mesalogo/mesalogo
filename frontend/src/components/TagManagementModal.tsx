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
import { useTranslation } from 'react-i18next';
import { actionSpaceAPI } from '../services/api/actionspace';

const { Option } = Select;
const { TextArea } = Input;
const { Title } = Typography;

/**
 * 标签管理Modal组件
 * 支持标签的增删改查功能
 */
const TagManagementModal = ({ visible, onCancel, onTagsChange }) => {
  const { t } = useTranslation();
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
    { value: 'industry', label: t('tagModal.type.industry') },
    { value: 'scenario', label: t('tagModal.type.scenario') }
  ];

  // 加载标签列表
  const loadTags = async () => {
    setLoading(true);
    try {
      const tagsData = await actionSpaceAPI.getAllTags();
      setTags(tagsData);
    } catch (error) {
      message.error(t('tagModal.fetchFailed'));
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
      message.success(t('tagModal.deleteSuccess'));
      loadTags();
      // 通知父组件标签已更改
      if (onTagsChange) {
        onTagsChange();
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || t('tagModal.deleteFailed');
      const associatedSpaces = error.response?.data?.associated_spaces;

      if (associatedSpaces && associatedSpaces.length > 0) {
        message.error(t('tagModal.deleteFailedWithSpaces', { error: errorMsg, spaces: associatedSpaces.join('、') }));
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
        message.success(t('tagModal.updateSuccess'));
      } else {
        // 创建标签
        await actionSpaceAPI.createTag(processedValues);
        message.success(t('tagModal.createSuccess'));
      }

      setIsFormVisible(false);
      loadTags();
      // 通知父组件标签已更改
      if (onTagsChange) {
        onTagsChange();
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || (editingTag ? t('tagModal.updateFailed') : t('tagModal.createFailed'));
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
      title: t('tagModal.col.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Tag color={record.color} style={{ margin: 0 }}>
          {text}
        </Tag>
      )
    },
    {
      title: t('tagModal.col.type'),
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const typeOption = tagTypeOptions.find(opt => opt.value === type);
        return typeOption ? typeOption.label : type;
      }
    },
    {
      title: t('tagModal.col.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: t('tagModal.col.color'),
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
      title: t('tagModal.col.actions'),
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditTag(record)}
          >
            {t('tagModal.action.edit')}
          </Button>
          <Popconfirm
            title={t('tagModal.deleteConfirmTitle')}
            description={t('tagModal.deleteConfirmDesc')}
            onConfirm={() => handleDeleteTag(record.id)}
            okText={t('tagModal.deleteConfirmOk')}
            cancelText={t('tagModal.deleteConfirmCancel')}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
            >
              {t('tagModal.action.delete')}
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <>
      <Modal
        title={t('tagModal.title')}
        open={visible}
        onCancel={onCancel}
        width={800}
        style={{ top: 20 }}
        styles={{ body: { height: 500, overflow: 'hidden' } }}
        footer={[
          <Button key="close" onClick={onCancel}>
            {t('tagModal.close')}
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
              {t('tagModal.createBtn')}
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
        title={editingTag ? t('tagModal.form.editTitle') : t('tagModal.form.createTitle')}
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
            label={t('tagModal.form.nameLabel')}
            rules={[
              { required: true, message: t('tagModal.form.nameRequired') },
              { max: 50, message: t('tagModal.form.nameMaxLength') }
            ]}
          >
            <Input placeholder={t('tagModal.form.namePlaceholder')} />
          </Form.Item>

          <Form.Item
            name="type"
            label={t('tagModal.form.typeLabel')}
            rules={[{ required: true, message: t('tagModal.form.typeRequired') }]}
          >
            <Select placeholder={t('tagModal.form.typePlaceholder')}>
              {tagTypeOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label={t('tagModal.form.descriptionLabel')}
          >
            <TextArea
              rows={3}
              placeholder={t('tagModal.form.descriptionPlaceholder')}
              maxLength={200}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="color"
            label={t('tagModal.form.colorLabel')}
            rules={[{ required: true, message: t('tagModal.form.colorRequired') }]}
          >
            <ColorPicker
              presets={[
                {
                  label: t('tagModal.form.colorPresetLabel'),
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
