"""
TiDB向量数据库模型定义

定义向量数据的存储模型和表结构
"""

import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass, asdict
from enum import Enum

logger = logging.getLogger(__name__)


class VectorDistanceMetric(Enum):
    """向量距离度量类型"""
    L2 = "L2"           # 欧几里得距离
    COSINE = "COSINE"   # 余弦距离
    DOT_PRODUCT = "DOT_PRODUCT"  # 点积


class VectorDataType(Enum):
    """向量数据类型"""
    TEXT = "text"           # 文本数据
    DOCUMENT = "document"   # 文档数据
    IMAGE = "image"         # 图像数据
    AUDIO = "audio"         # 音频数据
    VIDEO = "video"         # 视频数据
    CUSTOM = "custom"       # 自定义数据


@dataclass
class VectorRecord:
    """向量记录数据类"""
    id: str
    text: str
    embedding: List[float]
    metadata: Dict[str, Any]
    data_type: VectorDataType = VectorDataType.TEXT
    source: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def __post_init__(self):
        """初始化后处理"""
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.updated_at is None:
            self.updated_at = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        data = asdict(self)
        # 处理枚举类型
        data['data_type'] = self.data_type.value
        # 处理日期时间
        if self.created_at:
            data['created_at'] = self.created_at.isoformat()
        if self.updated_at:
            data['updated_at'] = self.updated_at.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'VectorRecord':
        """从字典创建实例"""
        # 处理枚举类型
        if 'data_type' in data and isinstance(data['data_type'], str):
            data['data_type'] = VectorDataType(data['data_type'])
        
        # 处理日期时间
        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        if 'updated_at' in data and isinstance(data['updated_at'], str):
            data['updated_at'] = datetime.fromisoformat(data['updated_at'])
        
        return cls(**data)
    
    def validate(self) -> tuple[bool, str]:
        """验证记录的有效性"""
        if not self.id:
            return False, "记录ID不能为空"
        
        if not self.text:
            return False, "文本内容不能为空"
        
        if not self.embedding:
            return False, "向量不能为空"
        
        if not isinstance(self.embedding, list):
            return False, "向量必须是列表类型"
        
        if not all(isinstance(x, (int, float)) for x in self.embedding):
            return False, "向量元素必须是数值类型"
        
        if not self.metadata:
            self.metadata = {}
        
        if not isinstance(self.metadata, dict):
            return False, "元数据必须是字典类型"
        
        return True, "记录验证通过"


@dataclass
class VectorSearchResult:
    """向量搜索结果数据类"""
    record: VectorRecord
    distance: float
    score: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'record': self.record.to_dict(),
            'distance': self.distance,
            'score': self.score
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'VectorSearchResult':
        """从字典创建实例"""
        record_data = data.get('record', {})
        record = VectorRecord.from_dict(record_data)
        
        return cls(
            record=record,
            distance=data.get('distance', 0.0),
            score=data.get('score')
        )


@dataclass
class VectorCollection:
    """向量集合配置"""
    name: str
    dimension: int
    distance_metric: VectorDistanceMetric = VectorDistanceMetric.COSINE
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def __post_init__(self):
        """初始化后处理"""
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.updated_at is None:
            self.updated_at = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        data = asdict(self)
        data['distance_metric'] = self.distance_metric.value
        if self.created_at:
            data['created_at'] = self.created_at.isoformat()
        if self.updated_at:
            data['updated_at'] = self.updated_at.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'VectorCollection':
        """从字典创建实例"""
        if 'distance_metric' in data and isinstance(data['distance_metric'], str):
            data['distance_metric'] = VectorDistanceMetric(data['distance_metric'])
        
        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        if 'updated_at' in data and isinstance(data['updated_at'], str):
            data['updated_at'] = datetime.fromisoformat(data['updated_at'])
        
        return cls(**data)
    
    def validate(self) -> tuple[bool, str]:
        """验证集合配置的有效性"""
        if not self.name:
            return False, "集合名称不能为空"
        
        if not isinstance(self.dimension, int) or self.dimension <= 0:
            return False, "向量维度必须是正整数"
        
        if self.dimension > 16000:  # TiDB向量维度限制
            return False, "向量维度不能超过16000"
        
        return True, "集合配置验证通过"


class VectorTableSchema:
    """向量表结构定义"""
    
    @staticmethod
    def get_create_table_sql(table_name: str, vector_dimension: int,
                           distance_metric: VectorDistanceMetric = VectorDistanceMetric.COSINE) -> str:
        """获取创建向量表的SQL语句"""

        # TiDB向量表标准格式
        sql = f"""CREATE TABLE IF NOT EXISTS `{table_name}` (
    `id` VARCHAR(255) PRIMARY KEY,
    `text` LONGTEXT NOT NULL,
    `embedding` VECTOR({vector_dimension}) NOT NULL,
    `metadata` JSON,
    `data_type` VARCHAR(50) DEFAULT 'text',
    `source` VARCHAR(255),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)"""

        return sql
    
    @staticmethod
    def get_drop_table_sql(table_name: str) -> str:
        """获取删除向量表的SQL语句"""
        return f"DROP TABLE IF EXISTS `{table_name}`;"
    
    @staticmethod
    def get_insert_sql(table_name: str) -> str:
        """获取插入向量记录的SQL语句"""
        return f"""INSERT INTO `{table_name}`
(`id`, `text`, `embedding`, `metadata`, `data_type`, `source`, `created_at`, `updated_at`)
VALUES (:id, :text, :embedding, :metadata, :data_type, :source, :created_at, :updated_at)
ON DUPLICATE KEY UPDATE
`text` = VALUES(`text`),
`embedding` = VALUES(`embedding`),
`metadata` = VALUES(`metadata`),
`data_type` = VALUES(`data_type`),
`source` = VALUES(`source`),
`updated_at` = VALUES(`updated_at`)"""
    
    @staticmethod
    def get_search_sql(table_name: str, distance_metric: VectorDistanceMetric = VectorDistanceMetric.COSINE) -> str:
        """获取向量搜索的SQL语句"""

        # 根据距离度量选择距离函数 - 使用TiDB标准函数名
        if distance_metric == VectorDistanceMetric.L2:
            distance_func = "vec_l2_distance"
        elif distance_metric == VectorDistanceMetric.COSINE:
            distance_func = "vec_cosine_distance"
        elif distance_metric == VectorDistanceMetric.DOT_PRODUCT:
            distance_func = "vec_negative_inner_product"
        else:
            distance_func = "vec_cosine_distance"

        return f"""SELECT
`id`, `text`, `embedding`, `metadata`, `data_type`, `source`,
`created_at`, `updated_at`,
{distance_func}(`embedding`, :query_vector) as distance
FROM `{table_name}`
WHERE 1=1
{{where_clause}}
ORDER BY distance ASC
LIMIT :limit"""
    
    @staticmethod
    def get_delete_sql(table_name: str) -> str:
        """获取删除向量记录的SQL语句"""
        return f"DELETE FROM `{table_name}` WHERE `id` = :id;"
    
    @staticmethod
    def get_count_sql(table_name: str) -> str:
        """获取记录数量的SQL语句"""
        return f"SELECT COUNT(*) as count FROM `{table_name}`;"
    
    @staticmethod
    def get_table_info_sql(table_name: str) -> str:
        """获取表信息的SQL语句"""
        return f"DESCRIBE `{table_name}`;"
