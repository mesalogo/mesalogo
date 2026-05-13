import { Select, Space } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = ({ size = 'small' }: { size?: 'small' | 'middle' | 'large' }) => {
  const { i18n } = useTranslation();

  const options = [
    { value: 'zh-CN', label: '中文' },
    { value: 'en-US', label: 'English' },
  ];

  const handleLanguageChange = (value) => {
    i18n.changeLanguage(value);
  };

  // 自定义渲染选项，将图标放在文本前面
  const renderOption = (option) => (
    <Space size={4}>
      <GlobalOutlined />
      <span>{option.label}</span>
    </Space>
  );

  // 自定义渲染选中的标签，将图标放在文本前面
  const renderLabel = (option) => (
    <Space size={4}>
      <GlobalOutlined />
      <span>{option.label}</span>
    </Space>
  );

  return (
    <Select
      size={size}
      value={i18n.language}
      onChange={handleLanguageChange}
      options={options}
      optionRender={(option) => renderOption(option.data)}
      labelRender={(props) => {
        const selectedOption = options.find(opt => opt.value === props.value);
        return selectedOption ? renderLabel(selectedOption) : null;
      }}
      variant="borderless"
      style={{ minWidth: 100 }}
    />
  );
};

export default LanguageSwitcher;
