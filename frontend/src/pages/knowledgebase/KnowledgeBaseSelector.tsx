import React, { useState, useEffect, useMemo } from 'react';
import { Select, Empty, Spin, Typography, Space } from 'antd';
import { DatabaseOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import knowledgeAPI from '../../services/api/knowledge';

const { Text } = Typography;
const { Option } = Select;

/**
 * KnowledgeBaseSelector Component
 * 
 * A dropdown selector for choosing knowledge bases with search functionality
 * and empty state handling.
 */
const KnowledgeBaseSelector = ({
  value,
  onChange,
  knowledgeBases = [],
  placeholder,
  disabled = false,
  style = {},
  allowClear = true,
  showSearch = true,
  ...selectProps
}) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('kbSelector.placeholder');
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [localKnowledgeBases, setLocalKnowledgeBases] = useState(knowledgeBases);

  // Update local knowledge bases when prop changes
  useEffect(() => {
    setLocalKnowledgeBases(knowledgeBases);
  }, [knowledgeBases]);

  // Fetch knowledge bases if not provided via props
  useEffect(() => {
    if (knowledgeBases.length === 0) {
      fetchKnowledgeBases();
    }
  }, [knowledgeBases.length]);

  // Fetch knowledge bases from API
  const fetchKnowledgeBases = async () => {
    try {
      setLoading(true);
      const response = await knowledgeAPI.getAll();
      if (response.success) {
        setLocalKnowledgeBases(response.data || []);
      } else {
        console.error('Failed to fetch knowledge bases:', response.message);
        setLocalKnowledgeBases([]);
      }
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
      setLocalKnowledgeBases([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter knowledge bases based on search
  const filteredKnowledgeBases = useMemo(() => {
    if (!searchValue) {
      return localKnowledgeBases;
    }
    
    return localKnowledgeBases.filter(kb => 
      kb.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      (kb.description && kb.description.toLowerCase().includes(searchValue.toLowerCase()))
    );
  }, [localKnowledgeBases, searchValue]);

  // Handle selection change
  const handleChange = (selectedValue, option) => {
    if (onChange) {
      onChange(selectedValue, option);
    }
  };

  // Handle search input change
  const handleSearch = (value) => {
    setSearchValue(value);
  };

  // Render empty state when no knowledge bases exist
  const renderEmptyState = () => (
    <Empty
      image={<DatabaseOutlined style={{ fontSize: 48, color: 'var(--custom-border)' }} />}
      description={
        <Space orientation="vertical">
          <Text type="secondary">{t('kbSelector.empty')}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {t('kbSelector.emptyDesc')}
          </Text>
        </Space>
      }
      style={{ padding: '20px 0' }}
    />
  );

  // Render loading state
  if (loading) {
    return (
      <Select
        placeholder={resolvedPlaceholder}
        disabled={true}
        style={style}
        suffixIcon={<Spin />}
        {...selectProps}
      />
    );
  }

  // Render empty state if no knowledge bases
  if (localKnowledgeBases.length === 0) {
    return (
      <Select
        placeholder={t('kbSelector.empty')}
        disabled={true}
        style={style}
        popupRender={() => renderEmptyState()}
        {...selectProps}
      />
    );
  }

  return (
    <Select
      value={value}
      onChange={handleChange}
      placeholder={resolvedPlaceholder}
      disabled={disabled}
      style={style}
      allowClear={allowClear}
      showSearch={showSearch}
      onSearch={handleSearch}
      filterOption={false} // Use custom filtering
      suffixIcon={<DatabaseOutlined />}
      styles={{
        popup: {
          maxWidth: '400px',
          ...(selectProps.styles?.popup || {})
        }
      }}
      notFoundContent={
        searchValue ? (
          <Empty
            image={<SearchOutlined style={{ fontSize: 24, color: 'var(--custom-border)' }} />}
            description={
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {t('kbSelector.noMatch')}
              </Text>
            }
            style={{ padding: '10px 0' }}
          />
        ) : null
      }
      {...selectProps}
    >
      {filteredKnowledgeBases.map(kb => (
        <Option 
          key={kb.id} 
          value={kb.id}
          title={kb.description || kb.name}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DatabaseOutlined style={{ color: '#1677ff', flexShrink: 0 }} />
            <div style={{ 
              flex: 1, 
              minWidth: 0,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {kb.name}
            </div>
          </div>
        </Option>
      ))}
    </Select>
  );
};

export default KnowledgeBaseSelector;