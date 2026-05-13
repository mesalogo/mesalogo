"""
日期时间工具模块
提供处理日期时间相关的功能，特别是系统时区转换
"""

from datetime import datetime
import logging
import pytz

from core.config import settings

logger = logging.getLogger(__name__)

def get_current_time_with_timezone():
    """
    获取当前时间，并应用系统设置中的时区

    返回:
        datetime: 基于系统设置时区的当前时间
    """
    # 延迟导入，避免循环引用
    from app.models import SystemSetting

    # 获取系统设置的时区，如果不存在则使用默认值
    default_timezone = "Asia/Shanghai"
    try:
        timezone_str = SystemSetting.get('timezone', settings.get("TIMEZONE", default_timezone))
    except Exception:
        # 如果获取系统设置失败，使用默认时区
        timezone_str = default_timezone
    
    # 获取UTC时间
    utc_now = datetime.utcnow()
    
    try:
        # 转换为系统时区
        timezone = pytz.timezone(timezone_str)
        utc_now = utc_now.replace(tzinfo=pytz.UTC)
        return utc_now.astimezone(timezone)
    except Exception as e:
        # 如果时区转换出错，返回UTC时间
        logger.error(f"时区转换错误: {str(e)}")
        return utc_now 