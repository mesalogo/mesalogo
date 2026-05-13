import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Card,
  message
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { TextArea } = Input;
const { Option } = Select;

const EditModal = ({ visible, type, data, onSave, onCancel }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [editData, setEditData] = useState(null);

  useEffect(() => {
    if (visible && data) {
      setEditData(JSON.parse(JSON.stringify(data))); // 深拷贝
      if (type === 'roles' || type === 'rules') {
        // 角色和规则数组不需要设置表单值
      } else {
        form.setFieldsValue(data);
      }
    }
  }, [visible, data, type, form]);

  const handleSave = () => {
    if (type === 'roles') {
      // 验证角色数据
      if (!editData || editData.length === 0) {
        message.error(t('oneClick.edit.role.minError'));
        return;
      }

      for (let i = 0; i < editData.length; i++) {
        const role = editData[i];
        if (!role.name || !role.description || !role.system_prompt) {
          message.error(t('oneClick.edit.role.incompleteError', { index: i + 1 }));
          return;
        }
      }

      onSave(editData);
    } else if (type === 'rules') {
      // 验证规则数据
      if (!editData || editData.length === 0) {
        message.error(t('oneClick.edit.rule.minError'));
        return;
      }

      for (let i = 0; i < editData.length; i++) {
        const rule = editData[i];
        if (!rule.name || !rule.content) {
          message.error(t('oneClick.edit.rule.incompleteError', { index: i + 1 }));
          return;
        }
        // 确保规则类型为自然语言规则
        rule.type = 'llm';
      }

      onSave(editData);
    } else {
      form.validateFields().then(values => {
        onSave(values);
      }).catch(error => {
        console.error('表单验证失败:', error);
      });
    }
  };

  const handleAddRole = () => {
    const newRole = {
      name: '',
      description: '',
      system_prompt: ''
    };
    setEditData([...editData, newRole]);
  };

  const handleDeleteRole = (index) => {
    if (editData.length <= 1) {
      message.error(t('oneClick.edit.role.keepMinError'));
      return;
    }
    const newData = editData.filter((_, i) => i !== index);
    setEditData(newData);
  };

  const handleRoleChange = (index, field, value) => {
    const newData = [...editData];
    newData[index][field] = value;
    setEditData(newData);
  };

  const handleAddRule = () => {
    const newRule = {
      name: '',
      content: '',
      type: 'llm'  // 固定为自然语言规则
    };
    const currentData = Array.isArray(editData) ? editData : [];
    setEditData([...currentData, newRule]);
  };

  const handleDeleteRule = (index) => {
    const currentData = Array.isArray(editData) ? editData : [];
    if (currentData.length <= 1) {
      message.error(t('oneClick.edit.rule.keepMinError'));
      return;
    }
    const newData = currentData.filter((_, i) => i !== index);
    setEditData(newData);
  };

  const handleRuleChange = (index, field, value) => {
    const newData = [...editData];
    newData[index][field] = value;
    setEditData(newData);
  };

  const renderRolesEdit = () => (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="dashed" onClick={handleAddRole} icon={<PlusOutlined />}>
          {t('oneClick.edit.role.addBtn')}
        </Button>
      </div>
      {editData?.map((role, index) => (
        <Card
          key={index}
          title={t('oneClick.edit.role.cardTitle', { index: index + 1 })}
         
          style={{ marginBottom: 16 }}
          extra={
            editData.length > 1 && (
              <Button
                type="link"
                icon={<DeleteOutlined />}
                danger
                onClick={() => handleDeleteRole(index)}
              />
            )
          }
        >
          <Form layout="vertical">
            <Form.Item label={t('oneClick.edit.role.name')} required>
              <Input
                value={role.name}
                onChange={(e) => handleRoleChange(index, 'name', e.target.value)}
                placeholder={t('oneClick.edit.role.namePlaceholder')}
              />
            </Form.Item>
            <Form.Item label={t('oneClick.edit.role.desc')} required>
              <TextArea
                value={role.description}
                onChange={(e) => handleRoleChange(index, 'description', e.target.value)}
                placeholder={t('oneClick.edit.role.descPlaceholder')}
                rows={2}
              />
            </Form.Item>
            <Form.Item label={t('oneClick.edit.role.systemPrompt')} required>
              <TextArea
                value={role.system_prompt}
                onChange={(e) => handleRoleChange(index, 'system_prompt', e.target.value)}
                placeholder={t('oneClick.edit.role.systemPromptPlaceholder')}
                rows={4}
              />
            </Form.Item>
          </Form>
        </Card>
      ))}
    </div>
  );

  const renderRulesEdit = () => (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="dashed" onClick={handleAddRule} icon={<PlusOutlined />}>
          {t('oneClick.edit.rule.addBtn')}
        </Button>
      </div>
      {Array.isArray(editData) && editData.map((rule, index) => (
        <Card
          key={index}
          title={t('oneClick.edit.rule.cardTitle', { index: index + 1 })}
         
          style={{ marginBottom: 16 }}
          extra={
            Array.isArray(editData) && editData.length > 1 && (
              <Button
                type="link"
                icon={<DeleteOutlined />}
                danger
                onClick={() => handleDeleteRule(index)}
              />
            )
          }
        >
          <Form layout="vertical">
            <Form.Item label={t('oneClick.edit.rule.name')} required>
              <Input
                value={rule.name}
                onChange={(e) => handleRuleChange(index, 'name', e.target.value)}
                placeholder={t('oneClick.edit.rule.namePlaceholder')}
              />
            </Form.Item>
            <Form.Item label={t('oneClick.edit.rule.content')} required>
              <TextArea
                value={rule.content}
                onChange={(e) => handleRuleChange(index, 'content', e.target.value)}
                placeholder={t('oneClick.edit.rule.contentPlaceholder')}
                rows={6}
              />
            </Form.Item>
          </Form>
        </Card>
      ))}
    </div>
  );

  const renderFormEdit = () => (
    <Form form={form} layout="vertical">
      {type === 'actionSpace' && (
        <>
          <Form.Item name="name" label={t('oneClick.edit.space.name')} rules={[{ required: true, message: t('oneClick.edit.space.nameRequired') }]}>
            <Input placeholder={t('oneClick.edit.space.namePlaceholder')} />
          </Form.Item>
          <Form.Item name="description" label={t('oneClick.edit.space.desc')} rules={[{ required: true, message: t('oneClick.edit.space.descRequired') }]}>
            <TextArea rows={4} placeholder={t('oneClick.edit.space.descPlaceholder')} />
          </Form.Item>
        </>
      )}
      {type === 'task' && (
        <>
          <Form.Item name="title" label={t('oneClick.edit.task.titleLabel')} rules={[{ required: true, message: t('oneClick.edit.task.titleRequired') }]}>
            <Input placeholder={t('oneClick.edit.task.titlePlaceholder')} />
          </Form.Item>
          <Form.Item name="description" label={t('oneClick.edit.task.desc')} rules={[{ required: true, message: t('oneClick.edit.task.descRequired') }]}>
            <TextArea rows={6} placeholder={t('oneClick.edit.task.descPlaceholder')} />
          </Form.Item>

        </>
      )}
    </Form>
  );

  const getTitle = () => {
    const titles = {
      roles: t('oneClick.edit.roles'),
      actionSpace: t('oneClick.edit.actionSpace'),
      rules: t('oneClick.edit.rules'),
      task: t('oneClick.edit.task')
    };
    return titles[type] || t('oneClick.edit.default');
  };

  return (
    <Modal
      title={getTitle()}
      open={visible}
      onCancel={onCancel}
      width={800}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('oneClick.edit.cancel')}</Button>
          <Button type="primary" onClick={handleSave}>
            {t('oneClick.edit.save')}
          </Button>
        </Space>
      }
    >
      {type === 'roles' && renderRolesEdit()}
      {type === 'rules' && renderRulesEdit()}
      {(type === 'actionSpace' || type === 'task') && renderFormEdit()}
    </Modal>
  );
};

export default EditModal;
