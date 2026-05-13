"""
图像处理工具类

处理图像的基础功能，包括：
- Base64编码/解码
- 图像格式验证
- 图像信息获取
- 图像大小限制检查
"""

import base64
import io
import logging
from typing import Dict, Any, Tuple, Optional
from PIL import Image
import imghdr

logger = logging.getLogger(__name__)

class ImageProcessor:
    """图像处理器"""
    
    # 支持的图像格式
    SUPPORTED_FORMATS = {
        'jpeg': ['image/jpeg', 'image/jpg'],
        'png': ['image/png'],
        'webp': ['image/webp'],
        'gif': ['image/gif']
    }
    
    # 默认配置
    DEFAULT_MAX_SIZE = 10 * 1024 * 1024  # 10MB
    DEFAULT_MAX_DIMENSION = 4096  # 4K分辨率
    DEFAULT_QUALITY = 85  # JPEG质量
    
    def __init__(self, max_size: int = None, max_dimension: int = None):
        """
        初始化图像处理器
        
        Args:
            max_size: 最大文件大小（字节）
            max_dimension: 最大尺寸（像素）
        """
        self.max_size = max_size or self.DEFAULT_MAX_SIZE
        self.max_dimension = max_dimension or self.DEFAULT_MAX_DIMENSION
        
    def validate_image(self, file_data: bytes) -> Tuple[bool, str]:
        """
        验证图像文件

        Args:
            file_data: 图像文件数据

        Returns:
            Tuple[bool, str]: (是否有效, 错误信息)
        """
        try:
            # 检查文件大小
            if len(file_data) > self.max_size:
                return False, f"文件大小超过限制 ({self.max_size / 1024 / 1024:.1f}MB)"

            # 使用PIL验证图像完整性和格式
            with Image.open(io.BytesIO(file_data)) as img:
                # 检查图像格式
                if img.format.lower() not in self.SUPPORTED_FORMATS:
                    return False, f"不支持的图像格式: {img.format}"

                # 检查图像尺寸
                width, height = img.size
                if width > self.max_dimension or height > self.max_dimension:
                    return False, f"图像尺寸超过限制 ({self.max_dimension}x{self.max_dimension})"

                # 验证图像可以正常加载
                img.verify()

            return True, ""

        except Exception as e:
            logger.error(f"图像验证失败: {e}")
            return False, f"图像验证失败: {str(e)}"
    
    def encode_to_base64(self, file_data: bytes, include_prefix: bool = True) -> str:
        """
        将图像数据编码为Base64字符串
        
        Args:
            file_data: 图像文件数据
            include_prefix: 是否包含data URI前缀
            
        Returns:
            str: Base64编码的字符串
        """
        try:
            # 获取MIME类型
            image_format = imghdr.what(None, h=file_data)
            mime_type = self._get_mime_type(image_format)
            
            # Base64编码
            base64_str = base64.b64encode(file_data).decode('utf-8')
            
            if include_prefix:
                return f"data:{mime_type};base64,{base64_str}"
            else:
                return base64_str
                
        except Exception as e:
            logger.error(f"Base64编码失败: {e}")
            raise ValueError(f"Base64编码失败: {str(e)}")
    
    def decode_from_base64(self, base64_str: str) -> bytes:
        """
        从Base64字符串解码图像数据
        
        Args:
            base64_str: Base64编码的字符串（可包含data URI前缀）
            
        Returns:
            bytes: 图像文件数据
        """
        try:
            # 移除data URI前缀（如果存在）
            if base64_str.startswith('data:'):
                # 格式: data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...
                base64_str = base64_str.split(',', 1)[1]
            
            # Base64解码
            return base64.b64decode(base64_str)
            
        except Exception as e:
            logger.error(f"Base64解码失败: {e}")
            raise ValueError(f"Base64解码失败: {str(e)}")
    
    def get_image_info(self, file_data: bytes) -> Dict[str, Any]:
        """
        获取图像信息

        Args:
            file_data: 图像文件数据

        Returns:
            Dict[str, Any]: 图像信息
        """
        try:
            with Image.open(io.BytesIO(file_data)) as img:
                format_lower = img.format.lower()

                return {
                    'format': format_lower,
                    'mime_type': self._get_mime_type(format_lower),
                    'size': len(file_data),
                    'width': img.size[0],
                    'height': img.size[1],
                    'mode': img.mode,
                    'has_transparency': img.mode in ('RGBA', 'LA') or 'transparency' in img.info
                }

        except Exception as e:
            logger.error(f"获取图像信息失败: {e}")
            raise ValueError(f"获取图像信息失败: {str(e)}")
    
    def resize_image(self, file_data: bytes, max_size: Tuple[int, int],
                    quality: int = None) -> bytes:
        """
        调整图像大小

        Args:
            file_data: 图像文件数据
            max_size: 最大尺寸 (width, height)
            quality: JPEG质量 (1-100)

        Returns:
            bytes: 调整后的图像数据
        """
        try:
            quality = quality or self.DEFAULT_QUALITY

            with Image.open(io.BytesIO(file_data)) as img:
                original_format = img.format.lower()

                # 计算新尺寸（保持宽高比）
                img.thumbnail(max_size, Image.Resampling.LANCZOS)

                # 保存到字节流
                output = io.BytesIO()

                # 根据原始格式保存
                if original_format == 'jpeg':
                    img.save(output, format='JPEG', quality=quality, optimize=True)
                elif original_format == 'png':
                    img.save(output, format='PNG', optimize=True)
                elif original_format == 'webp':
                    img.save(output, format='WEBP', quality=quality, optimize=True)
                else:
                    # 其他格式转为JPEG，处理透明度
                    if img.mode in ('RGBA', 'LA'):
                        background = Image.new('RGB', img.size, (255, 255, 255))
                        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                        img = background
                    img.save(output, format='JPEG', quality=quality, optimize=True)

                return output.getvalue()

        except Exception as e:
            logger.error(f"图像调整失败: {e}")
            raise ValueError(f"图像调整失败: {str(e)}")
    
    def _get_mime_type(self, image_format: str) -> str:
        """
        根据图像格式获取MIME类型
        
        Args:
            image_format: 图像格式
            
        Returns:
            str: MIME类型
        """
        format_mime_map = {
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'webp': 'image/webp',
            'gif': 'image/gif'
        }
        return format_mime_map.get(image_format, 'image/jpeg')
    
    @classmethod
    def is_base64_image(cls, data: str) -> bool:
        """
        检查字符串是否为Base64编码的图像
        
        Args:
            data: 待检查的字符串
            
        Returns:
            bool: 是否为Base64图像
        """
        try:
            # 检查data URI格式
            if data.startswith('data:image/'):
                return ';base64,' in data
            
            # 尝试Base64解码
            if len(data) % 4 == 0:  # Base64长度必须是4的倍数
                decoded = base64.b64decode(data)
                # 检查是否为图像
                return imghdr.what(None, h=decoded) is not None
                
            return False
            
        except Exception:
            return False


# 全局实例
image_processor = ImageProcessor()
