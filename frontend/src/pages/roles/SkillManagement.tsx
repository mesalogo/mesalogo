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
      message.error(t('skillMgmt.msg.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSaving(true);
      await skillAPI.create(values);
      message.success(t('skillMgmt.msg.createSuccess'));
      setCreateModalVisible(false);
      createForm.resetFields();
      fetchSkills();
    } catch (e) {
      if (e.errorFields) return;
      message.error(e.response?.data?.message || t('skillMgmt.msg.createFailed'));
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
      message.error(t('skillMgmt.msg.detailFailed'));
    }
  };

  const handleSaveBasicInfo = async () => {
    if (!selectedSkill) return;
    try {
      const values = await editForm.validateFields();
      setSaving(true);
      await skillAPI.update(selectedSkill.name, values);
      message.success(t('skillMgmt.msg.basicSaved'));
      fetchSkills();
    } catch (e) {
      if (e.errorFields) return;
      message.error(t('skillMgmt.msg.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContent = async () => {
    if (!selectedSkill) return;
    setSaving(true);
    try {
      await skillAPI.updateContent(selectedSkill.name, skillContent);
      message.success(t('skillMgmt.msg.contentSaved'));
    } catch (e) {
      message.error(t('skillMgmt.msg.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name) => {
    try {
      await skillAPI.delete(name);
      message.success(t('skillMgmt.msg.deleteSuccess'));
      fetchSkills();
    } catch (e) {
      message.error(t('skillMgmt.msg.deleteFailed'));
    }
  };

  const handleToggleEnabled = async (skill) => {
    try {
      await skillAPI.update(skill.name, { enabled: !skill.enabled });
      fetchSkills();
    } catch (e) {
      message.error(t('skillMgmt.msg.updateFailed'));
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
      message.error(t('skillMgmt.msg.exportFailed'));
    }
  };

  const handleImportPreview = async (file) => {
    setImportFile(file);
    try {
      const res = await skillAPI.importPreview(file);
      setImportPreview(res.data);
      setImportModalVisible(true);
    } catch (e) {
      message.error(t('skillMgmt.msg.previewFailed'));
    }
    return false;
  };

  const handleImportConfirm = async () => {
    if (!importFile || !importPreview) return;
    setImporting(true);
    try {
      await skillAPI.importConfirm(importFile, importPreview);
      message.success(t('skillMgmt.msg.importSuccess'));
      setImportModalVisible(false);
      setImportPreview(null);
      setImportFile(null);
      fetchSkills();
    } catch (e) {
      message.error(t('skillMgmt.msg.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await skillAPI.syncFilesystem();
      message.success(t('skillMgmt.msg.syncDone', { created: res.data?.created || 0, updated: res.data?.updated || 0 }));
      fetchSkills();
    } catch (e) {
      message.error(t('skillMgmt.msg.syncFailed'));
    } finally {
      setSyncing(false);
    }
  };

  const columns = [
    {
      title: t('skills.name'),
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
      title: t('skills.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      width: 300,
    },
    {
      title: t('skills.status'),
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled, record) => (
        <Switch
          checked={enabled}
          onChange={() => handleToggleEnabled(record)}
          checkedChildren={t('skillMgmt.switch.on')}
          unCheckedChildren={t('skillMgmt.switch.off')}
          size="small"
        />
      )
    },
    {
      title: t('skills.securityLevel'),
      dataIndex: 'security_level',
      key: 'security_level',
      width: 100,
      render: (level) => {
        const colors = { 1: 'green', 2: 'orange', 3: 'red' };
        const labels = { 1: t('skillMgmt.secLevel.low'), 2: t('skillMgmt.secLevel.mid'), 3: t('skillMgmt.secLevel.high') };
        return <Tag color={colors[level] || 'default'}>{labels[level] || level}</Tag>;
      }
    },
    {
      title: t('skills.actions'),
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t('skillMgmt.action.edit')}>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title={t('skillMgmt.action.export')}>
            <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleExport(record.name)} />
          </Tooltip>
          <Popconfirm title={t('skillMgmt.confirmDelete')} onConfirm={() => handleDelete(record.name)}>
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
              {t('skills.title')}
            </Title>
            <Text type="secondary">{t('skillMgmt.subtitle')}</Text>
          </div>
          <Space>
            <Button icon={<SyncOutlined spin={syncing} />} onClick={handleSync} loading={syncing}>
              {t('skills.sync')}
            </Button>
            <Upload beforeUpload={handleImportPreview} showUploadList={false} accept=".zip">
              <Button icon={<UploadOutlined />}>{t('skills.import')}</Button>
            </Upload>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
              {t('skills.create')}
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
          locale={{ emptyText: <Empty description={t('skills.empty')} /> }}
        />
      </Card>

      {/* create modal */}
      <Modal
        title={t('skills.createTitle')}
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => { setCreateModalVisible(false); createForm.resetFields(); }}
        confirmLoading={saving}
        width={600}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label={t('skillMgmt.field.nameKebab')} rules={[
            { required: true, message: t('skillMgmt.req.name') },
            { pattern: /^[a-z0-9][a-z0-9-]*$/, message: t('skillMgmt.req.namePattern') }
          ]}>
            <Input placeholder="e.g. financial-report" />
          </Form.Item>
          <Form.Item name="display_name" label={t('skillMgmt.field.displayName')}>
            <Input placeholder={t('skillMgmt.ph.displayName')} />
          </Form.Item>
          <Form.Item name="description" label={t('skillMgmt.field.triggerDesc')} rules={[{ required: true, message: t('skillMgmt.req.description') }]}
            extra={t('skillMgmt.extra.triggerDesc')}
          >
            <TextArea rows={3} placeholder={t('skillMgmt.ph.triggerDesc')} />
          </Form.Item>
          <Form.Item name="security_level" label={t('skillMgmt.field.securityLevel')} initialValue={1}>
            <Select options={[
              { value: 1, label: t('skillMgmt.secLevel.lowDesc') },
              { value: 2, label: t('skillMgmt.secLevel.midDesc') },
              { value: 3, label: t('skillMgmt.secLevel.highDesc') },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* edit modal */}
      <Modal
        title={t('skillMgmt.editTitle', { name: selectedSkill?.display_name || selectedSkill?.name || '' })}
        open={editModalVisible}
        onCancel={() => { setEditModalVisible(false); setSelectedSkill(null); editForm.resetFields(); }}
        footer={null}
        width={900}
        style={{ top: 20 }}
      >
        <Tabs items={[
          {
            key: 'basic',
            label: <span><SettingOutlined /> {t('skillMgmt.tab.basic')}</span>,
            children: (
              <div>
                <Form form={editForm} layout="vertical">
                  <Form.Item name="display_name" label={t('skillMgmt.field.displayName')}>
                    <Input placeholder={t('skillMgmt.ph.displayNameEdit')} />
                  </Form.Item>
                  <Form.Item name="description" label={t('skillMgmt.field.triggerDesc')} rules={[{ required: true, message: t('skillMgmt.req.description') }]}
                    extra={t('skillMgmt.extra.triggerDescEdit')}
                  >
                    <TextArea rows={3} />
                  </Form.Item>
                  <Form.Item name="security_level" label={t('skillMgmt.field.securityLevel')}
                    extra={t('skillMgmt.extra.levelExtra')}
                  >
                    <Select options={[
                      { value: 1, label: t('skillMgmt.secLevel.lowDesc') },
                      { value: 2, label: t('skillMgmt.secLevel.midDesc') },
                      { value: 3, label: t('skillMgmt.secLevel.highDescRestricted') },
                    ]} />
                  </Form.Item>
                </Form>
                <div style={{ textAlign: 'right' }}>
                  <Button type="primary" onClick={handleSaveBasicInfo} loading={saving}>{t('skillMgmt.save')}</Button>
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
                  <Button type="primary" onClick={handleSaveContent} loading={saving}>{t('skillMgmt.save')}</Button>
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
            label: <span><CodeOutlined /> {t('skillMgmt.tab.scripts')}</span>,
            children: (
              <div>
                {skillDetail?.scripts?.length > 0 ? (
                  <Table
                    dataSource={skillDetail.scripts}
                    rowKey="path"
                    size="small"
                    columns={[
                      { title: t('skillMgmt.col.fileName'), dataIndex: 'name', key: 'name' },
                      { title: t('skillMgmt.col.path'), dataIndex: 'path', key: 'path' },
                      { title: t('skillMgmt.col.size'), dataIndex: 'size', key: 'size', render: (s) => `${(s / 1024).toFixed(1)} KB` },
                    ]}
                    pagination={false}
                  />
                ) : (
                  <Empty description={t('skillMgmt.empty.scripts')} />
                )}
              </div>
            )
          },
          {
            key: 'references',
            label: <span><FolderOutlined /> {t('skillMgmt.tab.references')}</span>,
            children: (
              <div>
                {skillDetail?.references?.length > 0 ? (
                  <Table
                    dataSource={skillDetail.references}
                    rowKey="path"
                    size="small"
                    columns={[
                      { title: t('skillMgmt.col.fileName'), dataIndex: 'name', key: 'name' },
                      { title: t('skillMgmt.col.path'), dataIndex: 'path', key: 'path' },
                      { title: t('skillMgmt.col.size'), dataIndex: 'size', key: 'size', render: (s) => `${(s / 1024).toFixed(1)} KB` },
                    ]}
                    pagination={false}
                  />
                ) : (
                  <Empty description={t('skillMgmt.empty.references')} />
                )}
              </div>
            )
          },
          {
            key: 'assets',
            label: <span><FolderOutlined /> {t('skillMgmt.tab.assets')}</span>,
            children: (
              <div>
                {skillDetail?.assets?.length > 0 ? (
                  <Table
                    dataSource={skillDetail.assets}
                    rowKey="path"
                    size="small"
                    columns={[
                      { title: t('skillMgmt.col.fileName'), dataIndex: 'name', key: 'name' },
                      { title: t('skillMgmt.col.path'), dataIndex: 'path', key: 'path' },
                      { title: t('skillMgmt.col.size'), dataIndex: 'size', key: 'size', render: (s) => `${(s / 1024).toFixed(1)} KB` },
                    ]}
                    pagination={false}
                  />
                ) : (
                  <Empty description={t('skillMgmt.empty.assets')} />
                )}
              </div>
            )
          }
        ]} />
      </Modal>

      {/* import preview modal */}
      <Modal
        title={t('skillMgmt.importPreviewTitle')}
        open={importModalVisible}
        onOk={handleImportConfirm}
        onCancel={() => { setImportModalVisible(false); setImportPreview(null); setImportFile(null); }}
        confirmLoading={importing}
        okText={t('skillMgmt.confirmImport')}
      >
        {importPreview && (
          <div>
            <p><strong>{t('skillMgmt.preview.name')}</strong> {importPreview.name}</p>
            <p><strong>{t('skillMgmt.preview.description')}</strong> {importPreview.description || t('skillMgmt.preview.none')}</p>
            <p><strong>{t('skillMgmt.preview.scriptsCount')}</strong> {importPreview.scripts_count}</p>
            <p><strong>{t('skillMgmt.preview.referencesCount')}</strong> {importPreview.references_count}</p>
            <p><strong>{t('skillMgmt.preview.assetsCount')}</strong> {importPreview.assets_count}</p>
            {importPreview.exists && (
              <Tag color="warning">{t('skillMgmt.preview.existsWarn')}</Tag>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SkillManagement;
