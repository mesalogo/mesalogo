import React, { useState } from 'react';
import { Modal, Form, Input, Select, InputNumber, Switch, Divider, Typography, Space, Alert } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

interface KnowledgeFormModalProps {
  visible: boolean;
  editingId: string | null;
  form: any;
  onSubmit: (values: any) => void;
  onCancel: () => void;
}

const KnowledgeFormModal: React.FC<KnowledgeFormModalProps> = ({
  visible,
  editingId,
  form,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [kbType, setKbType] = useState<'vector' | 'lightrag'>('vector');

  return (
    <Modal
      title={editingId ? t('knowledgeForm.editTitle') : t('knowledgeForm.createTitle')}
      open={visible}
      onOk={() => form.submit()}
      onCancel={onCancel}
      width={600}
      okText={t('knowledgeForm.ok')}
      cancelText={t('knowledgeForm.cancel')}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        initialValues={{
          kb_type: 'vector',
          is_shared: false,
          lightrag_config: {
            chunk_size: 1200,
            chunk_overlap: 100,
            summary_language: 'Chinese',
            default_query_mode: 'mix',
            enable_mode_selection: true,
            top_k: 10,
          },
        }}
      >
        {/* basic info */}
        <Form.Item
          label={t('knowledgeForm.name')}
          name="name"
          rules={[{ required: true, message: t('knowledgeForm.nameReq') }]}
        >
          <Input placeholder={t('knowledgeForm.namePh')} />
        </Form.Item>

        <Form.Item
          label={t('knowledgeForm.description')}
          name="description"
        >
          <TextArea rows={3} placeholder={t('knowledgeForm.descriptionPh')} />
        </Form.Item>

        {/* KB type */}
        {!editingId && (
          <>
            <Divider>{t('knowledgeForm.kbType')}</Divider>
            <Alert
              message={t('knowledgeForm.kbTypeImmutable')}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form.Item
              label={t('knowledgeForm.type')}
              name="kb_type"
              tooltip={t('knowledgeForm.typeTooltip')}
            >
              <Select onChange={(value) => setKbType(value)}>
                <Option value="vector">{t('knowledgeForm.typeVector')}</Option>
                <Option value="lightrag">{t('knowledgeForm.typeLightrag')}</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {/* LightRAG config */}
        {!editingId && kbType === 'lightrag' && (
          <>
            <Divider>{t('knowledgeForm.lightragConfig')}</Divider>
            <Alert
              message={t('knowledgeForm.lightragImmutable')}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Form.Item
              label={t('knowledgeForm.chunkSize')}
              name={['lightrag_config', 'chunk_size']}
              tooltip={t('knowledgeForm.chunkSizeTooltip')}
            >
              <InputNumber min={500} max={5000} step={100} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label={t('knowledgeForm.chunkOverlap')}
              name={['lightrag_config', 'chunk_overlap']}
              tooltip={t('knowledgeForm.chunkOverlapTooltip')}
            >
              <InputNumber min={0} max={500} step={50} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label={t('knowledgeForm.summaryLanguage')}
              name={['lightrag_config', 'summary_language']}
              tooltip={t('knowledgeForm.summaryLanguageTooltip')}
            >
              <Select>
                <Option value="Chinese">{t('knowledgeForm.langChinese')}</Option>
                <Option value="English">{t('knowledgeForm.langEnglish')}</Option>
              </Select>
            </Form.Item>

            <Divider>{t('knowledgeForm.queryConfig')}</Divider>

            <Form.Item
              label={t('knowledgeForm.defaultQueryMode')}
              name={['lightrag_config', 'default_query_mode']}
              tooltip={t('knowledgeForm.defaultQueryModeTooltip')}
            >
              <Select>
                <Option value="naive">{t('knowledgeForm.modeNaive')}</Option>
                <Option value="local">{t('knowledgeForm.modeLocal')}</Option>
                <Option value="global">{t('knowledgeForm.modeGlobal')}</Option>
                <Option value="hybrid">{t('knowledgeForm.modeHybrid')}</Option>
                <Option value="mix">{t('knowledgeForm.modeMix')}</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label={t('knowledgeForm.allowModeSelection')}
              name={['lightrag_config', 'enable_mode_selection']}
              valuePropName="checked"
              tooltip={t('knowledgeForm.allowModeSelectionTooltip')}
            >
              <Switch />
            </Form.Item>

            <Form.Item
              label="Top-K"
              name={['lightrag_config', 'top_k']}
              tooltip={t('knowledgeForm.topKTooltip')}
            >
              <InputNumber min={1} max={50} style={{ width: '100%' }} />
            </Form.Item>
          </>
        )}

        {/* sharing */}
        <Divider>{t('knowledgeForm.sharing')}</Divider>
        <Form.Item
          label={t('knowledgeForm.isShared')}
          name="is_shared"
          valuePropName="checked"
          tooltip={t('knowledgeForm.isSharedTooltip')}
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default KnowledgeFormModal;
