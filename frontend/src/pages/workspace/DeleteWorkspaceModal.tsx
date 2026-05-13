import React from 'react';
import { Modal } from 'antd';

/**
 * 删除文件确认对话框组件
 */
const DeleteWorkspaceModal = ({ visible, onCancel, onConfirm }: any) => {
  return (
    <Modal
      title="确认删除"
      open={visible}
      onOk={onConfirm}
      onCancel={onCancel}
      okText="删除"
      cancelText="取消"
    >
      <p>确定要删除这条记忆吗？此操作不可撤销。</p>
    </Modal>
  );
};

export default DeleteWorkspaceModal;
