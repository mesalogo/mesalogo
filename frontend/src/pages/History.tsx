import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, message, Space, Tag } from 'antd';
import { DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const History = () => {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/conversations');
      if (!response.ok) throw new Error(t('history.loadFailed'));
      const data = await response.json();
      setConversations(data.conversations);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const handleView = (record) => {
    setSelectedConversation(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(t('history.deleteFailed'));
      message.success(t('history.deleteSuccess'));
      fetchConversations();
    } catch (error) {
      message.error(error.message);
    }
  };

  const columns = [
    {
      title: t('history.conversationId'),
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: t('history.mode'),
      dataIndex: 'mode',
      key: 'mode',
      render: (mode) => (
        <Tag color={mode === 'sequential' ? 'blue' : 'green'}>
          {mode === 'sequential' ? t('history.sequentialMode') : t('history.panelMode')}
        </Tag>
      ),
    },
    {
      title: t('history.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: t('history.messageCount'),
      dataIndex: 'message_count',
      key: 'message_count',
    },
    {
      title: t('history.actions'),
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            {t('history.view')}
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            {t('history.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card title="历史记录">
        <Table
          columns={columns}
          dataSource={conversations}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title={t('history.conversationDetail')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={null}
      >
        {selectedConversation && (
          <div>
            <h3>{t('history.conversationInfo')}</h3>
            <p>{t('history.mode')}：{selectedConversation.mode === 'sequential' ? t('history.sequentialMode') : t('history.panelMode')}</p>
            <p>{t('history.createdAt')}：{new Date(selectedConversation.created_at).toLocaleString()}</p>
            <p>{t('history.messageCount')}：{selectedConversation.message_count}</p>

            <h3 style={{ marginTop: 20 }}>{t('history.conversationContent')}</h3>
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              {selectedConversation.messages.map((msg, index) => (
                <div key={index} style={{ marginBottom: 16 }}>
                  <strong>{msg.speaker}:</strong>
                  <p style={{ margin: '8px 0 0 20px' }}>{msg.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default History; 