"""
Chonkie 分段器包装器
提供统一接口，封装 Chonkie 的所有 9 种分段方法
"""
from typing import List, Dict, Any, Optional

# Phase 1: 基础方法（Default安装）
try:
    from chonkie import RecursiveChunker, SentenceChunker, TokenChunker, RecursiveRules, RecursiveLevel
    CHONKIE_BASIC_AVAILABLE = True
except ImportError:
    CHONKIE_BASIC_AVAILABLE = False
    RecursiveChunker = None
    SentenceChunker = None
    TokenChunker = None
    RecursiveRules = None
    RecursiveLevel = None

# Phase 2: 高级方法（需要额外依赖）
try:
    from chonkie import LateChunker, TableChunker, SemanticChunker, CodeChunker
    CHONKIE_ADVANCED_AVAILABLE = True
except ImportError:
    CHONKIE_ADVANCED_AVAILABLE = False
    LateChunker = None
    TableChunker = None
    SemanticChunker = None
    CodeChunker = None

# Phase 3: 专业方法（需要完整安装）
try:
    from chonkie import NeuralChunker, SlumberChunker
    CHONKIE_PROFESSIONAL_AVAILABLE = True
except ImportError:
    CHONKIE_PROFESSIONAL_AVAILABLE = False
    NeuralChunker = None
    SlumberChunker = None


class ChonkieWrapper:
    """
    Chonkie 统一包装器
    提供统一接口，封装不同的分段方法
    """

    def __init__(self, method: str, config: Dict[str, Any]):
        """
        初始化分块器

        Args:
            method: 分段方法名称（9种可选）
            config: 配置参数
        """
        if not CHONKIE_BASIC_AVAILABLE:
            raise RuntimeError("Chonkie is not installed. Run: pip install chonkie")
        
        self.method = method
        self.config = config
        self.chunker = self._create_chunker()

    def _normalize_include_delim(self, value):
        """
        标准化 include_delim 参数
        
        Args:
            value: 前端传来的值（可能是 'prev', 'next', None, 'null' 等）
            
        Returns:
            标准化后的值：'prev', 'next', 或 None
        """
        if value in [None, 'null', 'None', '', 'undefined']:
            return None
        return value
    
    def _create_recursive_rules(self):
        """创建RecursiveChunker的分割规则"""
        from .config import CHUNKING_STRATEGIES
        
        strategy = self.config.get('chunking_strategy', 'semantic')
        
        # 如果是自定义策略
        if strategy == 'custom':
            custom_delims = self.config.get('custom_delimiters', '')
            if isinstance(custom_delims, str):
                custom_delims = custom_delims.strip()
            
            if custom_delims:
                # 解析自定义分隔符（每行一个）
                delim_list = [d.strip() for d in custom_delims.split('\n') if d.strip()]
                if delim_list:
                    # ✅ 优化：简化 include_delim 处理
                    include_delim = self._normalize_include_delim(
                        self.config.get('include_delim', 'prev')
                    )
                    
                    return RecursiveRules(
                        levels=[
                            RecursiveLevel(
                                delimiters=delim_list,
                                include_delim=include_delim
                            )
                        ]
                    )
            # 如果没有自定义分隔符，使用默认
            return RecursiveRules()
        
        # 使用预设策略
        if strategy in CHUNKING_STRATEGIES:
            strategy_config = CHUNKING_STRATEGIES[strategy]
            levels_config = strategy_config.get('levels')
            
            if levels_config is None:
                # 使用空的RecursiveRules（token分割）
                return RecursiveRules()
            
            # 创建多层级规则
            levels = []
            for level_config in levels_config:
                levels.append(RecursiveLevel(
                    delimiters=level_config['delimiters'],
                    include_delim=level_config.get('include_delim', 'prev')
                ))
            return RecursiveRules(levels=levels)
        
        # 默认返回空规则
        return RecursiveRules()

    def _create_chunker(self):
        """根据配置创建对应的 Chunker（支持全部9种方法）"""
        
        # ===== Phase 1: 基础方法 (Default安装) =====
        if self.method == 'recursive':
            # 创建分割规则
            rules = self._create_recursive_rules()
            
            return RecursiveChunker(
                tokenizer=self.config.get('tokenizer', 'gpt2'),
                chunk_size=self.config.get('chunk_size', 512),
                rules=rules,
                min_characters_per_chunk=self.config.get('min_characters_per_chunk', 24)
            )

        elif self.method == 'token':
            return TokenChunker(
                tokenizer=self.config.get('tokenizer', 'gpt2'),
                chunk_size=self.config.get('chunk_size', 512),
                chunk_overlap=self.config.get('chunk_overlap', 0)
            )

        elif self.method == 'sentence':
            return SentenceChunker(
                tokenizer=self.config.get('tokenizer', 'gpt2'),
                chunk_size=self.config.get('chunk_size', 512),
                chunk_overlap=self.config.get('chunk_overlap', 0),
                min_sentences_per_chunk=self.config.get('min_sentences_per_chunk', 1)
            )

        # ===== Phase 2: 高级方法 (需要额外依赖) =====
        elif self.method == 'late':
            if not CHONKIE_ADVANCED_AVAILABLE or LateChunker is None:
                raise RuntimeError(
                    "LateChunker is not available. "
                    "Install with: pip install chonkie[embeddings]"
                )
            return LateChunker(
                embedding_model=self.config.get('embedding_model', 'all-MiniLM-L6-v2'),
                chunk_size=self.config.get('chunk_size', 512)
            )

        elif self.method == 'table':
            if not CHONKIE_ADVANCED_AVAILABLE or TableChunker is None:
                raise RuntimeError(
                    "TableChunker is not available. "
                    "Install with: pip install chonkie"
                )
            # ✅ 修复：TableChunker 只接受 tokenizer 和 chunk_size 参数
            # 文档：https://docs.chonkie.ai/oss/chunkers/table-chunker
            return TableChunker(
                tokenizer=self.config.get('tokenizer', 'character'),
                chunk_size=self.config.get('chunk_size', 2048)
            )

        elif self.method == 'semantic':
            if not CHONKIE_ADVANCED_AVAILABLE or SemanticChunker is None:
                raise RuntimeError(
                    "SemanticChunker is not available. "
                    "Install with: pip install chonkie[embeddings]"
                )
            return SemanticChunker(
                embedding_model=self.config.get('embedding_model', 'all-MiniLM-L6-v2'),
                similarity_threshold=self.config.get('similarity_threshold', 0.5)
            )

        elif self.method == 'code':
            if not CHONKIE_ADVANCED_AVAILABLE or CodeChunker is None:
                raise RuntimeError(
                    "CodeChunker is not available. "
                    "Install with: pip install chonkie[all]"
                )
            return CodeChunker(
                language=self.config.get('language', 'python'),
                chunk_size=self.config.get('chunk_size', 512)
            )

        # ===== Phase 3: 专业方法 (需要完整安装) =====
        elif self.method == 'neural':
            if not CHONKIE_PROFESSIONAL_AVAILABLE or NeuralChunker is None:
                raise RuntimeError(
                    "NeuralChunker is not available. "
                    "Install with: pip install chonkie[all]"
                )
            return NeuralChunker(
                model=self.config.get('model', 'mirth/chonky_distilbert_base_uncased_1'),
                min_characters_per_chunk=self.config.get('min_characters_per_chunk', 10)
            )

        elif self.method == 'slumber':
            if not CHONKIE_PROFESSIONAL_AVAILABLE or SlumberChunker is None:
                raise RuntimeError(
                    "SlumberChunker is not available. "
                    "Install with: pip install chonkie[all]"
                )
            # ⚠️ 注意：SlumberChunker 默认使用 GeminiGenie()
            # config 中的 model_id 参数目前仅用于前端展示
            # 如需自定义模型，需要创建自定义 Genie 对象并传入
            # TODO: 实现自定义模型集成（需要根据 model_id 创建对应的 Genie）
            return SlumberChunker(
                chunk_size=self.config.get('chunk_size', 2048),
                candidate_size=self.config.get('candidate_size', 128)
            )

        else:
            raise ValueError(
                f"Unknown chunking method: {self.method}. "
                f"Supported methods: recursive, token, sentence, late, table, "
                f"semantic, code, neural, slumber"
            )

    def chunk(self, text: str) -> List[str]:
        """
        分块文本

        Args:
            text: 输入文本

        Returns:
            分块列表（字符串列表）
        """
        if not text:
            return []
        
        try:
            # Chonkie 返回的是 Chunk 对象列表
            chunks = self.chunker.chunk(text)
            # 提取 Chunk 对象的 text 属性，去除首尾空白，并过滤空白分段
            return [chunk.text.strip() for chunk in chunks if chunk.text.strip()]
        except Exception as e:
            raise RuntimeError(f"Chunking failed with method '{self.method}': {str(e)}")

    def get_estimated_chunks(self, text_length: int) -> int:
        """
        估算分块数量

        Args:
            text_length: 文本长度

        Returns:
            预估分块数量
        """
        chunk_size = self.config.get('chunk_size', 512)
        overlap = self.config.get('chunk_overlap', 128)
        effective_size = chunk_size - overlap

        if effective_size <= 0:
            return 0

        return max(1, (text_length + effective_size - 1) // effective_size)

    @staticmethod
    def validate_config(method: str, config: Dict[str, Any]) -> Optional[str]:
        """
        验证配置参数

        Args:
            method: 分段方法
            config: 配置参数

        Returns:
            错误信息，如果验证通过则返回 None
        """
        # 通用验证
        if method in ['recursive', 'token']:
            chunk_size = config.get('chunk_size', 512)
            if not (100 <= chunk_size <= 2048):
                return "chunk_size must be between 100 and 2048"

            chunk_overlap = config.get('chunk_overlap', 128)
            if not (0 <= chunk_overlap <= 512):
                return "chunk_overlap must be between 0 and 512"

            if chunk_overlap >= chunk_size:
                return "chunk_overlap must be less than chunk_size"

        # 方法特定验证
        if method == 'semantic':
            threshold = config.get('similarity_threshold')
            if threshold is not None and not (0 <= threshold <= 1):
                return "similarity_threshold must be between 0 and 1"

        elif method == 'sentence':
            min_sent = config.get('min_sentences_per_chunk', 1)
            if min_sent < 1:
                return "min_sentences_per_chunk must be at least 1"

        return None


def check_chonkie_availability() -> Dict[str, Any]:
    """
    检查 Chonkie 及其所有 9 种方法的可用性
    
    Returns:
        各组件的可用性状态，包括所有方法的详细状态
    """
    return {
        'basic_available': CHONKIE_BASIC_AVAILABLE,
        'advanced_available': CHONKIE_ADVANCED_AVAILABLE,
        'professional_available': CHONKIE_PROFESSIONAL_AVAILABLE,
        'methods': {
            # Phase 1: 基础方法
            'recursive': CHONKIE_BASIC_AVAILABLE,
            'token': CHONKIE_BASIC_AVAILABLE,
            'sentence': CHONKIE_BASIC_AVAILABLE,
            # Phase 2: 高级方法
            'late': CHONKIE_ADVANCED_AVAILABLE and LateChunker is not None,
            'table': CHONKIE_ADVANCED_AVAILABLE and TableChunker is not None,
            'semantic': CHONKIE_ADVANCED_AVAILABLE and SemanticChunker is not None,
            'code': CHONKIE_ADVANCED_AVAILABLE and CodeChunker is not None,
            # Phase 3: 专业方法
            'neural': CHONKIE_PROFESSIONAL_AVAILABLE and NeuralChunker is not None,
            'slumber': CHONKIE_PROFESSIONAL_AVAILABLE and SlumberChunker is not None
        },
        'installation_guide': {
            'basic': 'pip install chonkie',
            'embeddings': 'pip install chonkie[embeddings]  # For late, semantic',
            'all': 'pip install chonkie[all]  # For code, neural, slumber'
        }
    }
