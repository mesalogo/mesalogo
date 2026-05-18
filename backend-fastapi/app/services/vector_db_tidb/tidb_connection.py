"""
TiDB向量数据库连接管理模块

提供TiDB向量数据库的连接管理和基础操作功能
"""

import logging
import time
from typing import Dict, Any, Optional, List, Tuple
from contextlib import contextmanager

try:
    from tidb_vector.integrations import TiDBVectorClient
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    import pymysql
    TIDB_AVAILABLE = True
except ImportError as e:
    TIDB_AVAILABLE = False
    IMPORT_ERROR = str(e)

from .tidb_config import TiDBConfig

logger = logging.getLogger(__name__)


class TiDBConnectionManager:
    """TiDB向量数据库连接管理器"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._engine = None
        self._session_factory = None
        self._vector_client = None
        self._config = None
        
        if not TIDB_AVAILABLE:
            self.logger.warning(f"TiDB向量数据库依赖不可用: {IMPORT_ERROR}")
    
    def initialize(self, config: TiDBConfig) -> bool:
        """初始化连接"""
        try:
            if not TIDB_AVAILABLE:
                raise ImportError(f"TiDB向量数据库依赖不可用: {IMPORT_ERROR}")
            
            self._config = config
            
            # 创建SQLAlchemy引擎
            sqlalchemy_url = config.get_sqlalchemy_url()
            self._engine = create_engine(
                sqlalchemy_url,
                pool_size=10,
                max_overflow=20,
                pool_timeout=60,
                pool_recycle=1800,
                pool_pre_ping=True,
                echo=False
            )
            
            # 创建会话工厂
            self._session_factory = sessionmaker(bind=self._engine)
            
            # 测试连接
            with self._engine.connect() as conn:
                result = conn.execute(text("SELECT 1"))
                result.fetchone()
            
            self.logger.info(f"TiDB连接初始化成功: {config.host}:{config.port}/{config.database}")
            return True
            
        except Exception as e:
            self.logger.error(f"TiDB连接初始化失败: {e}")
            self._cleanup()
            raise
    
    def create_vector_client(self, table_name: str, vector_dimension: int, 
                           drop_existing: bool = False) -> Optional['TiDBVectorClient']:
        """创建向量客户端"""
        try:
            if not TIDB_AVAILABLE:
                raise ImportError(f"TiDB向量数据库依赖不可用: {IMPORT_ERROR}")
            
            if not self._config:
                raise ValueError("连接未初始化")
            
            # 创建TiDB向量客户端
            vector_client = TiDBVectorClient(
                table_name=table_name,
                connection_string=self._config.get_tidb_vector_url(),
                vector_dimension=vector_dimension,
                drop_existing_table=drop_existing
            )
            
            self.logger.info(f"创建TiDB向量客户端成功: table={table_name}, dim={vector_dimension}")
            return vector_client
            
        except Exception as e:
            self.logger.error(f"创建TiDB向量客户端失败: {e}")
            raise
    
    @contextmanager
    def get_session(self):
        """获取数据库会话（上下文管理器）"""
        if not self._session_factory:
            raise ValueError("连接未初始化")
        
        session = self._session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
    
    def execute_sql(self, sql: str, params: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """执行SQL查询"""
        try:
            if not self._engine:
                raise ValueError("连接未初始化")
            
            with self._engine.connect() as conn:
                result = conn.execute(text(sql), params or {})
                
                # 如果是查询语句，返回结果
                if sql.strip().upper().startswith('SELECT'):
                    columns = result.keys()
                    rows = result.fetchall()
                    return [dict(zip(columns, row)) for row in rows]
                else:
                    # 对于非查询语句，返回影响的行数
                    return [{'affected_rows': result.rowcount}]
                    
        except Exception as e:
            self.logger.error(f"执行SQL失败: {e}")
            raise
    
    def test_vector_operations(self) -> Tuple[bool, str, Dict[str, Any]]:
        """测试向量操作功能"""
        try:
            if not TIDB_AVAILABLE:
                return False, f"TiDB向量数据库依赖不可用: {IMPORT_ERROR}", {}
            
            if not self._config:
                return False, "连接未初始化", {}
            
            start_time = time.time()
            
            # 创建测试向量客户端
            test_table = "test_vector_operations"
            test_dimension = 3
            
            vector_client = self.create_vector_client(
                table_name=test_table,
                vector_dimension=test_dimension,
                drop_existing=True
            )
            
            # 测试插入向量数据
            test_data = [
                {
                    "id": "test_1",
                    "text": "测试文档1",
                    "embedding": [1.0, 2.0, 3.0],
                    "metadata": {"category": "test"}
                },
                {
                    "id": "test_2", 
                    "text": "测试文档2",
                    "embedding": [2.0, 3.0, 4.0],
                    "metadata": {"category": "test"}
                }
            ]
            
            # 插入数据
            vector_client.insert(
                ids=[item["id"] for item in test_data],
                texts=[item["text"] for item in test_data],
                embeddings=[item["embedding"] for item in test_data],
                metadatas=[item["metadata"] for item in test_data]
            )
            
            # 测试向量搜索
            query_vector = [1.5, 2.5, 3.5]
            search_results = vector_client.query(query_vector, k=2)
            
            # 清理测试数据
            try:
                with self._engine.connect() as conn:
                    conn.execute(text(f"DROP TABLE IF EXISTS {test_table}"))
                    conn.commit()
            except Exception as cleanup_error:
                self.logger.warning(f"清理测试表失败: {cleanup_error}")
            
            response_time = time.time() - start_time
            
            info = {
                'test_table': test_table,
                'vector_dimension': test_dimension,
                'inserted_records': len(test_data),
                'search_results': len(search_results),
                'response_time': round(response_time * 1000, 2)
            }
            
            self.logger.info("TiDB向量操作测试成功")
            return True, "向量操作测试成功", info
            
        except Exception as e:
            error_msg = f"向量操作测试失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg, {}
    
    def get_connection_info(self) -> Dict[str, Any]:
        """获取连接信息"""
        if not self._config:
            return {}
        
        return {
            'host': self._config.host,
            'port': self._config.port,
            'database': self._config.database,
            'username': self._config.username,
            'ssl_enabled': self._config.ssl_verify_cert,
            'connected': self._engine is not None
        }
    
    def close(self):
        """关闭连接"""
        self._cleanup()
        self.logger.info("TiDB连接已关闭")
    
    def _cleanup(self):
        """清理资源"""
        if self._engine:
            self._engine.dispose()
            self._engine = None
        
        self._session_factory = None
        self._vector_client = None
        self._config = None
    
    def __del__(self):
        """析构函数"""
        self._cleanup()


# 全局连接管理器实例
tidb_connection_manager = TiDBConnectionManager()
