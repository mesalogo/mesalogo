import React, { useState } from 'react';
import { Modal, Form, Input, Select, InputNumber, Switch, Divider, Typography, Space, Alert } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

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
  const [kbType, setKbType] = useState<'vector' | 'lightrag'>('vector');

  return (
    <Modal
      title={editingId ? '编辑知识库' : '创建知识库'}
      open={visible}
      onOk={() => form.submit()}
      onCancel={onCancel}
      width={600}
      okText="确定"
      cancelText="取消"
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
        {/* 基本信息 */}
        <Form.Item
          label="知识库名称"
          name="name"
          rules={[{ required: true, message: '请输入知识库名称' }]}
        >
          <Input placeholder="请输入知识库名称" />
        </Form.Item>

        <Form.Item
          label="描述"
          name="description"
        >
          <TextArea rows={3} placeholder="请输入知识库描述" />
        </Form.Item>

        {/* 知识库类型 */}
        {!editingId && (
          <>
            <Divider>知识库类型</Divider>
            <Alert
              message="知识库类型创建后不可修改"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form.Item
              label="类型"
              name="kb_type"
              tooltip="Vector: 传统向量检索；LightRAG: 知识图谱增强检索"
            >
              <Select onChange={(value) => setKbType(value)}>
                <Option value="vector">Vector（向量检索）</Option>
                <Option value="lightrag">LightRAG（图谱增强）</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {/* LightRAG 配置（仅在创建 LightRAG 类型时显示） */}
        {!editingId && kbType === 'lightrag' && (
          <>
            <Divider>LightRAG 配置</Divider>
            <Alert
              message="以下配置创建后不可修改，请谨慎设置"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Form.Item
              label="文档分块大小"
              name={['lightrag_config', 'chunk_size']}
              tooltip="文档分块的字符数，影响检索粒度"
            >
              <InputNumber min={500} max={5000} step={100} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label="分块重叠大小"
              name={['lightrag_config', 'chunk_overlap']}
              tooltip="相邻分块的重叠字符数"
            >
              <InputNumber min={0} max={500} step={50} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label="摘要语言"
              name={['lightrag_config', 'summary_language']}
              tooltip="知识图谱摘要的语言"
            >
              <Select>
                <Option value="Chinese">中文</Option>
                <Option value="English">英文</Option>
              </Select>
            </Form.Item>

            <Divider>查询配置（可修改）</Divider>

            <Form.Item
              label="默认查询模式"
              name={['lightrag_config', 'default_query_mode']}
              tooltip="查询时使用的默认模式"
            >
              <Select>
                <Option value="naive">Naive（纯向量检索，最快）</Option>
                <Option value="local">Local（基于实体的图谱检索）</Option>
                <Option value="global">Global（基于关系的图谱检索）</Option>
                <Option value="hybrid">Hybrid（实体+关系混合）</Option>
                <Option value="mix">Mix（图谱+向量混合，推荐）</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="允许用户切换模式"
              name={['lightrag_config', 'enable_mode_selection']}
              valuePropName="checked"
              tooltip="是否允许用户在查询时选择不同的模式"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              label="Top-K"
              name={['lightrag_config', 'top_k']}
              tooltip="每次查询返回的结果数量"
            >
              <InputNumber min={1} max={50} style={{ width: '100%' }} />
            </Form.Item>
          </>
        )}

        {/* 共享设置 */}
        <Divider>共享设置</Divider>
        <Form.Item
          label="是否共享"
          name="is_shared"
          valuePropName="checked"
          tooltip="共享后其他用户可以查看和使用此知识库"
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default KnowledgeFormModal;
