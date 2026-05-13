import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Modal, Form, Input, Tag, Switch,
  Typography, Upload, App, Tooltip, Popconfirm, Badge, Empty, Tabs, Select
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined,
  UploadOutlined, ThunderboltOutlined, FileTextOutlined,
  CodeOutlined, FolderOutlined, EyeOutlined, CopyOutlined, SyncOutlined, SettingOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import Editor from '@monaco-editor/react';
import skillAPI from '../../services/api/skill';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const SkillManagement = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [skillDetail, setSkillDetail] = useState(null);
  const [skillContent, setSkillContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [importPreview, setImportPreview] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await skillAPI.getAll();
      setSkills(res.data || []);
    } catch (e) {
      message.error('获取技能列表失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSaving(true);
      await skillAPI.create(values);
      message.success('技能创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      fetchSkills();
    } catch (e) {
      if (e.errorFields) return;
      message.error(e.response?.data?.message || '创建失败');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (skill) => {
    try {
      const res = await skillAPI.getByName(skill.name);
      setSkillDetail(res.data);
      const contentRes = await skillAPI.getContent(skill.name);
      setSkillContent(contentRes.data?.content || '');
      setSelectedSkill(skill);
      editForm.setFieldsValue({
        display_name: skill.display_name || '',
        description: skill.description || '',
        security_level: skill.security_level ?? 1,
      });
      setEditModalVisible(true);
    } catch (e) {
      message.error('获取技能详情失败');
    }
  };

  const handleSaveBasicInfo = async () => {
    if (!selectedSkill) return;
    try {
      const values = await editForm.validateFields();
      setSaving(true);
      await skillAPI.update(selectedSkill.name, values);
      message.success('基本信息已保存');
      fetchSkills();
    } catch (e) {
      if (e.errorFields) return;
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContent = async () => {
    if (!selectedSkill) return;
    setSaving(true);
    try {
      await skillAPI.updateContent(selectedSkill.name, skillContent);
      message.success('SKILL.md 保存成功');
    } catch (e) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name) => {
    try {
      await skillAPI.delete(name);
      message.success('删除成功');
      fetchSkills();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleToggleEnabled = async (skill) => {
    try {
      await skillAPI.update(skill.name, { enabled: !skill.enabled });
      fetchSkills();
    } catch (e) {
      message.error('更新失败');
    }
  };

  const handleExport = async (name) => {
    try {
      const blob = await skillAPI.exportSkill(name);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      message.error('导出失败');
    }
  };

  const handleImportPreview = async (file) => {
    setImportFile(file);
    try {
      const res = await skillAPI.importPreview(file);
      setImportPreview(res.data);
      setImportModalVisible(true);
    } catch (e) {
      message.error('预览失败');
    }
    return false;
  };

  const handleImportConfirm = async () => {
    if (!importFile || !importPreview) return;
    setImporting(true);
    try {
      await skillAPI.importConfirm(importFile, importPreview);
      message.success('导入成功');
      setImportModalVisible(false);
      setImportPreview(null);
      setImportFile(null);
      fetchSkills();
    } catch (e) {
      message.error('导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await skillAPI.syncFilesystem();
      message.success(`同步完成: 新增 ${res.data?.created || 0} 个，更新 ${res.data?.updated || 0} 个`);
      fetchSkills();
    } catch (e) {
      message.error('同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const columns = [
    {
      title: t('skills.name', '名称'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <span>📦</span>
          <span style={{ fontWeight: 500 }}>{record.display_name || text}</span>
          <Text type="secondary" style={{ fontSize: 12 }}>({text})</Text>
        </Space>
      )
    },
    {
      title: t('skills.description', '描述'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      width: 300,
    },
    {
      title: t('skills.status', '状态'),
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled, record) => (
        <Switch
          checked={enabled}
          onChange={() => handleToggleEnabled(record)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          size="small"
        />
      )
    },
    {
      title: t('skills.securityLevel', '安全等级'),
      dataIndex: 'security_level',
      key: 'security_level',
      width: 100,
      render: (level) => {
        const colors = { 1: 'green', 2: 'orange', 3: 'red' };
        const labels = { 1: '低', 2: '中', 3: '高' };
        return <Tag color={colors[level] || 'default'}>{labels[level] || level}</Tag>;
      }
    },
    {
      title: t('skills.actions', '操作'),
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="导出">
            <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleExport(record.name)} />
          </Tooltip>
          <Popconfirm title="确定删除该技能？" onConfirm={() => handleDelete(record.name)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
              <ThunderboltOutlined style={{ marginRight: 8 }} />
              {t('skills.title', '技能管理')}
            </Title>
            <Text type="secondary">管理和配置智能体可用的技能，技能绑定到角色后会在对话中自动激活</Text>
          </div>
          <Space>
            <Button icon={<SyncOutlined spin={syncing} />} onClick={handleSync} loading={syncing}>
              {t('skills.sync', '同步文件系统')}
            </Button>
            <Upload beforeUpload={handleImportPreview} showUploadList={false} accept=".zip">
              <Button icon={<UploadOutlined />}>{t('skills.import', '导入技能')}</Button>
            </Upload>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
              {t('skills.create', '新建技能')}
            </Button>
          </Space>
        </div>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={skills}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description={t('skills.empty', '暂无技能，点击"新建技能"或"导入技能"开始')} /> }}
        />
      </Card>

      {/* 新建技能 Modal */}
      <Modal
        title={t('skills.createTitle', '新建技能')}
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => { setCreateModalVisible(false); createForm.resetFields(); }}
        confirmLoading={saving}
        width={600}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="技能名称 (kebab-case)" rules={[
            { required: true, message: '请输入技能名称' },
            { pattern: /^[a-z0-9][a-z0-9-]*$/, message: '只允许小写字母、数字和连字符' }
          ]}>
            <Input placeholder="e.g. financial-report" />
          </Form.Item>
          <Form.Item name="display_name" label="显示名称">
            <Input placeholder="e.g. 财务报告生成" />
          </Form.Item>
          <Form.Item name="description" label="触发描述" rules={[{ required: true, message: '请输入描述' }]}
            extra="当用户请求匹配此描述时，Agent 会自动激活该技能"
          >
            <TextArea rows={3} placeholder="描述何时应该触发此技能..." />
          </Form.Item>
          <Form.Item name="security_level" label="安全等级" initialValue={1}>
            <Select options={[
              { value: 1, label: '低 - 只读操作' },
              { value: 2, label: '中 - 可修改文件' },
              { value: 3, label: '高 - 可执行脚本' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑技能 Modal */}
      <Modal
        title={`编辑技能: ${selectedSkill?.display_name || selectedSkill?.name || ''}`}
        open={editModalVisible}
        onCancel={() => { setEditModalVisible(false); setSelectedSkill(null); editForm.resetFields(); }}
        footer={null}
        width={900}
        style={{ top: 20 }}
      >
        <Tabs items={[
          {
            key: 'basic',
            label: <span><SettingOutlined /> 基本信息</span>,
            children: (
              <div>
                <Form form={editForm} layout="vertical">
                  <Form.Item name="display_name" label="显示名称">
                    <Input placeholder="中文显示名称" />
                  </Form.Item>
                  <Form.Item name="description" label="触发描述" rules={[{ required: true, message: '请输入描述' }]}
                    extra="模型根据此描述判断是否激活技能，需详细包含所有触发场景"
                  >
                    <TextArea rows={3} />
                  </Form.Item>
                  <Form.Item name="security_level" label="安全等级"
                    extra="等级 ≥ 3 时将禁止执行脚本"
                  >
                    <Select options={[
                      { value: 1, label: '低 - 只读操作' },
                      { value: 2, label: '中 - 可修改文件' },
                      { value: 3, label: '高 - 可执行脚本(受限)' },
                    ]} />
                  </Form.Item>
                </Form>
                <div style={{ textAlign: 'right' }}>
                  <Button type="primary" onClick={handleSaveBasicInfo} loading={saving}>保存</Button>
                </div>
              </div>
            )
          },
          {
            key: 'content',
            label: <span><FileTextOutlined /> SKILL.md</span>,
            children: (
              <div>
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="primary" onClick={handleSaveContent} loading={saving}>保存</Button>
                </div>
                <Editor
                  height="500px"
                  defaultLanguage="markdown"
                  value={skillContent}
                  onChange={(v) => setSkillContent(v || '')}
                  options={{ minimap: { enabled: false }, wordWrap: 'on', fontSize: 14 }}
                />
              </div>
            )
          },
          {
            key: 'scripts',
            label: <span><CodeOutlined /> 脚本</span>,
            children: (
              <div>
                {skillDetail?.scripts?.length > 0 ? (
                  <Table
                    dataSource={skillDetail.scripts}
                    rowKey="path"
                    size="small"
                    columns={[
                      { title: '文件名', dataIndex: 'name', key: 'name' },
                      { title: '路径', dataIndex: 'path', key: 'path' },
                      { title: '大小', dataIndex: 'size', key: 'size', render: (s) => `${(s / 1024).toFixed(1)} KB` },
                    ]}
                    pagination={false}
                  />
                ) : (
                  <Empty description="暂无脚本文件" />
                )}
              </div>
            )
          },
          {
            key: 'references',
            label: <span><FolderOutlined /> 参考资料</span>,
            children: (
              <div>
                {skillDetail?.references?.length > 0 ? (
                  <Table
                    dataSource={skillDetail.references}
                    rowKey="path"
                    size="small"
                    columns={[
                      { title: '文件名', dataIndex: 'name', key: 'name' },
                      { title: '路径', dataIndex: 'path', key: 'path' },
                      { title: '大小', dataIndex: 'size', key: 'size', render: (s) => `${(s / 1024).toFixed(1)} KB` },
                    ]}
                    pagination={false}
                  />
                ) : (
                  <Empty description="暂无参考资料" />
                )}
              </div>
            )
          },
          {
            key: 'assets',
            label: <span><FolderOutlined /> 资源文件</span>,
            children: (
              <div>
                {skillDetail?.assets?.length > 0 ? (
                  <Table
                    dataSource={skillDetail.assets}
                    rowKey="path"
                    size="small"
                    columns={[
                      { title: '文件名', dataIndex: 'name', key: 'name' },
                      { title: '路径', dataIndex: 'path', key: 'path' },
                      { title: '大小', dataIndex: 'size', key: 'size', render: (s) => `${(s / 1024).toFixed(1)} KB` },
                    ]}
                    pagination={false}
                  />
                ) : (
                  <Empty description="暂无资源文件" />
                )}
              </div>
            )
          }
        ]} />
      </Modal>

      {/* 导入预览 Modal */}
      <Modal
        title="导入技能预览"
        open={importModalVisible}
        onOk={handleImportConfirm}
        onCancel={() => { setImportModalVisible(false); setImportPreview(null); setImportFile(null); }}
        confirmLoading={importing}
        okText="确认导入"
      >
        {importPreview && (
          <div>
            <p><strong>技能名称:</strong> {importPreview.name}</p>
            <p><strong>描述:</strong> {importPreview.description || '无'}</p>
            <p><strong>脚本数:</strong> {importPreview.scripts_count}</p>
            <p><strong>参考资料数:</strong> {importPreview.references_count}</p>
            <p><strong>资源文件数:</strong> {importPreview.assets_count}</p>
            {importPreview.exists && (
              <Tag color="warning">同名技能已存在，导入将覆盖</Tag>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SkillManagement;
