import React from 'react';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';

/**
 * 删除文件确认对话框组件
 */
const DeleteWorkspaceModal = ({ visible, onCancel, onConfirm }: any) => {
  const { t } = useTranslation();
  return (
    <Modal
      title={t('deleteWorkspace.title')}
      open={visible}
      onOk={onConfirm}
      onCancel={onCancel}
      okText={t('deleteWorkspace.ok')}
      cancelText={t('deleteWorkspace.cancel')}
    >
      <p>{t('deleteWorkspace.confirmText')}</p>
    </Modal>
  );
};

export default DeleteWorkspaceModal;
