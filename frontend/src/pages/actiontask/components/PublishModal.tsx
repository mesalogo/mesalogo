import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Radio,
  Checkbox,
  Input,
  Button,
  Space,
  Alert,
  Divider,
  message,
  DatePicker,
  Spin
} from 'antd';
import {
  CopyOutlined,
  LinkOutlined,
  CodeOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api/axios';

const { TextArea } = Input;

/**
 * 发布任务配置Modal
 * @param {boolean} visible - 是否显示Modal
 * @param {Function} onCancel - 取消回调
 * @param {Object} task - 任务对象
 */
const PublishModal = ({ visible, onCancel, task }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [existingPublish, setExistingPublish] = useState(null);
  const [checkingPublish, setCheckingPublish] = useState(false);

  // 检查任务是否已发布
  useEffect(() => {
    if (visible && task) {
      checkExistingPublish();
    }
  }, [visible, task]);

  const checkExistingPublish = async () => {
    setCheckingPublish(true);
    try {
      const response = await api.get(`/action-tasks/${task.id}/publish`);
      if (response.data.published) {
        setExistingPublish(response.data);
        setPublishResult(response.data);
        
        // 填充表单
        form.setFieldsValue({
          access_type: response.data.config.access_type,
          mode: response.data.config.mode,
          show_messages: response.data.config.show_messages,
          expires_at: response.data.config.expires_at ? moment(response.data.config.expires_at) : null
        });
      } else {
        setExistingPublish(null);
        setPublishResult(null);
        // 设置默认值
        form.setFieldsValue({
          access_type: 'public',
          mode: 'readonly',
          show_messages: true
        });
      }
    } catch (error) {
      console.error('检查发布状态失败:', error);
    } finally {
      setCheckingPublish(false);
    }
  };

  const handlePublish = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const publishData = {
        access_type: values.access_type,
        access_password: values.access_password,
        mode: values.mode,
        show_messages: values.show_messages,
        expires_at: values.expires_at ? values.expires_at.toISOString() : null
      };

      let response;
      if (existingPublish) {
        // 更新现有发布
        response = await api.put(`/action-tasks/${task.id}/publish`, publishData);
        message.success(t('publish.updateSuccess'));
        setPublishResult({
          ...existingPublish,
          config: response.data.config
        });
      } else {
        // 创建新发布
        response = await api.post(`/action-tasks/${task.id}/publish`, publishData);
        message.success(t('publish.publishSuccess'));
        setPublishResult(response.data);
        setExistingPublish(response.data);
      }
    } catch (error) {
      console.error('发布失败:', error);
      message.error(error.response?.data?.error || t('publish.publishFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async () => {
    Modal.confirm({
      title: t('publish.confirmUnpublish'),
      content: t('publish.confirmUnpublishDesc'),
      onOk: async () => {
        try {
          setLoading(true);
          await api.delete(`/action-tasks/${task.id}/publish`);
          message.success(t('publish.unpublishSuccess'));
          setPublishResult(null);
          setExistingPublish(null);
          form.resetFields();
        } catch (error) {
          console.error('取消发布失败:', error);
          message.error(error.response?.data?.error || t('publish.unpublishFailed'));
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const copyToClipboard = (text, successKey) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success(t(successKey));
    }).catch(() => {
      message.error(t('publish.copyFailed'));
    });
  };

  const handleCancel = () => {
    if (!publishResult) {
      form.resetFields();
    }
    onCancel();
  };

  return (
    <Modal
      title={existingPublish ? t('publish.manageTitle') : t('publish.title')}
      open={visible}
      onCancel={handleCancel}
      width={800}
      footer={null}
    >
      {checkingPublish ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin tip={t('publish.loading')} />
        </div>
      ) : publishResult ? (
        <div>
          <Alert
            message={t('publish.published')}
            description={t('publish.publishedDesc')}
            type="success"
            icon={<CheckCircleOutlined />}
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Divider>
            <LinkOutlined /> {t('publish.shareLink')}
          </Divider>
          <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            <TextArea
              value={publishResult.share_url}
              readOnly
              autoSize={{ minRows: 2, maxRows: 3 }}
              style={{ fontFamily: 'monospace' }}
            />
            <Button
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(publishResult.share_url, 'publish.linkCopied')}
            >
              {t('publish.copyLink')}
            </Button>
          </Space>

          <Divider>
            <CodeOutlined /> {t('publish.embedCode')}
          </Divider>
          <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            <TextArea
              value={publishResult.embed_code}
              readOnly
              autoSize={{ minRows: 3, maxRows: 5 }}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
            <Button
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(publishResult.embed_code, 'publish.codeCopied')}
            >
              {t('publish.copyCode')}
            </Button>
          </Space>

          <Divider />

          <Form
            form={form}
            layout="vertical"
            style={{ marginTop: 24 }}
          >
            <Form.Item
              label={t('publish.accessType')}
              name="access_type"
              rules={[{ required: true, message: t('publish.accessTypeRequired') }]}
            >
              <Radio.Group>
                <Radio value="public">{t('publish.accessPublic')}</Radio>
                <Radio value="password">{t('publish.accessPassword')}</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.access_type !== curr.access_type}>
              {({ getFieldValue }) =>
                getFieldValue('access_type') === 'password' ? (
                  <Form.Item
                    label={t('publish.password')}
                    name="access_password"
                    rules={[{ required: true, message: t('publish.passwordRequired') }]}
                  >
                    <Input.Password placeholder={t('publish.passwordPlaceholder')} />
                  </Form.Item>
                ) : null
              }
            </Form.Item>

            <Form.Item
              label={t('publish.mode')}
              name="mode"
              rules={[{ required: true, message: t('publish.modeRequired') }]}
              help={t('publish.modeHelp')}
            >
              <Radio.Group>
                <Radio value="readonly">{t('publish.modeReadonly')}</Radio>
                <Radio value="interactive">{t('publish.modeInteractive')}</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item label={t('publish.displayOptions')}>
              <Space orientation="vertical">
                <Form.Item name="show_messages" valuePropName="checked" noStyle>
                  <Checkbox>{t('publish.showMessages')}</Checkbox>
                </Form.Item>
              </Space>
            </Form.Item>

            <Form.Item
              label={t('publish.expiresAt')}
              name="expires_at"
              help={t('publish.expiresAtHelp')}
            >
              <DatePicker
                showTime
                format="YYYY-MM-DD HH:mm:ss"
                placeholder={t('publish.expiresAtPlaceholder')}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Form>

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleUnpublish} danger>
                {t('publish.unpublish')}
              </Button>
              <Button type="primary" onClick={handlePublish} loading={loading}>
                {t('publish.updateConfig')}
              </Button>
            </Space>
          </div>
        </div>
      ) : (
        <div>
          <Alert
            message={t('publish.info')}
            description={t('publish.infoDesc')}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form
            form={form}
            layout="vertical"
            initialValues={{
              access_type: 'public',
              mode: 'readonly',
              show_messages: true
            }}
          >
            <Form.Item
              label={t('publish.accessType')}
              name="access_type"
              rules={[{ required: true, message: t('publish.accessTypeRequired') }]}
            >
              <Radio.Group>
                <Radio value="public">{t('publish.accessPublic')}</Radio>
                <Radio value="password">{t('publish.accessPassword')}</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.access_type !== curr.access_type}>
              {({ getFieldValue }) =>
                getFieldValue('access_type') === 'password' ? (
                  <Form.Item
                    label={t('publish.password')}
                    name="access_password"
                    rules={[{ required: true, message: t('publish.passwordRequired') }]}
                  >
                    <Input.Password placeholder={t('publish.passwordPlaceholder')} />
                  </Form.Item>
                ) : null
              }
            </Form.Item>

            <Form.Item
              label={t('publish.mode')}
              name="mode"
              rules={[{ required: true, message: t('publish.modeRequired') }]}
              help={t('publish.modeHelp')}
            >
              <Radio.Group>
                <Radio value="readonly">{t('publish.modeReadonly')}</Radio>
                <Radio value="interactive">{t('publish.modeInteractive')}</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item label={t('publish.displayOptions')}>
              <Space orientation="vertical">
                <Form.Item name="show_messages" valuePropName="checked" noStyle>
                  <Checkbox>{t('publish.showMessages')}</Checkbox>
                </Form.Item>
              </Space>
            </Form.Item>

            <Form.Item
              label={t('publish.expiresAt')}
              name="expires_at"
              help={t('publish.expiresAtHelp')}
            >
              <DatePicker
                showTime
                format="YYYY-MM-DD HH:mm:ss"
                placeholder={t('publish.expiresAtPlaceholder')}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Form>

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCancel}>
                {t('publish.cancel')}
              </Button>
              <Button type="primary" onClick={handlePublish} loading={loading}>
                {t('publish.generateLink')}
              </Button>
            </Space>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default PublishModal;

