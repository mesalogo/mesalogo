"""
分段配置管理
"""
from typing import Dict, Any, List
from app.models import ChunkConfig, db

# ===== RecursiveChunker 预设分割策略（基于chonkie最佳实践） =====
CHUNKING_STRATEGIES = {
    "semantic": {
        "name": "智能分割（推荐）",
        "description": "按段落和句子分割，保持语义完整性，适合90%的场景",
        "levels": [
            {"delimiters": ["\n\n"], "include_delim": "prev"},           # 段落
            {"delimiters": [". ", "! ", "? "], "include_delim": "prev"}  # 句子
        ]
    },
    "markdown": {
        "name": "Markdown文档",
        "description": "按标题和段落分割，适合技术文档和知识库",
        "levels": [
            {"delimiters": ["# ", "## ", "### "], "include_delim": "prev"},  # 只保留常用的1-3级标题
            {"delimiters": ["\n\n"], "include_delim": "prev"},
            {"delimiters": [". ", "! ", "? "], "include_delim": "prev"}
        ]
    },
    "custom": {
        "name": "自定义分隔符",
        "description": "自定义分隔符规则，适合特殊文档格式",
        "levels": None  # 由用户配置
    }
}

# 所有方法的默认配置（支持全部 9 种 Chonkie 方法）
DEFAULT_CONFIGS = {
    # Phase 1: 基础方法
    "recursive": {
        "tokenizer": "gpt2",
        "chunk_size": 512,
        "chunking_strategy": "semantic",  # 默认使用智能分割（段落+句子）
        "min_characters_per_chunk": 24,
        "include_delim": "prev"  # 分隔符包含在前一个chunk中
    },
    "token": {
        "tokenizer": "gpt2",
        "chunk_size": 512,
        "chunk_overlap": 0
    },
    "sentence": {
        "tokenizer": "gpt2",
        "chunk_size": 512,
        "chunk_overlap": 0,
        "min_sentences_per_chunk": 1
    },
    
    # Phase 2: 高级方法
    "late": {
        "embedding_model": "all-MiniLM-L6-v2",
        "chunk_size": 512
    },
    "table": {
        "tokenizer": "character",
        "chunk_size": 2048
    },
    "semantic": {
        "embedding_model": "all-MiniLM-L6-v2",
        "similarity_threshold": 0.5
    },
    "code": {
        "language": "python",
        "chunk_size": 512
    },
    
    # Phase 3: 专业方法
    "neural": {
        "model": "mirth/chonky_distilbert_base_uncased_1",
        "min_characters_per_chunk": 10
    },
    "slumber": {
        "model_id": None,  # 文本生成模型ID（从模型配置中选择）
        "chunk_size": 2048,
        "candidate_size": 128
    }
}


def get_or_create_chunk_config(knowledge_id: str) -> ChunkConfig:
    """
    获取或创建知识库的分段配置
    
    Args:
        knowledge_id: 知识库ID
        
    Returns:
        ChunkConfig 实例
    """
    config = ChunkConfig.query.filter_by(knowledge_id=knowledge_id).first()
    
    if not config:
        # ✅ 优化：使用统一的 DEFAULT_CONFIGS 而不是单独的 DEFAULT_CHUNK_CONFIG
        config = ChunkConfig(
            id=knowledge_id,  # 配置ID与知识库ID相同
            knowledge_id=knowledge_id,
            method='recursive',
            config=DEFAULT_CONFIGS['recursive']
        )
        db.session.add(config)
        db.session.commit()
    
    return config


def update_chunk_config(knowledge_id: str, method: str, config_data: Dict[str, Any]) -> ChunkConfig:
    """
    更新知识库的分段配置
    
    Args:
        knowledge_id: 知识库ID
        method: 分段方法
        config_data: 配置参数
        
    Returns:
        更新后的 ChunkConfig 实例
    """
    config = get_or_create_chunk_config(knowledge_id)
    config.method = method
    config.config = config_data
    db.session.commit()
    return config


def get_default_configs() -> List[Dict[str, Any]]:
    """
    获取所有 9 种方法的默认配置和元信息
    
    Returns:
        方法列表，包含方法信息、默认配置和启用状态
    """
    return [
        # ===== Phase 1: 基础方法 (已启用) =====
        {
            'name': 'recursive',
            'display_name': '递归分割',
            'description': '适用于大多数文档类型，智能识别段落、句子边界',
            'performance': 'fastest',
            'requires_model': False,
            'model_info': None,
            'phase': 1,
            'enabled': True,
            'default_config': DEFAULT_CONFIGS['recursive']
        },
        {
            'name': 'token',
            'display_name': 'Token分割',
            'description': '精确控制token数量，匹配模型限制',
            'performance': 'fastest',
            'requires_model': False,
            'model_info': None,
            'phase': 1,
            'enabled': True,
            'default_config': DEFAULT_CONFIGS['token']
        },
        {
            'name': 'sentence',
            'display_name': '句子分割',
            'description': '按句子边界分割，保持语义完整性',
            'performance': 'fastest',
            'requires_model': False,
            'model_info': None,
            'phase': 1,
            'enabled': True,
            'default_config': DEFAULT_CONFIGS['sentence']
        },
        
        # ===== Phase 2: 高级方法 (全部启用) =====
        {
            'name': 'late',
            'display_name': 'Late Chunking',
            'description': '专为RAG设计，Late Chunking算法，显著提升检索召回率',
            'performance': 'fast',
            'requires_model': True,
            'model_info': '使用 sentence-transformers（项目已有），无需额外下载',
            'phase': 2,
            'enabled': True,  # ✅ 已启用
            'priority': 'highest',
            'default_config': DEFAULT_CONFIGS['late']
        },
        {
            'name': 'table',
            'display_name': '表格分割',
            'description': '⚠️ 仅适用于包含Markdown表格的文档！按行分割表格并自动保留表头。如果文档不包含表格，将返回空结果。',
            'performance': 'fastest',
            'requires_model': False,
            'model_info': None,
            'phase': 2,
            'enabled': True,  # ✅ 已启用
            'priority': 'high',
            'default_config': DEFAULT_CONFIGS['table']
        },
        {
            'name': 'semantic',
            'display_name': '语义分割',
            'description': '基于语义相似度分割，检索准确率+30-50%',
            'performance': 'fast',
            'requires_model': True,
            'model_info': '需加载 ~200MB 模型，首次使用约需5-10秒',
            'phase': 2,
            'enabled': True,  # ✅ 已启用
            'priority': 'medium',
            'default_config': DEFAULT_CONFIGS['semantic']
        },
        {
            'name': 'code',
            'display_name': '代码分割',
            'description': '基于AST理解代码结构，专为代码文档设计',
            'performance': 'fastest',
            'requires_model': False,
            'model_info': None,
            'phase': 2,
            'enabled': True,  # ✅ 已启用
            'priority': 'medium',
            'default_config': DEFAULT_CONFIGS['code']
        },
        
        # ===== Phase 3: 专业方法 (全部启用) =====
        {
            'name': 'neural',
            'display_name': '神经网络分割',
            'description': '使用fine-tuned BERT模型检测语义变化，最高准确度',
            'performance': 'fast',
            'requires_model': True,
            'model_info': '需下载 fine-tuned BERT 模型（~400MB）',
            'phase': 3,
            'enabled': True,  # ✅ 已启用
            'priority': 'low',
            'default_config': DEFAULT_CONFIGS['neural']
        },
        {
            'name': 'slumber',
            'display_name': 'LLM分割',
            'description': '使用LLM进行代理式分块，S-tier质量（成本高，速度慢）',
            'performance': 'slow',
            'requires_model': True,
            'model_info': '需要有效的 LLM API 密钥（OpenAI/Anthropic等）',
            'phase': 3,
            'enabled': True,  # ✅ 已启用
            'priority': 'low',
            'cost': 'high',
            'default_config': DEFAULT_CONFIGS['slumber']
        }
    ]
