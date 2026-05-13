import React, { useState } from 'react';
import { Typography, Button, Space, App } from 'antd';
import { PlusOutlined, CloudOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useRoleManagement } from './useRoleManagement';
import RoleTable from './RoleTable';
import InternalRoleModal from './InternalRoleModal';
import ExternalRoleModal from './ExternalRoleModal';
import skillAPI from '../../services/api/skill';

const { Title, Text } = Typography;

const RoleManagement = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  
  const {
    roles,
    models,
    capabilities,
    allKnowledges,
    actionSpaces,
    globalSettings,
    loading,
    loadingModels,
    loadingCapabilities,
    loadingKnowledges,
    fetchRoles,
    createRole,
    updateRole,
    deleteRole,
    updateRoleCapabilities,
    updateRoleKnowledges
  } = useRoleManagement();

  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);

  const showAddModal = () => {
    setSelectedRole(null);
    setModalVisible(true);
  };

  const showImportModal = () => {
    setSelectedRole(null);
    setImportModalVisible(true);
  };

  const showEditModal = (role) => {
    setSelectedRole(role);
    if (role.source === 'external') {
      setImportModalVisible(true);
    } else {
      setModalVisible(true);
    }
  };

  const handleInternalModalOk = async ({ values, selectedCapabilities, selectedKnowledges, roleKnowledges, selectedSkills }) => {
    try {
      const formData = {
        name: values.name,
        model: values.model,
        system_prompt: values.systemPrompt,
        description: values.description,
        source: values.source || 'internal',
        is_shared: values.is_shared || false,
        temperature: values.temperature,
        topP: values.topP || 1,
        frequencyPenalty: values.frequencyPenalty || 0,
        presencePenalty: values.presencePenalty || 0,
        stopSequences: values.stopSequences || [],
        capabilities: values.capabilities || {}
      };

      if (selectedRole) {
        await updateRole(selectedRole.id, formData);
        await updateRoleCapabilities(selectedRole.id, selectedCapabilities);
        await updateRoleKnowledges(selectedRole.id, selectedKnowledges, roleKnowledges);
        if (selectedSkills) {
          try {
            await skillAPI.bindRoleSkills(selectedRole.id, selectedSkills);
          } catch (error) {
            console.error('角色技能绑定失败:', error);
          }
        }
      } else {
        const result = await createRole(formData);
        if (result && result.id) {
          const newRoleId = result.id;

          try {
            await updateRoleCapabilities(newRoleId, selectedCapabilities);
          } catch (error) {
            console.error('新角色能力绑定失败:', error);
            message.warning('角色创建成功，但部分能力绑定失败');
          }

          if (selectedKnowledges.length > 0) {
            try {
              await updateRoleKnowledges(newRoleId, selectedKnowledges, []);
            } catch (error) {
              console.error('新角色知识库绑定失败:', error);
            }
          }

          if (selectedSkills && selectedSkills.length > 0) {
            try {
              await skillAPI.bindRoleSkills(newRoleId, selectedSkills);
            } catch (error) {
              console.error('新角色技能绑定失败:', error);
            }
          }
        }
      }

      setModalVisible(false);
      await fetchRoles();
    } catch (error) {
      console.error('保存角色失败:', error);
      message.error('保存角色失败，请检查表单内容');
    }
  };

  const handleExternalModalOk = async (apiValues, currentRole) => {
    try {
      if (currentRole && currentRole.source === 'external') {
        await updateRole(currentRole.id, apiValues);
        message.success('外部智能体更新成功');
      } else {
        await createRole(apiValues);
        message.success('外部智能体导入成功');
      }
      setImportModalVisible(false);
      await fetchRoles();
    } catch (error) {
      console.error('外部智能体操作失败:', error);
      throw error;
    }
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setSelectedRole(null);
  };

  const handleImportModalCancel = () => {
    setImportModalVisible(false);
    setSelectedRole(null);
  };

  const handleRefresh = (actionSpaceFilter) => {
    fetchRoles(actionSpaceFilter);
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>{t('roleManagement.title')}</Title>
            <Text type="secondary">{t('roleManagement.subtitle')}</Text>
          </div>
          <Space>
            <Button
              type="default"
              icon={<CloudOutlined />}
              onClick={showImportModal}
            >
              {t('roleManagement.importRole')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={showAddModal}
            >
              {t('roleManagement.createRole')}
            </Button>
          </Space>
        </div>
      </div>

      <RoleTable
        roles={roles}
        models={models}
        loading={loading}
        actionSpaces={actionSpaces}
        onEdit={showEditModal}
        onDelete={deleteRole}
        onRefresh={handleRefresh}
      />

      <InternalRoleModal
        visible={modalVisible}
        selectedRole={selectedRole}
        models={models}
        loadingModels={loadingModels}
        capabilities={capabilities}
        loadingCapabilities={loadingCapabilities}
        allKnowledges={allKnowledges}
        loadingKnowledges={loadingKnowledges}
        globalSettings={globalSettings}
        onOk={handleInternalModalOk}
        onCancel={handleModalCancel}
      />

      <ExternalRoleModal
        visible={importModalVisible}
        selectedRole={selectedRole}
        globalSettings={globalSettings}
        onOk={handleExternalModalOk}
        onCancel={handleImportModalCancel}
      />
    </div>
  );
};

export default RoleManagement;
