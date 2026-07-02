import React, { useState } from 'react';
import { Card, Input, Button, Select, Space, Alert, Spin, Typography, Tag, Divider, InputNumber } from 'antd';
import { SearchOutlined, ThunderboltOutlined, GlobalOutlined, AimOutlined, BranchesOutlined, MergeCellsOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import knowledgeAPI from '../../../services/api/knowledge';
import { MarkdownRenderer } from '../../actiontask/components/ConversationExtraction';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

interface LightRAGQueryTestProps {
  knowledgeId: string;
  defaultMode?: string;
  enableModeSelection?: boolean;
}

const LightRAGQueryTest: React.FC<LightRAGQueryTestProps> = ({
  knowledgeId,
  defaultMode = 'mix',
  enableModeSelection = true,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState(defaultMode);
  const [topK, setTopK] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleQuery = async () => {
    if (!query.trim()) {
      setError(t('lightragQueryTest.enterQuery'));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await knowledgeAPI.lightrag.query(knowledgeId, {
        query: query.trim(),
        mode: mode as any,
        top_k: topK,
      });

      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.message || t('lightragQueryTest.queryFailed'));
      }
    } catch (err: any) {
      console.error('Query failed:', err);
      setError(err.message || t('lightragQueryTest.queryFailed'));
    } finally {
      setLoading(false);
    }
  };

  const getModeIcon = (m: string) => {
    switch (m) {
      case 'naive': return <ThunderboltOutlined />;
      case 'local': return <AimOutlined />;
      case 'global': return <GlobalOutlined />;
      case 'hybrid': return <BranchesOutlined />;
      case 'mix': return <MergeCellsOutlined />;
      default: return <SearchOutlined />;
    }
  };

  const getModeDescription = (m: string) => {
    switch (m) {
      case 'naive': return t('lightragQueryTest.mode.naiveDesc');
      case 'local': return t('lightragQueryTest.mode.localDesc');
      case 'global': return t('lightragQueryTest.mode.globalDesc');
      case 'hybrid': return t('lightragQueryTest.mode.hybridDesc');
      case 'mix': return t('lightragQueryTest.mode.mixDesc');
      default: return '';
    }
  };

  return (
    <div>
      <Alert
        message={t('lightragQueryTest.alertTitle')}
        description={t('lightragQueryTest.alertDesc')}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card title={t('lightragQueryTest.configTitle')} style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>{t('lightragQueryTest.queryContent')}</Text>
            <TextArea
              rows={4}
              placeholder={t('lightragQueryTest.queryPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ marginTop: 8 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            {enableModeSelection && (
              <div style={{ flex: 1 }}>
                <Text strong>{t('lightragQueryTest.queryMode')}</Text>
                <Select
                  value={mode}
                  onChange={setMode}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  <Option value="naive">
                    <Space>
                      {getModeIcon('naive')}
                      Naive - {getModeDescription('naive')}
                    </Space>
                  </Option>
                  <Option value="local">
                    <Space>
                      {getModeIcon('local')}
                      Local - {getModeDescription('local')}
                    </Space>
                  </Option>
                  <Option value="global">
                    <Space>
                      {getModeIcon('global')}
                      Global - {getModeDescription('global')}
                    </Space>
                  </Option>
                  <Option value="hybrid">
                    <Space>
                      {getModeIcon('hybrid')}
                      Hybrid - {getModeDescription('hybrid')}
                    </Space>
                  </Option>
                  <Option value="mix">
                    <Space>
                      {getModeIcon('mix')}
                      Mix - {getModeDescription('mix')}
                    </Space>
                  </Option>
                </Select>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Text strong>Top-K</Text>
              <InputNumber
                min={1}
                max={50}
                value={topK}
                onChange={(val) => setTopK(val || 10)}
                style={{ width: 100, marginTop: 8 }}
              />
            </div>
          </div>

          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleQuery}
            loading={loading}
            block
          >
            {t('lightragQueryTest.queryBtn')}
          </Button>
        </Space>
      </Card>

      {loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">{t('lightragQueryTest.querying')}</Text>
            </div>
          </div>
        </Card>
      )}

      {error && (
        <Alert
          message={t('lightragQueryTest.queryFailed')}
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
        />
      )}

      {result && !loading && (
        <Card title={t('lightragQueryTest.resultTitle')}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Space>
                <Tag color="blue">{t('lightragQueryTest.modeLabel', { mode: result.mode || mode })}</Tag>
                <Tag color="green">{t('lightragQueryTest.elapsedLabel', { time: result.elapsed_time || '-' })}</Tag>
                {result.sources_count && (
                  <Tag color="purple">{t('lightragQueryTest.sourcesLabel', { count: result.sources_count })}</Tag>
                )}
              </Space>
            </div>

            <Divider />

            <div>
              <Title level={5}>{t('lightragQueryTest.answerTitle')}</Title>
              <Card style={{ backgroundColor: '#f5f5f5' }}>
                <MarkdownRenderer content={result.result?.response || result.answer || result.response || t('lightragQueryTest.noResult')} />
              </Card>
            </div>

            {(result.result?.references || result.sources) && (result.result?.references?.length > 0 || result.sources?.length > 0) && (
              <div>
                <Title level={5}>{t('lightragQueryTest.sourceDocsTitle')}</Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {(result.result?.references || result.sources || []).map((source: any, index: number) => (
                    <Card key={index} size="small">
                      <Paragraph ellipsis={{ rows: 3, expandable: true }}>
                        {source.content || source.text || source.file_path || t('lightragQueryTest.noContent')}
                      </Paragraph>
                      {(source.metadata || source.file_path) && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {t('lightragQueryTest.sourceLabel', { value: source.metadata?.source || source.metadata?.file_name || source.file_path || t('lightragQueryTest.unknownSource') })}
                        </Text>
                      )}
                    </Card>
                  ))}
                </Space>
              </div>
            )}
          </Space>
        </Card>
      )}
    </div>
  );
};

export default LightRAGQueryTest;
