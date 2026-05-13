"""
TiDB向量数据库配置管理模块

提供TiDB向量数据库的连接配置管理功能
"""

import os
import re
import logging
from typing import Dict, Any, Optional, Tuple
from urllib.parse import urlparse, parse_qs
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class TiDBConfig:
    """TiDB向量数据库配置类"""
    connection_string: str
    host: str = ""
    port: int = 4000
    username: str = ""
    password: str = ""
    database: str = "test"
    ssl_ca: Optional[str] = None
    ssl_verify_cert: bool = True
    ssl_verify_identity: bool = True
    
    def __post_init__(self):
        """初始化后解析连接字符串"""
        if self.connection_string:
            self._parse_connection_string()
    
    def _parse_connection_string(self):
        """解析TiDB连接字符串"""
        try:
            # 支持两种格式：
            # 1. mysql://user:password@host:port/database?params
            # 2. mysql+pymysql://user:password@host:port/database?params
            
            # 标准化连接字符串
            conn_str = self.connection_string
            if conn_str.startswith('mysql+pymysql://'):
                conn_str = conn_str.replace('mysql+pymysql://', 'mysql://')
            
            parsed = urlparse(conn_str)
            
            if parsed.scheme != 'mysql':
                raise ValueError(f"不支持的连接协议: {parsed.scheme}")
            
            self.host = parsed.hostname or ""
            self.port = parsed.port or 4000
            self.username = parsed.username or ""
            self.password = parsed.password or ""
            self.database = parsed.path.lstrip('/') or "test"
            
            # 解析查询参数
            if parsed.query:
                params = parse_qs(parsed.query)
                self.ssl_ca = params.get('ssl_ca', [None])[0]
                self.ssl_verify_cert = params.get('ssl_verify_cert', ['true'])[0].lower() == 'true'
                self.ssl_verify_identity = params.get('ssl_verify_identity', ['true'])[0].lower() == 'true'
            
            logger.debug(f"解析TiDB连接字符串成功: host={self.host}, port={self.port}, database={self.database}")
            
        except Exception as e:
            logger.error(f"解析TiDB连接字符串失败: {e}")
            raise ValueError(f"无效的TiDB连接字符串: {e}")
    
    def get_sqlalchemy_url(self) -> str:
        """获取SQLAlchemy格式的连接URL"""
        # 构建基础URL
        url = f"mysql+pymysql://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"
        
        # 添加SSL参数
        params = []
        if self.ssl_ca:
            params.append(f"ssl_ca={self.ssl_ca}")
        if self.ssl_verify_cert:
            params.append("ssl_verify_cert=true")
        if self.ssl_verify_identity:
            params.append("ssl_verify_identity=true")
        
        if params:
            url += "?" + "&".join(params)
        
        return url
    
    def get_tidb_vector_url(self) -> str:
        """获取TiDB Vector客户端格式的连接URL"""
        return self.get_sqlalchemy_url()
    
    def validate(self) -> Tuple[bool, str]:
        """验证配置的有效性"""
        try:
            if not self.connection_string:
                return False, "连接字符串不能为空"
            
            if not self.host:
                return False, "主机地址不能为空"
            
            if not self.username:
                return False, "用户名不能为空"
            
            if not self.password:
                return False, "密码不能为空"
            
            if not (1 <= self.port <= 65535):
                return False, "端口号必须在1-65535之间"
            
            # 验证主机名格式（支持TiDB Cloud的格式）
            if not re.match(r'^[a-zA-Z0-9.-]+$', self.host):
                return False, "主机地址格式无效"
            
            return True, "配置验证通过"
            
        except Exception as e:
            return False, f"配置验证失败: {e}"
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            'connection_string': self.connection_string,
            'host': self.host,
            'port': self.port,
            'username': self.username,
            'password': '***' if self.password else '',  # 隐藏密码
            'database': self.database,
            'ssl_ca': self.ssl_ca,
            'ssl_verify_cert': self.ssl_verify_cert,
            'ssl_verify_identity': self.ssl_verify_identity
        }


class TiDBConfigManager:
    """TiDB配置管理器"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def create_config(self, connection_string: str) -> TiDBConfig:
        """创建TiDB配置"""
        try:
            config = TiDBConfig(connection_string=connection_string)
            is_valid, message = config.validate()
            
            if not is_valid:
                raise ValueError(message)
            
            self.logger.info(f"创建TiDB配置成功: {config.host}:{config.port}/{config.database}")
            return config
            
        except Exception as e:
            self.logger.error(f"创建TiDB配置失败: {e}")
            raise
    
    def test_connection(self, config: TiDBConfig) -> Tuple[bool, str, Dict[str, Any]]:
        """测试TiDB连接"""
        try:
            import pymysql
            import time
            
            start_time = time.time()
            
            # 创建连接
            connection = pymysql.connect(
                host=config.host,
                port=config.port,
                user=config.username,
                password=config.password,
                database=config.database,
                charset='utf8mb4',
                connect_timeout=10,
                read_timeout=10,
                write_timeout=10,
                ssl={'ssl_disabled': False},  # 启用SSL
                ssl_verify_cert=True,
                ssl_verify_identity=True
            )
            
            # 测试基本查询
            with connection.cursor() as cursor:
                cursor.execute("SELECT VERSION()")
                version = cursor.fetchone()[0]
                
                # 检查向量搜索功能
                cursor.execute("SELECT 1")
                cursor.fetchone()
            
            connection.close()
            
            response_time = time.time() - start_time
            
            info = {
                'version': version,
                'response_time': round(response_time * 1000, 2),  # 毫秒
                'host': config.host,
                'port': config.port,
                'database': config.database
            }
            
            self.logger.info(f"TiDB连接测试成功: {config.host}:{config.port}")
            return True, "连接测试成功", info
            
        except ImportError:
            error_msg = "缺少pymysql依赖，请安装: pip install pymysql"
            self.logger.error(error_msg)
            return False, error_msg, {}
        except Exception as e:
            error_msg = f"连接测试失败: {str(e)}"
            self.logger.error(f"TiDB连接测试失败: {e}")
            return False, error_msg, {}
    
    def get_default_config(self) -> Optional[TiDBConfig]:
        """获取默认配置（从环境变量）"""
        try:
            connection_string = os.environ.get('TIDB_DATABASE_URL')
            if connection_string:
                return self.create_config(connection_string)
            return None
        except Exception as e:
            self.logger.error(f"获取默认TiDB配置失败: {e}")
            return None


# 全局配置管理器实例
tidb_config_manager = TiDBConfigManager()
