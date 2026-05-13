import { useState, useRef, useEffect } from 'react';
import { Modal, Button, Typography, message, Spin } from 'antd';
import { CloseOutlined, CheckCircleOutlined, UploadOutlined } from '@ant-design/icons';
import api from '../../../services/api/axios';

const { Text } = Typography;

// 样式常量
const STYLES = {
  uploadArea: {
    borderRadius: '6px',
    padding: '24px',
    textAlign: 'center' as const,
    transition: 'all 0.3s ease',
    position: 'relative' as const
  },
  uploadAreaActive: {
    border: '2px dashed #1677ff',
    backgroundColor: 'var(--msg-human-bg)'
  },
  uploadAreaInactive: {
    border: '2px dashed var(--custom-border)',
    backgroundColor: 'var(--custom-header-bg)'
  },
  imageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '12px',
    maxHeight: '300px',
    overflowY: 'auto' as const
  },
  imageCard: {
    position: 'relative' as const,
    border: '1px solid var(--custom-border)',
    borderRadius: '6px',
    overflow: 'hidden',
    backgroundColor: 'var(--custom-header-bg)'
  },
  deleteButton: {
    position: 'absolute' as const,
    top: '4px',
    right: '4px',
    width: '24px',
    height: '24px',
    minWidth: '24px',
    padding: 0,
    fontSize: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
  },
  successBadge: {
    position: 'absolute' as const,
    top: '4px',
    left: '4px',
    backgroundColor: '#52c41a',
    color: 'white',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px'
  }
};

const ImageUploadModal = ({
  visible,
  onCancel,
  onConfirm,
  attachedImages = [],
  onImageUpload,
  onRemoveImage,
  disabled = false
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [formatInfo, setFormatInfo] = useState(null);
  const fileInputRef = useRef(null);

  // 获取后端支持的格式信息
  useEffect(() => {
    const fetchFormatInfo = async () => {
      try {
        const response = await api.get('/images/formats');
        if (response.data.success) {
          setFormatInfo(response.data.data);
        }
      } catch (error) {
        console.error('获取格式信息失败:', error);
        setError('无法获取支持的格式信息，请刷新页面重试');
      }
    };

    if (visible) {
      fetchFormatInfo();
    }
  }, [visible]);

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const handleFiles = async (files) => {
    const fileArray = Array.from(files);
    setError(null);
    setUploading(true);

    try {
      for (const file of fileArray) {
        // 读取文件为Base64
        const base64 = await fileToBase64(file);

        // 调用后端统一处理（包含验证和信息获取）
        const response = await api.post('/images/process', {
          base64,
          operation: 'info'
        });
        const result = response.data;

        if (result.success) {
          const imageData = {
            id: Date.now() + Math.random(),
            file,
            base64,
            info: result.data,
            preview: URL.createObjectURL(file as Blob)
          };

          if (onImageUpload) {
            await onImageUpload(imageData);
          }
          message.success('图片上传成功');
        } else {
          setError(result.message || '图像处理失败');
          message.error(result.message || '图片上传失败');
        }
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || '上传失败';
      setError(errorMsg);
      message.error(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled || uploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const openFileDialog = () => {
    if (!disabled && !uploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm(attachedImages);
    }
    onCancel();
  };

  return (
    <Modal
      title="图片上传"
      open={visible}
      onCancel={onCancel}
      width={600}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button 
          key="confirm" 
          type="primary" 
          onClick={handleConfirm}
          disabled={attachedImages.length === 0}
        >
          确定 ({attachedImages.length})
        </Button>
      ]}
    >


      {/* 图片上传区域 */}
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            ...STYLES.uploadArea,
            ...(dragActive ? STYLES.uploadAreaActive : STYLES.uploadAreaInactive),
            cursor: disabled || uploading ? 'not-allowed' : 'pointer'
          }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={openFileDialog}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={formatInfo?.formats?.map(f => `.${f}`).join(',') || ''}
            onChange={handleFileInput}
            style={{ display: 'none' }}
            disabled={disabled || uploading || !formatInfo}
          />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {uploading ? (
              <Spin size="large" />
            ) : (
              <UploadOutlined style={{ fontSize: '32px', color: dragActive ? '#1677ff' : 'var(--custom-text-secondary)' }} />
            )}
            <div style={{ fontSize: '16px', color: 'var(--custom-text)' }}>
              {uploading ? '上传中...' : (dragActive ? '释放文件' : '点击或拖拽上传图片')}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
              {formatInfo ? (
                `支持 ${formatInfo.formats.join(', ').toUpperCase()} 格式，最大 ${formatInfo.max_size_mb}MB`
              ) : (
                '加载格式信息中...'
              )}
            </div>
          </div>


        </div>

        {/* 错误信息 */}
        {error && (
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            backgroundColor: '#fff2f0',
            border: '1px solid #ffccc7',
            borderRadius: '4px',
            color: '#ff4d4f',
            fontSize: '12px'
          }}>
            {error}
          </div>
        )}
      </div>

      {/* 已上传的图片预览 */}
      {attachedImages.length > 0 && (
        <div>
          <div style={{ 
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '1px solid var(--custom-border)'
          }}>
            <Text strong>
              已选择的图片 ({attachedImages.length})
            </Text>
          </div>
          
          <div style={STYLES.imageGrid}>
            {attachedImages.map((image) => (
              <div key={image.id} style={STYLES.imageCard}>
                {/* 图片预览 */}
                <div style={{
                  width: '100%',
                  height: '100px',
                  backgroundColor: 'var(--custom-hover-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img
                    src={image.preview}
                    alt={image.file.name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </div>
                
                {/* 图片信息 */}
                <div style={{ 
                  padding: '8px',
                  backgroundColor: 'var(--custom-card-bg)'
                }}>
                  <div style={{ 
                    fontSize: '12px', 
                    color: 'var(--custom-text)',
                    fontWeight: 500,
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {image.file.name}
                  </div>
                  <div style={{ 
                    fontSize: '11px', 
                    color: 'var(--custom-text-secondary)',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>{image.info.format.toUpperCase()}</span>
                    <span>{(image.info.size / 1024).toFixed(1)}KB</span>
                  </div>
                  <div style={{ 
                    fontSize: '11px', 
                    color: 'var(--custom-text-secondary)',
                    marginTop: '2px'
                  }}>
                    {image.info.width}×{image.info.height}
                  </div>
                </div>
                
                {/* 删除按钮 */}
                <Button
                  type="primary"
                  danger
                  icon={<CloseOutlined />}
                 
                  onClick={() => onRemoveImage && onRemoveImage(image.id)}
                  style={STYLES.deleteButton}
                />

                {/* 成功标识 */}
                <div style={STYLES.successBadge}>
                  <CheckCircleOutlined />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ImageUploadModal;
