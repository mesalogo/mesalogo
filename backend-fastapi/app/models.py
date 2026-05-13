from datetime import datetime
import uuid
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON, Float, Table, UniqueConstraint, Index
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import relationship
from app.extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from app.utils.datetime_utils import get_current_time_with_timezone

class BaseMixin:
    # 使用UUID作为主键
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=get_current_time_with_timezone)
    updated_at = Column(DateTime, default=get_current_time_with_timezone, onupdate=get_current_time_with_timezone)

class User(BaseMixin, db.Model):
    __tablename__ = 'users'
    username = Column(String(64), unique=True, nullable=False)
    password_hash = Column(String(256))
    email = Column(String(120), unique=True, nullable=True)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)  # 新增管理员标识
    profile = Column(JSON, default=dict)       # 新增profile JSON字段

    action_tasks = relationship("ActionTask", back_populates="user")
    user_role_assignments = relationship("UserRoleAssignment", back_populates="user", foreign_keys="UserRoleAssignment.user_id")

    def __repr__(self):
        return f'<User {self.username}>'

    def set_password(self, password):
        """设置用户密码"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """检查用户密码"""
        return check_password_hash(self.password_hash, password)

    def get_profile_field(self, field_name, default=None):
        """获取profile中的字段值"""
        return self.profile.get(field_name, default) if self.profile else default

    def set_profile_field(self, field_name, value):
        """设置profile中的字段值"""
        if not self.profile:
            self.profile = {}
        # 创建新的字典以触发SQLAlchemy的变更检测
        new_profile = dict(self.profile)
        new_profile[field_name] = value
        self.profile = new_profile

    @property
    def display_name(self):
        """获取显示名称"""
        return self.get_profile_field('display_name', self.username)

    @property
    def phone(self):
        """获取手机号"""
        return self.get_profile_field('phone')



    def to_dict(self, include_sensitive=False, include_roles=False):
        """转换为字典格式"""
        data = {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'is_active': self.is_active,
            'is_admin': self.is_admin,
            'display_name': self.display_name,
            'phone': self.phone,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_sensitive:
            data['profile'] = self.profile or {}

        if include_roles:
            # 添加用户角色信息
            roles = []
            for assignment in self.user_role_assignments:
                role_data = assignment.to_dict()
                if assignment.user_role:
                    role_data['user_role'] = assignment.user_role.to_dict()
                roles.append(role_data)
            data['roles'] = roles

        # 添加 OAuth provider 信息
        if hasattr(self, 'oauth_accounts') and self.oauth_accounts:
            data['provider'] = self.oauth_accounts[0].provider
        else:
            data['provider'] = 'local'

        return data

# 行动空间模型
class ActionSpace(BaseMixin, db.Model):
    __tablename__ = 'action_spaces'
    name = Column(String(100), nullable=False)
    description = Column(LONGTEXT)
    settings = Column(JSON, default=dict)

    # 多租户字段
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    is_shared = Column(Boolean, default=False)

    # 关联关系
    rule_sets = relationship("ActionSpaceRuleSet", back_populates="action_space")
    action_tasks = relationship("ActionTask", back_populates="action_space")
    tags = relationship("ActionSpaceTag", back_populates="action_space")
    roles = relationship("ActionSpaceRole", back_populates="action_space")  # 添加角色关联
    observers = relationship("ActionSpaceObserver", back_populates="action_space")  # 添加监督者关联
    shared_variables = relationship("ActionSpaceSharedVariable", back_populates="action_space", cascade="all, delete-orphan")  # 添加共享变量关联
    apps = relationship("ActionSpaceApp", back_populates="action_space", cascade="all, delete-orphan")  # 添加应用关联
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f'<ActionSpace {self.name}>'

# 规则模型
class Rule(BaseMixin, db.Model):
    __tablename__ = 'rules'
    name = Column(String(100), nullable=False)
    description = Column(LONGTEXT)
    content = Column(LONGTEXT, nullable=False)  # 规则的具体内容
    category = Column(String(50))  # 规则类别，如：interaction, evaluation, constraint
    type = Column(String(20), default='llm')  # 规则类型: llm（自然语言规则）或 logic（逻辑规则）
    is_active = Column(Boolean, default=True)
    settings = Column(JSON, default=dict)

    # 多租户字段
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    is_shared = Column(Boolean, default=False)

    # 关联关系
    rule_sets = relationship("RuleSetRule", back_populates="rule")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f'<Rule {self.name}>'

# 规则触发记录模型
class RuleTriggerLog(BaseMixin, db.Model):
    __tablename__ = 'rule_trigger_logs'
    rule_id = Column(String(36), ForeignKey('rules.id'), nullable=False)
    action_task_id = Column(String(36), ForeignKey('action_tasks.id'), nullable=False)
    conversation_id = Column(String(36), ForeignKey('conversations.id'))
    trigger_type = Column(String(20), default='manual')  # manual, automatic, scheduled
    trigger_source = Column(String(50))  # user, system, supervisor, agent
    context = Column(LONGTEXT)  # 触发时的上下文信息
    variables = Column(JSON, default=dict)  # 触发时的变量值
    result = Column(JSON)  # 检查结果
    passed = Column(Boolean)  # 是否通过检查
    message = Column(LONGTEXT)  # 检查消息
    details = Column(LONGTEXT)  # 详细信息
    execution_time = Column(Float)  # 执行耗时(秒)

    # 关联关系
    rule = relationship("Rule")
    action_task = relationship("ActionTask")
    conversation = relationship("Conversation")

    def __repr__(self):
        return f'<RuleTriggerLog {self.rule_id}:{self.action_task_id}>'

# 规则集与规则的多对多关联表
class RuleSetRule(BaseMixin, db.Model):
    __tablename__ = 'rule_set_rules'
    rule_set_id = Column(String(36), ForeignKey('rule_sets.id'), nullable=False)
    rule_id = Column(String(36), ForeignKey('rules.id'), nullable=False)
    priority = Column(Integer, default=0)  # 规则在规则集中的优先级

    rule_set = relationship("RuleSet", back_populates="rules_relation")
    rule = relationship("Rule", back_populates="rule_sets")

    def __repr__(self):
        return f'<RuleSetRule {self.rule_set_id}:{self.rule_id}>'

class RuleSet(BaseMixin, db.Model):
    __tablename__ = 'rule_sets'
    name = Column(String(100), nullable=False)
    description = Column(LONGTEXT)
    rules = Column(JSON, default=list)  # 保留原来的rules字段，用于兼容性
    conditions = Column(JSON, default=list)
    actions = Column(JSON, default=list)
    settings = Column(JSON, default=dict)

    # 多租户字段
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    is_shared = Column(Boolean, default=False)

    # 新增的关联关系
    rules_relation = relationship("RuleSetRule", back_populates="rule_set")
    # 添加多对多关系
    action_spaces = relationship("ActionSpaceRuleSet", back_populates="rule_set")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f'<RuleSet {self.name}>'

class Role(BaseMixin, db.Model):
    __tablename__ = 'roles'
    name = Column(String(100), nullable=False)
    description = Column(LONGTEXT)
    system_prompt = Column(LONGTEXT)
    avatar = Column(String(255))
    settings = Column(JSON)
    is_predefined = Column(Boolean, default=False)
    model = Column(String(36), nullable=True)  # 关联的模型配置ID (UUID)
    is_observer_role = Column(Boolean, default=False)  # 是否为监督者角色
    source = Column(String(20), default='internal')  # 角色来源：internal(内部)或external(外部)

    # 角色级别的模型参数（从模型配置继承并可覆盖）
    temperature = Column(Float, default=0.7)  # 温度参数，控制随机性
    top_p = Column(Float, default=1.0)  # Top-P采样参数
    frequency_penalty = Column(Float, default=0.0)  # 频率惩罚
    presence_penalty = Column(Float, default=0.0)  # 存在惩罚
    stop_sequences = Column(JSON, default=list)  # 停止序列

    # 多租户字段
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    is_shared = Column(Boolean, default=False)

    # 关联关系
    knowledge_bases = relationship("RoleKnowledge", back_populates="role")
    tools = relationship("RoleTool", back_populates="role")

    capabilities = relationship("RoleCapability", back_populates="role")  # 新增能力关联
    skills = relationship("RoleSkill", back_populates="role")  # 技能关联
    agents = relationship("Agent", back_populates="role")
    action_spaces = relationship("ActionSpaceRole", back_populates="role")  # 添加行动空间关联
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f'<Role {self.name}>'

class Knowledge(BaseMixin, db.Model):
    __tablename__ = 'knowledges'
    name = Column(String(100), nullable=False)
    description = Column(LONGTEXT)
    type = Column(String(50))  # 知识库类型标识，统一为'knowledge'
    content = Column(LONGTEXT)
    settings = Column(JSON)
    search_config = Column(JSON, default=dict)  # 知识库检索配置

    # 多租户字段
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    is_shared = Column(Boolean, default=False)

    # LightRAG 集成字段
    kb_type = Column(String(20), default='vector')  # 'vector' | 'lightrag'
    lightrag_workspace = Column(String(100))  # LightRAG workspace identifier
    lightrag_config = Column(JSON, default=dict)  # LightRAG specific config

    roles = relationship("RoleKnowledge", back_populates="knowledge")
    creator = relationship("User", foreign_keys=[created_by])

    def get_search_config(self):
        """
        获取检索配置，提供业界最佳实践的默认值
        
        【用户可配置】:
        - search_mode: 检索模式 (vector/bm25/hybrid，默认hybrid)
        - vector_weight: 混合权重 (0-1，默认0.7=70%向量+30%关键字)
        - top_k: 每次查询返回的结果数量（默认5）
        
        【固定参数】（对齐RAGFlow/Dify/Weaviate）:
        - fusion_method: 固定weighted加权融合（业界主流）
        - bm25_k1: 固定1.5（学术界推荐）
        - bm25_b: 固定0.75（学术界推荐）
        """
        default_config = {
            # 用户可配置参数
            'search_mode': 'hybrid',       # 检索模式
            'vector_weight': 0.7,          # 混合权重：70%向量+30%关键字
            'top_k': 5,                    # 每次查询返回的结果数量
            
            # 固定参数（业界最佳实践，不在UI暴露）
            'fusion_method': 'weighted',   # 加权融合
            'bm25_k1': 1.5,                # BM25词频参数
            'bm25_b': 0.75                 # BM25长度归一化
        }
        if not self.search_config:
            return default_config
        
        # 合并用户配置，但确保固定参数不被覆盖
        user_config = {**self.search_config}
        user_config['fusion_method'] = 'weighted'
        user_config['bm25_k1'] = 1.5
        user_config['bm25_b'] = 0.75
        
        return {**default_config, **user_config}

    def get_lightrag_search_config(self):
        """
        获取 LightRAG 检索配置，提供默认值
        
        【用户可配置】:
        - query_mode: 查询模式 (naive/local/global/hybrid/mix，默认 hybrid)
        - top_k: 返回结果数量（默认 10）
        - response_type: 响应类型（默认 Multiple Paragraphs）
        
        Returns:
            dict: LightRAG 检索配置
        """
        default_config = {
            'query_mode': 'hybrid',              # 查询模式
            'top_k': 10,                         # 返回结果数量
            'response_type': 'Multiple Paragraphs',  # 响应类型
        }
        
        # 从 lightrag_config 中读取用户配置
        if not self.lightrag_config:
            return default_config
        
        # 合并用户配置
        user_config = {**self.lightrag_config}
        return {**default_config, **user_config}

    def __repr__(self):
        return f'<Knowledge {self.name}>'

# 图谱增强配置模型
class GraphEnhancement(BaseMixin, db.Model):
    __tablename__ = 'graph_enhancements'

    # 基础配置
    enabled = Column(Boolean, default=False)  # 是否启用图谱增强
    framework = Column(String(50), default='graphiti')  # RAG框架: lightrag, graphiti, graphrag
    name = Column(String(100), nullable=False)  # 配置名称
    description = Column(LONGTEXT)  # 配置描述

    # 所有其他配置都存储在这个JSON字段中
    framework_config = Column(JSON, default=dict)  # 框架特定配置参数

    def __repr__(self):
        return f'<GraphEnhancement {self.name}>'

class Tool(BaseMixin, db.Model):
    __tablename__ = 'tools'
    name = Column(String(100), nullable=False)
    description = Column(LONGTEXT)
    type = Column(String(50))
    config = Column(JSON)
    settings = Column(JSON)

    roles = relationship("RoleTool", back_populates="tool")

    def __repr__(self):
        return f'<Tool {self.name}>'

class Capability(BaseMixin, db.Model):
    __tablename__ = 'capabilities'
    name = Column(String(100), nullable=False)
    description = Column(LONGTEXT)
    type = Column(String(50))  # 能力类型，如：text, vision, code等
    provider = Column(String(50))  # 提供商
    parameters = Column(JSON)  # 输入参数定义
    response_format = Column(JSON)  # 响应格式定义
    examples = Column(JSON)  # 示例
    settings = Column(JSON)  # 额外设置
    tools = Column(JSON, default=dict)  # 存储能力与工具/MCP服务器的关联关系，格式: {"server1": ["tool1", "tool2"], "server2": ["tool2"]}
    security_level = Column(Integer, default=1)  # 安全级别: 1=低风险, 2=中风险, 3=高风险
    default_enabled = Column(Boolean, default=False)  # 是否默认启用
    icon = Column(String(50))  # 图标名称

    # 多租户字段
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    is_shared = Column(Boolean, default=False)

    # 关联关系
    roles = relationship("RoleCapability", back_populates="capability")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f'<Capability {self.name}>'

class RoleCapability(BaseMixin, db.Model):
    __tablename__ = 'role_capabilities'
    role_id = Column(String(36), ForeignKey('roles.id'), nullable=False)
    capability_id = Column(String(36), ForeignKey('capabilities.id'), nullable=False)

    role = relationship("Role", back_populates="capabilities")
    capability = relationship("Capability", back_populates="roles")

    def __repr__(self):
        return f'<RoleCapability {self.role_id}:{self.capability_id}>'


class Skill(BaseMixin, db.Model):
    __tablename__ = 'skills'
    name = Column(String(64), nullable=False, unique=True)  # kebab-case，与目录名一致
    description = Column(String(1024), nullable=False)       # 触发描述（唯一触发机制）
    display_name = Column(String(100))                       # 显示名称
    enabled = Column(Boolean, default=True)
    security_level = Column(Integer, default=1)              # 1=低 2=中 3=高
    storage_type = Column(String(20), default='filesystem')  # filesystem | database
    skill_md_content = Column(LONGTEXT, nullable=True)       # database 模式下存完整 SKILL.md
    config = Column(JSON, default=dict)                      # 扩展配置

    # 多租户
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    is_shared = Column(Boolean, default=True)

    # 关联
    roles = relationship("RoleSkill", back_populates="skill", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f'<Skill {self.name}>'


class RoleSkill(BaseMixin, db.Model):
    __tablename__ = 'role_skills'
    role_id = Column(String(36), ForeignKey('roles.id'), nullable=False)
    skill_id = Column(String(36), ForeignKey('skills.id'), nullable=False)

    role = relationship("Role", back_populates="skills")
    skill = relationship("Skill", back_populates="roles")

    def __repr__(self):
        return f'<RoleSkill {self.role_id}:{self.skill_id}>'


class WorkspaceTemplate(BaseMixin, db.Model):
    __tablename__ = 'workspace_templates'
    name = Column(String(100), nullable=False)
    description = Column(LONGTEXT)
    category = Column(String(50), nullable=False)  # shared, agent
    content = Column(LONGTEXT, nullable=False)
    source_file_path = Column(String(500))  # 源文件路径（如果从文件创建）
    is_active = Column(Boolean, default=True)
    settings = Column(JSON, default=dict)

    def __repr__(self):
        return f'<WorkspaceTemplate {self.name}>'

class RoleKnowledge(BaseMixin, db.Model):
    __tablename__ = 'role_knowledges'
    role_id = Column(String(36), ForeignKey('roles.id'), nullable=False)
    knowledge_id = Column(String(36), ForeignKey('knowledges.id'), nullable=False)

    role = relationship("Role", back_populates="knowledge_bases")
    knowledge = relationship("Knowledge", back_populates="roles")

    def __repr__(self):
        return f'<RoleKnowledge {self.role_id}:{self.knowledge_id}>'


# 知识库文件表（主表）
class KnowledgeDocument(BaseMixin, db.Model):
    __tablename__ = 'knowledge_documents'
    knowledge_id = Column(String(36), ForeignKey('knowledges.id'), nullable=False)
    file_name = Column(String(255), nullable=False)  # 文件名
    file_path = Column(String(500), nullable=False)  # 文件相对路径（相对于知识库目录）
    file_hash = Column(String(64))  # SHA256 hash，用于去重
    file_size = Column(Integer)  # 文件大小（字节）
    status = Column(String(20), nullable=False, default='pending')  # pending, processing, completed, failed
    error_message = Column(LONGTEXT)  # 错误信息
    
    # LightRAG 集成字段
    lightrag_synced = Column(Boolean, default=False)  # 是否已同步到 LightRAG
    lightrag_workspace = Column(String(100))  # LightRAG workspace
    lightrag_sync_job_id = Column(String(36), ForeignKey('jobs.id'))  # 关联的 Job ID
    lightrag_track_id = Column(String(100))  # LightRAG 返回的 track_id，用于追踪处理状态
    
    knowledge = relationship("Knowledge")
    lightrag_sync_job = relationship("Job", foreign_keys=[lightrag_sync_job_id])
    
    # 添加唯一索引，确保同一个文件不会重复上传
    __table_args__ = (
        db.Index('idx_knowledge_file', 'knowledge_id', 'file_path', unique=True),
        db.Index('idx_file_hash', 'file_hash'),
        db.Index('idx_lightrag_synced', 'lightrag_synced'),
        db.Index('idx_lightrag_sync_job', 'lightrag_sync_job_id'),
    )
    
    def __repr__(self):
        return f'<KnowledgeDocument {self.knowledge_id}:{self.file_path}>'


# 知识库文件转换记录表（元数据存储）
class KnowledgeFileConversion(BaseMixin, db.Model):
    __tablename__ = 'knowledge_file_conversions'
    document_id = Column(String(36), ForeignKey('knowledge_documents.id'), nullable=False)
    knowledge_id = Column(String(36), ForeignKey('knowledges.id'), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    job_id = Column(String(36), ForeignKey('jobs.id'))  # 关联Job获取状态
    parser_tool = Column(String(50))  # 解析器工具名称
    markdown_path = Column(String(500))  # 转换结果路径

    knowledge = relationship("Knowledge")
    document = relationship("KnowledgeDocument")

    def __repr__(self):
        return f'<KnowledgeFileConversion {self.knowledge_id}:{self.file_path}>'

class RoleTool(BaseMixin, db.Model):
    __tablename__ = 'role_tools'
    role_id = Column(String(36), ForeignKey('roles.id'), nullable=False)
    tool_id = Column(String(36), ForeignKey('tools.id'), nullable=False)

    role = relationship("Role", back_populates="tools")
    tool = relationship("Tool", back_populates="roles")

    def __repr__(self):
        return f'<RoleTool {self.role_id}:{self.tool_id}>'


# 知识库文件分段记录表（元数据存储）
class KnowledgeFileChunking(BaseMixin, db.Model):
    __tablename__ = 'knowledge_file_chunkings'
    document_id = Column(String(36), ForeignKey('knowledge_documents.id'), nullable=False)
    knowledge_id = Column(String(36), ForeignKey('knowledges.id'), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    job_id = Column(String(36), ForeignKey('jobs.id'))  # 关联Job获取状态
    chunk_method = Column(String(50))  # 分段方法（recursive, semantic等）
    chunk_size = Column(Integer)  # 分段大小
    chunk_overlap = Column(Integer)  # 重叠大小
    chunk_count = Column(Integer)  # 分块数量

    knowledge = relationship("Knowledge")
    document = relationship("KnowledgeDocument")

    def __repr__(self):
        return f'<KnowledgeFileChunking {self.knowledge_id}:{self.file_path}>'


# 知识库文件嵌入记录表（元数据存储）
class KnowledgeFileEmbedding(BaseMixin, db.Model):
    __tablename__ = 'knowledge_file_embeddings'
    document_id = Column(String(36), ForeignKey('knowledge_documents.id'), nullable=False)
    knowledge_id = Column(String(36), ForeignKey('knowledges.id'), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    job_id = Column(String(36), ForeignKey('jobs.id'))  # 关联Job获取状态
    embedding_model = Column(String(100))  # 嵌入模型名称
    vector_count = Column(Integer)  # 向量数量
    vector_dimension = Column(Integer)  # 向量维度
    collection_name = Column(String(255))  # Milvus集合名

    knowledge = relationship("Knowledge")
    document = relationship("KnowledgeDocument")

    def __repr__(self):
        return f'<KnowledgeFileEmbedding {self.knowledge_id}:{self.file_path}>'


# 知识库文件分块表
class KnowledgeFileChunk(BaseMixin, db.Model):
    __tablename__ = 'knowledge_file_chunks'
    document_id = Column(String(36), ForeignKey('knowledge_documents.id'), nullable=False)  # 关联到 documents 表
    knowledge_id = Column(String(36), ForeignKey('knowledges.id'), nullable=False)
    file_path = Column(String(500), nullable=False)  # 原始文件相对路径
    chunk_index = Column(Integer, nullable=False)  # 分块索引
    content = Column(LONGTEXT, nullable=False)
    chunk_metadata = Column(JSON)  # 分块元数据（方法、参数等）
    
    knowledge = relationship("Knowledge")
    document = relationship("KnowledgeDocument")
    
    # 索引以加速查询
    __table_args__ = (
        db.Index('idx_chunk_knowledge_file', 'knowledge_id', 'file_path'),
        db.Index('idx_chunk_document_id', 'document_id'),
    )
    
    def __repr__(self):
        return f'<KnowledgeFileChunk {self.knowledge_id}:{self.file_path}:{self.chunk_index}>'


# 外部知识库提供商表
class ExternalKnowledgeProvider(BaseMixin, db.Model):
    __tablename__ = 'external_kb_providers'
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)  # dify, ragflow, fastgpt, custom
    base_url = Column(String(500), nullable=False)
    api_key = Column(String(500), nullable=False)
    config = Column(JSON)  # 其他配置信息
    status = Column(String(20), default='active')  # active, inactive

    # 多租户字段
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    is_shared = Column(Boolean, default=False)

    # 关联关系
    external_knowledges = relationship("ExternalKnowledge", back_populates="provider", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f'<ExternalKnowledgeProvider {self.name}>'

# 外部知识库表
class ExternalKnowledge(BaseMixin, db.Model):
    __tablename__ = 'external_knowledges'
    name = Column(String(100), nullable=False)
    description = Column(LONGTEXT)
    provider_id = Column(String(36), ForeignKey('external_kb_providers.id'), nullable=False)
    external_kb_id = Column(String(100), nullable=False)  # 外部系统中的知识库ID
    query_config = Column(JSON)  # 查询配置
    status = Column(String(20), default='active')  # active, inactive

    # 关联关系
    provider = relationship("ExternalKnowledgeProvider", back_populates="external_knowledges")
    roles = relationship("RoleExternalKnowledge", back_populates="external_knowledge", cascade="all, delete-orphan")

    def __repr__(self):
        return f'<ExternalKnowledge {self.name}>'

# 角色外部知识库关联表
class RoleExternalKnowledge(BaseMixin, db.Model):
    __tablename__ = 'role_external_knowledges'
    role_id = Column(String(36), ForeignKey('roles.id'), nullable=False)
    external_knowledge_id = Column(String(36), ForeignKey('external_knowledges.id'), nullable=False)
    config = Column(JSON)  # 角色特定的查询配置

    # 关联关系
    role = relationship("Role")
    external_knowledge = relationship("ExternalKnowledge", back_populates="roles")

    # 唯一约束
    __table_args__ = (db.UniqueConstraint('role_id', 'external_knowledge_id', name='_role_external_knowledge_uc'),)

    def __repr__(self):
        return f'<RoleExternalKnowledge {self.role_id}:{self.external_knowledge_id}>'

# 外部知识库查询日志表
class ExternalKnowledgeQueryLog(BaseMixin, db.Model):
    __tablename__ = 'external_kb_query_logs'
    external_knowledge_id = Column(String(36), ForeignKey('external_knowledges.id'), nullable=False)
    role_id = Column(String(36), ForeignKey('roles.id'))
    query_text = Column(LONGTEXT, nullable=False)
    response_data = Column(JSON)
    query_time = Column(Float)  # 查询耗时(秒)
    status = Column(String(20))  # success, error, timeout
    error_message = Column(LONGTEXT)

    # 关联关系
    external_knowledge = relationship("ExternalKnowledge")
    role = relationship("Role")

    def __repr__(self):
        return f'<ExternalKnowledgeQueryLog {self.external_knowledge_id}>'

class Agent(BaseMixin, db.Model):
    __tablename__ = 'agents'
    name = Column(String(100), nullable=False)
    description = Column(LONGTEXT)
    avatar = Column(String(255))
    settings = Column(JSON)
    status = Column(String(20), default='active')
    action_task_id = Column(String(36), ForeignKey('action_tasks.id'))
    role_id = Column(String(36), ForeignKey('roles.id'), nullable=False)
    type = Column(String(20), default='agent')
    source = Column(String(20), default='internal')  # 智能体来源：internal(内部)或external(外部)
    additional_prompt = Column(LONGTEXT, default='')  # 额外提示词，从行动空间角色中获取
    is_observer = Column(Boolean, default=False)  # 是否为监督者

    role = relationship("Role", back_populates="agents")
    action_task = relationship("ActionTask", back_populates="direct_agents")
    action_task_agents = relationship("ActionTaskAgent", back_populates="agent")
    messages = relationship("Message", back_populates="agent")
    conversation_agents = relationship("ConversationAgent", back_populates="agent")
    variables = relationship("AgentVariable", back_populates="agent")  # 新增代理变量关联

    def __repr__(self):
        return f'<Agent {self.name}>'

class AgentVariable(BaseMixin, db.Model):
    """代理变量模型，用于存储每个代理的特定变量"""
    __tablename__ = 'agent_variables'
    name = Column(String(100), nullable=False)
    label = Column(String(100))  # 变量标签，用于前端显示
    value = Column(LONGTEXT)
    history = Column(JSON, default=list)  # 历史记录
    is_public = Column(Boolean, default=True)  # 是否对其他代理公开

    agent_id = Column(String(36), ForeignKey('agents.id', ondelete='CASCADE'), nullable=False)
    agent = relationship("Agent", back_populates="variables")

    def __repr__(self):
        return f'<AgentVariable {self.name} for agent {self.agent_id}>'

class ActionTask(BaseMixin, db.Model):
    __tablename__ = 'action_tasks'
    title = Column(String(100), nullable=False)
    description = Column(LONGTEXT)
    status = Column(String(20), default='active')  # active, completed, terminated
    mode = Column(String(20), default='sequential')  # sequential, panel
    rule_set_id = Column(String(36), ForeignKey('rule_sets.id'))

    user_id = Column(String(36), ForeignKey('users.id'))
    action_space_id = Column(String(36), ForeignKey('action_spaces.id'))

    # 多租户字段（ActionTask 使用 user_id 作为所有者标识）
    is_shared = Column(Boolean, default=False)
    
    # 并行实验相关
    is_experiment_clone = Column(Boolean, default=False)  # 是否为实验克隆，用于前端过滤

    user = relationship("User", back_populates="action_tasks")
    action_space = relationship("ActionSpace", back_populates="action_tasks")
    agents = relationship("ActionTaskAgent", back_populates="action_task")
    direct_agents = relationship("Agent", back_populates="action_task")
    messages = relationship("Message", back_populates="action_task")
    environment_variables = relationship("ActionTaskEnvironmentVariable", back_populates="action_task")
    conversations = relationship("Conversation", back_populates="action_task")
    published_versions = relationship("PublishedTask", back_populates="action_task", cascade="all, delete-orphan")

    def __repr__(self):
        return f'<ActionTask {self.title}>'

class Conversation(BaseMixin, db.Model):
    __tablename__ = 'conversations'
    title = Column(String(100), nullable=False)
    description = Column(LONGTEXT)
    status = Column(String(20), default='active')  # active, completed, terminated
    mode = Column(String(20), default='sequential')  # sequential, panel

    action_task_id = Column(String(36), ForeignKey('action_tasks.id'), nullable=False)

    action_task = relationship("ActionTask", back_populates="conversations")
    agents = relationship("ConversationAgent", back_populates="conversation")
    messages = relationship("Message", back_populates="conversation")
    autonomous_tasks = relationship("AutonomousTask", back_populates="conversation", cascade="all, delete-orphan")
    plans = relationship("ConversationPlan", back_populates="conversation", cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Conversation {self.title}>'

class ConversationAgent(BaseMixin, db.Model):
    __tablename__ = 'conversation_agents'
    conversation_id = Column(String(36), ForeignKey('conversations.id'), nullable=False)
    agent_id = Column(String(36), ForeignKey('agents.id'), nullable=False)
    is_default = Column(Boolean, default=False)

    conversation = relationship("Conversation", back_populates="agents")
    agent = relationship("Agent", back_populates="conversation_agents")

    def __repr__(self):
        return f'<ConversationAgent {self.conversation_id}:{self.agent_id}>'

class AutonomousTask(BaseMixin, db.Model):
    __tablename__ = 'autonomous_tasks'
    conversation_id = Column(String(36), ForeignKey('conversations.id'), nullable=False)
    type = Column(String(20), nullable=False)  # discussion, conditional_stop, variable_trigger, time_trigger, autonomous_scheduling
    status = Column(String(20), default='active')  # active, completed, stopped
    config = Column(JSON, nullable=False)  # 存储不同类型任务的配置参数

    conversation = relationship("Conversation", back_populates="autonomous_tasks")
    executions = relationship("AutonomousTaskExecution", back_populates="autonomous_task", cascade="all, delete-orphan")

    def __repr__(self):
        return f'<AutonomousTask {self.id}:{self.type}>'

class AutonomousTaskExecution(BaseMixin, db.Model):
    __tablename__ = 'autonomous_task_executions'
    autonomous_task_id = Column(String(36), ForeignKey('autonomous_tasks.id'), nullable=False)
    execution_type = Column(String(20), nullable=False)  # manual, scheduled, triggered
    trigger_source = Column(String(50))  # time, variable_change, condition_met, user
    trigger_data = Column(JSON)  # 触发时的相关数据
    status = Column(String(20), default='running')  # running, completed, failed, stopped
    start_time = Column(DateTime, default=lambda: get_current_time_with_timezone())
    end_time = Column(DateTime)
    result = Column(JSON)  # 执行结果
    error_message = Column(LONGTEXT)  # 错误信息

    autonomous_task = relationship("AutonomousTask", back_populates="executions")

    def __repr__(self):
        return f'<AutonomousTaskExecution {self.id}:{self.execution_type}>'

class ActionTaskAgent(BaseMixin, db.Model):
    __tablename__ = 'action_task_agents'
    action_task_id = Column(String(36), ForeignKey('action_tasks.id'), nullable=False)
    agent_id = Column(String(36), ForeignKey('agents.id'), nullable=False)
    is_default = Column(Boolean, default=False)

    action_task = relationship("ActionTask", back_populates="agents")
    agent = relationship("Agent", back_populates="action_task_agents")

    def __repr__(self):
        return f'<ActionTaskAgent {self.action_task_id}:{self.agent_id}>'

class ActionTaskEnvironmentVariable(BaseMixin, db.Model):
    __tablename__ = 'action_task_environment_variables'
    name = Column(String(100), nullable=False)
    label = Column(String(100))  # 添加标签字段
    value = Column(LONGTEXT)
    history = Column(JSON, default=list)

    # 共享环境变量相关字段
    shared_variable_id = Column(String(36), ForeignKey('shared_environment_variables.id'), nullable=True)
    is_readonly = Column(Boolean, default=False)  # 是否只读

    action_task_id = Column(String(36), ForeignKey('action_tasks.id', ondelete='CASCADE'), nullable=False)
    action_task = relationship("ActionTask", back_populates="environment_variables")
    shared_variable = relationship("SharedEnvironmentVariable", back_populates="task_variables")

    def __repr__(self):
        return f'<ActionTaskEnvironmentVariable {self.name}>'


# ==================== PLANNER 功能模型 ====================

class ConversationPlan(BaseMixin, db.Model):
    """
    会话计划模型 - KISS 精简版
    存储智能体创建的执行计划
    """
    __tablename__ = 'conversation_plans'
    
    conversation_id = Column(String(36), ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(LONGTEXT)
    creator_agent_id = Column(String(36), ForeignKey('agents.id'))
    
    # 关系
    conversation = relationship("Conversation", back_populates="plans")
    creator_agent = relationship("Agent", foreign_keys=[creator_agent_id])
    items = relationship("ConversationPlanItem", back_populates="plan", cascade="all, delete-orphan", order_by="ConversationPlanItem.order_index")
    
    def __repr__(self):
        return f'<ConversationPlan {self.id}: {self.title}>'
    
    def to_dict(self, include_items=True, include_progress=True):
        """转换为字典格式"""
        data = {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'title': self.title,
            'description': self.description,
            'creator_agent_id': self.creator_agent_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        # 包含创建者信息
        if self.creator_agent:
            data['creator_agent'] = {
                'id': self.creator_agent.id,
                'name': self.creator_agent.name
            }
        
        # 包含计划项
        if include_items and self.items:
            data['items'] = [item.to_dict(include_plan=False) for item in self.items]
        
        # 包含进度统计（实时计算）
        if include_progress:
            if self.items:
                total = len(self.items)
                completed = sum(1 for item in self.items if item.status == 'completed')
                pending = sum(1 for item in self.items if item.status == 'pending')
                percentage = round((completed / total * 100)) if total > 0 else 0
                
                # 计算计划状态（实时计算，不存储）
                if total > 0 and completed == total:
                    plan_status = 'completed'
                else:
                    plan_status = 'active'
            else:
                # 没有任务项时的默认值
                total = 0
                completed = 0
                pending = 0
                percentage = 0
                plan_status = 'active'
            
            # 前端需要的顶层字段
            data['status'] = plan_status
            data['completed_count'] = completed
            data['total_count'] = total
            data['progress_percentage'] = percentage
            data['pending_count'] = pending
        
        return data


class ConversationPlanItem(BaseMixin, db.Model):
    """
    会话计划项模型 - KISS 精简版
    存储计划中的具体任务项
    """
    __tablename__ = 'conversation_plan_items'
    
    plan_id = Column(String(36), ForeignKey('conversation_plans.id', ondelete='CASCADE'), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(LONGTEXT)
    status = Column(String(20), default='pending')  # pending, completed
    order_index = Column(Integer, default=0)
    
    # 关系
    plan = relationship("ConversationPlan", back_populates="items")
    
    def __repr__(self):
        return f'<ConversationPlanItem {self.id}: {self.title}>'
    
    def to_dict(self, include_plan=False):
        """转换为字典格式"""
        data = {
            'id': self.id,
            'plan_id': self.plan_id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'order_index': self.order_index,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        # 包含计划信息
        if include_plan and self.plan:
            data['plan'] = self.plan.to_dict(include_items=False, include_progress=False)
        
        return data


# ==================== END PLANNER 功能模型 ====================

class Message(BaseMixin, db.Model):
    __tablename__ = 'messages'
    # 重写id字段为Integer类型（消息ID保持数字）
    id = Column(Integer, primary_key=True)
    content = Column(LONGTEXT, nullable=False)  # 存储所有消息内容，包括思考标签
    # thinking字段已完全弃用，所有处理都移到前端，此字段仅保留数据库兼容性，在代码中不再使用
    thinking = Column(LONGTEXT)
    raw_message = Column(LONGTEXT)  # 存储消息的原始内容，包含思考过程等完整内容
    role = Column(String(20), nullable=False)  # human, agent, system, tool, supervisor
    source = Column(String(50), default='taskConversation')  # taskConversation, supervisorConversation
    meta = Column(JSON, default=dict)  # 元数据字段，用于存储额外信息如目标会话类型等

    action_task_id = Column(String(36), ForeignKey('action_tasks.id'), nullable=False)
    conversation_id = Column(String(36), ForeignKey('conversations.id'))
    agent_id = Column(String(36), ForeignKey('agents.id'))
    user_id = Column(String(36), ForeignKey('users.id'))

    action_task = relationship("ActionTask", back_populates="messages")
    conversation = relationship("Conversation", back_populates="messages")
    agent = relationship("Agent", back_populates="messages")

    def __repr__(self):
        return f'<Message {self.id} in action_task {self.action_task_id}>'

class ModelConfig(BaseMixin, db.Model):
    __tablename__ = 'model_configs'
    name = Column(String(100), nullable=False)
    provider = Column(String(50), nullable=False)  # openai, anthropic, etc.
    model_id = Column(String(100), nullable=False)  # gpt-3.5-turbo, claude-3-sonnet, etc.
    base_url = Column(String(255))
    api_key = Column(String(255))
    context_window = Column(Integer, default=65536)  # 上下文窗口大小
    max_output_tokens = Column(Integer, default=2000)  # 最大输出token数
    request_timeout = Column(Integer, default=60)  # 请求超时时间(秒)
    is_default = Column(Boolean, default=False)  # 是否为默认模型（保留向后兼容）
    is_default_text = Column(Boolean, default=False)  # 是否为默认文本生成模型
    is_default_embedding = Column(Boolean, default=False)  # 是否为默认嵌入模型
    is_default_rerank = Column(Boolean, default=False)  # 是否为默认重排序模型
    modalities = Column(JSON, default=list)  # 模型模态，如text_input, text_output, image_input等
    capabilities = Column(JSON, default=list)  # 模型特性标签，如function_calling, reasoning等
    additional_params = Column(JSON, default=dict)  # 额外参数
    format_compatibility = Column(String(20), default='openai')  # 格式兼容性: openai, anthropic, custom

    def __repr__(self):
        return f'<ModelConfig {self.name}>'

class Tag(BaseMixin, db.Model):
    __tablename__ = 'tags'
    name = Column(String(100), nullable=False)
    type = Column(String(50))  # industry (行业标签), scenario (场景标签)
    description = Column(LONGTEXT)
    color = Column(String(20))  # 标签颜色代码

    # 关联关系
    action_spaces = relationship("ActionSpaceTag", back_populates="tag")

    def __repr__(self):
        return f'<Tag {self.name}>'

class ActionSpaceTag(BaseMixin, db.Model):
    __tablename__ = 'action_space_tags'
    action_space_id = Column(String(36), ForeignKey('action_spaces.id'), nullable=False)
    tag_id = Column(String(36), ForeignKey('tags.id'), nullable=False)

    # 关联关系
    action_space = relationship("ActionSpace", back_populates="tags")
    tag = relationship("Tag", back_populates="action_spaces")

    def __repr__(self):
        return f'<ActionSpaceTag {self.action_space_id}:{self.tag_id}>'

class SystemSetting(BaseMixin, db.Model):
    """系统设置模型，用于存储全局系统配置"""
    __tablename__ = 'system_settings'
    key = Column(String(100), nullable=False, unique=True)  # 配置键名
    value = Column(LONGTEXT)  # 配置值
    value_type = Column(String(20), default='string')  # string, number, boolean, json
    description = Column(LONGTEXT)  # 配置描述
    category = Column(String(50), default='general')  # 配置分类
    is_secret = Column(Boolean, default=False)  # 是否为敏感信息

    def __repr__(self):
        return f'<SystemSetting {self.key}>'

    @classmethod
    def get(cls, key, default=None):
        """获取指定键的配置值"""
        setting = cls.query.filter_by(key=key).first()
        if setting is None:
            return default

        # 根据类型转换值
        if setting.value_type == 'number':
            try:
                if '.' in setting.value:
                    return float(setting.value)
                return int(setting.value)
            except (ValueError, TypeError):
                return default
        elif setting.value_type == 'boolean':
            return setting.value.lower() in ('true', '1', 'yes')
        elif setting.value_type == 'json':
            try:
                import json
                return json.loads(setting.value)
            except:
                return default
        else:
            return setting.value

    @classmethod
    def set(cls, key, value, value_type='string', description=None, category='general', is_secret=False):
        """设置配置键值"""
        # 将值转换为字符串存储
        if value_type == 'json' and not isinstance(value, str):
            import json
            value = json.dumps(value)
        elif not isinstance(value, str):
            value = str(value)

        setting = cls.query.filter_by(key=key).first()
        if setting is None:
            # 创建新配置
            setting = cls(
                key=key,
                value=value,
                value_type=value_type,
                description=description,
                category=category,
                is_secret=is_secret
            )
            from app.extensions import db
            db.session.add(setting)
        else:
            # 更新现有配置
            setting.value = value
            if value_type:
                setting.value_type = value_type
            if description:
                setting.description = description
            if category:
                setting.category = category
            setting.is_secret = is_secret

        # 提交事务
        from app.extensions import db
        db.session.commit()
        return setting

class ActionSpaceRole(BaseMixin, db.Model):
    """行动空间与角色的多对多关联表"""
    __tablename__ = 'action_space_roles'
    action_space_id = Column(String(36), ForeignKey('action_spaces.id'), nullable=False)
    role_id = Column(String(36), ForeignKey('roles.id'), nullable=False)
    quantity = Column(Integer, default=1)  # 角色数量
    settings = Column(JSON, default=dict)  # 角色在该行动空间中的特定设置
    additional_prompt = Column(LONGTEXT, default='')  # 额外提示词，用于指导角色行为

    action_space = relationship("ActionSpace", back_populates="roles")
    role = relationship("Role", back_populates="action_spaces")

    def __repr__(self):
        return f'<ActionSpaceRole {self.action_space_id}:{self.role_id}>'

class ActionSpaceEnvironmentVariable(BaseMixin, db.Model):
    """行动空间环境变量模型

    用于存储行动空间级别的环境变量配置
    """
    __tablename__ = 'action_space_environment_variables'

    action_space_id = db.Column(String(36), db.ForeignKey('action_spaces.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    label = db.Column(db.String(100), nullable=False)
    value = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联关系
    action_space = db.relationship('ActionSpace', backref=db.backref('environment_variables', lazy=True))

    def __repr__(self):
        return f'<ActionSpaceEnvironmentVariable {self.name}>'

class RoleVariable(BaseMixin, db.Model):
    """角色变量模型

    用于存储角色级别的变量配置，这些变量会在创建行动任务时被实例化为智能体变量
    每个角色变量都与特定行动空间绑定，不影响其他行动空间
    """
    __tablename__ = 'role_variables'

    role_id = db.Column(String(36), db.ForeignKey('roles.id'), nullable=False)
    action_space_id = db.Column(String(36), db.ForeignKey('action_spaces.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    label = db.Column(db.String(100), nullable=False)
    value = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text)

    # 关联关系
    role = db.relationship('Role', backref=db.backref('variables', lazy=True))
    action_space = db.relationship('ActionSpace')

    def __repr__(self):
        return f'<RoleVariable {self.name} for role {self.role_id}>'

class SharedEnvironmentVariable(BaseMixin, db.Model):
    """共享环境变量模型

    用于存储可在多个行动空间中共享的环境变量
    """
    __tablename__ = 'shared_environment_variables'

    name = Column(String(100), nullable=False, unique=True)  # 全局唯一的变量名
    label = Column(String(100), nullable=False)  # 显示标签
    value = Column(LONGTEXT)  # 值
    description = Column(LONGTEXT)  # 描述
    is_readonly = Column(Boolean, default=False)  # 是否只读

    # 关联关系
    action_spaces = relationship("ActionSpaceSharedVariable", back_populates="shared_variable", cascade="all, delete-orphan")
    task_variables = relationship("ActionTaskEnvironmentVariable", back_populates="shared_variable")

    def __repr__(self):
        return f'<SharedEnvironmentVariable {self.name}>'


class ActionSpaceSharedVariable(BaseMixin, db.Model):
    """行动空间与共享环境变量的绑定关系表"""
    __tablename__ = 'action_space_shared_variables'

    action_space_id = Column(String(36), ForeignKey('action_spaces.id', ondelete='CASCADE'), nullable=False)
    shared_variable_id = Column(String(36), ForeignKey('shared_environment_variables.id', ondelete='CASCADE'), nullable=False)

    # 关联关系
    action_space = relationship("ActionSpace", back_populates="shared_variables")
    shared_variable = relationship("SharedEnvironmentVariable", back_populates="action_spaces")

    # 复合唯一约束，防止重复绑定
    __table_args__ = (
        UniqueConstraint('action_space_id', 'shared_variable_id', name='unique_space_variable_binding'),
    )

    def __repr__(self):
        return f'<ActionSpaceSharedVariable space:{self.action_space_id} var:{self.shared_variable_id}>'


class ExternalEnvironmentVariable(BaseMixin, db.Model):
    """外部环境变量模型

    用于存储通过REST API定期同步获取的外部环境变量
    """
    __tablename__ = 'external_environment_variables'
    name = db.Column(db.String(100), nullable=False, unique=True)
    label = db.Column(db.String(200), nullable=False)
    api_url = db.Column(db.String(500), nullable=False)
    api_method = db.Column(db.String(10), nullable=False, default='GET')
    sync_interval = db.Column(db.Integer, nullable=False, default=300)  # 秒
    sync_enabled = db.Column(db.Boolean, nullable=False, default=True)
    value = db.Column(db.Text)
    last_sync = db.Column(db.DateTime)
    last_error = db.Column(db.Text)
    status = db.Column(db.String(20), nullable=False, default='inactive')  # active, error, inactive
    settings = db.Column(db.JSON)  # 存储扩展配置：api_headers, data_path, data_type, timeout, description等

    # 多租户字段
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    is_shared = Column(Boolean, default=False)

    # 关联关系
    creator = relationship("User", foreign_keys=[created_by])

    def to_dict(self):
        result = {
            'id': self.id,
            'name': self.name,
            'label': self.label,
            'api_url': self.api_url,
            'api_method': self.api_method,
            'sync_interval': self.sync_interval,
            'sync_enabled': self.sync_enabled,
            'value': self.value,
            'last_sync': self.last_sync.isoformat() if self.last_sync else None,
            'last_error': self.last_error,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

        # 合并settings中的字段
        if self.settings:
            result.update({
                'api_headers': self.settings.get('api_headers', '{}'),
                'data_path': self.settings.get('data_path', ''),
                'data_type': self.settings.get('data_type', 'string'),
                'timeout': self.settings.get('timeout', 10),
                'description': self.settings.get('description', '')
            })
        else:
            result.update({
                'api_headers': '{}',
                'data_path': '',
                'data_type': 'string',
                'timeout': 10,
                'description': ''
            })

        return result

    def __repr__(self):
        return f'<ExternalEnvironmentVariable {self.name}>'

# 添加行动空间与规则集的多对多关联表
class ActionSpaceRuleSet(BaseMixin, db.Model):
    """行动空间与规则集的多对多关联表"""
    __tablename__ = 'action_space_rule_sets'
    action_space_id = Column(String(36), ForeignKey('action_spaces.id'), nullable=False)
    rule_set_id = Column(String(36), ForeignKey('rule_sets.id'), nullable=False)
    settings = Column(JSON, default=dict)  # 关联特定设置

    action_space = relationship("ActionSpace", back_populates="rule_sets")
    rule_set = relationship("RuleSet", back_populates="action_spaces")

    def __repr__(self):
        return f'<ActionSpaceRuleSet {self.action_space_id}:{self.rule_set_id}>'

class ActionSpaceObserver(BaseMixin, db.Model):
    """行动空间与监督者角色的多对多关联表"""
    __tablename__ = 'action_space_observers'
    action_space_id = Column(String(36), ForeignKey('action_spaces.id'), nullable=False)
    role_id = Column(String(36), ForeignKey('roles.id'), nullable=False)
    settings = Column(JSON, default=dict)  # 监督者在该行动空间中的特定设置
    additional_prompt = Column(LONGTEXT, default='')  # 额外提示词，用于指导监督者行为
    # 移除规则集关联，规则集应该与行动空间关联，而不是与单个监督者关联

    action_space = relationship("ActionSpace", back_populates="observers")
    role = relationship("Role")

    def __repr__(self):
        return f'<ActionSpaceObserver {self.action_space_id}:{self.role_id}>'

    def get_default_supervision_settings(self):
        """获取默认的监督设置"""
        return {
            "supervision_mode": "round_based",  # immediate, round_based, variable_based
            "triggers": {
                "after_each_agent": False,
                "after_each_round": True,
                "on_rule_violation": True
            },
            "variable_conditions": [],  # 变量监督条件
            "condition_logic": "and",  # 条件逻辑：and/or
            "check_interval": 60,  # 变量检查间隔（秒）
            "intervention_settings": {
                "threshold": 0.7,  # 监督者介入的置信度阈值（默认平衡）
                "max_interventions_per_round": 1,  # 每轮最大干预次数
                "intervention_mode": "passive"  # 干预模式：passive（被动响应）, alert（主动记录）, intervene（任务干预）
            },
            "monitoring_scope": {
                "rule_compliance": True,  # 监控规则遵守情况（始终启用）
                "conversation_quality": False,  # 监控对话质量（待实现功能，暂时关闭）
                "task_progress": False,  # 监控任务进度（待实现功能，暂时关闭）
                "agent_behavior": False  # 监控智能体行为（待实现功能，暂时关闭）
            },
            "reporting": {
                "generate_summary": True,  # 生成监督总结
                "log_interventions": True,  # 记录干预日志
                "alert_on_issues": True  # 发现问题时发出警报
            }
        }

    def get_supervision_settings(self):
        """获取监督设置，如果没有则返回默认设置"""
        if not self.settings:
            return self.get_default_supervision_settings()

        # 合并默认设置和用户设置
        default_settings = self.get_default_supervision_settings()
        user_settings = self.settings.get('supervision', {})

        # 深度合并设置
        def deep_merge(default, user):
            result = default.copy()
            for key, value in user.items():
                if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                    result[key] = deep_merge(result[key], value)
                else:
                    result[key] = value
            return result

        return deep_merge(default_settings, user_settings)


# 实体应用市场模型
class MarketApp(BaseMixin, db.Model):
    """实体应用市场应用模型"""
    __tablename__ = 'market_apps'

    app_id = Column(String(100), unique=True, nullable=False)  # 应用唯一标识
    name = Column(String(200), nullable=False)                 # 应用名称
    enabled = Column(Boolean, default=True)                    # 是否启用
    launchable = Column(Boolean, default=True)                 # 是否可启动（false表示仅为功能开关）
    sort_order = Column(Integer, default=0)                    # 排序权重
    scope = Column(String(20), default='space')                # 应用范围：global(全局) 或 space(空间级别)
    config = Column(JSON, nullable=False)                      # 应用完整配置

    # 关联关系
    action_spaces = relationship("ActionSpaceApp", back_populates="app")

    def __repr__(self):
        return f'<MarketApp {self.app_id}>'

    def to_dict(self):
        """转换为字典格式"""
        return {
            'id': self.app_id,
            'name': self.name,
            'enabled': self.enabled,
            'launchable': self.launchable if self.launchable is not None else True,
            'sort_order': self.sort_order,
            'scope': self.scope or 'space',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            **self.config
        }


class ActionSpaceApp(BaseMixin, db.Model):
    """行动空间与应用的绑定关系表"""
    __tablename__ = 'action_space_apps'

    action_space_id = Column(String(36), ForeignKey('action_spaces.id', ondelete='CASCADE'), nullable=False)
    app_id = Column(String(100), ForeignKey('market_apps.app_id', ondelete='CASCADE'), nullable=False)
    enabled = Column(Boolean, default=True)  # 在该行动空间中是否启用
    settings = Column(JSON, default=dict)    # 应用在该行动空间中的特定设置

    # 关联关系
    action_space = relationship("ActionSpace", back_populates="apps")
    app = relationship("MarketApp", back_populates="action_spaces")

    # 唯一约束：一个行动空间中同一个应用只能绑定一次
    __table_args__ = (
        db.UniqueConstraint('action_space_id', 'app_id', name='unique_action_space_app'),
    )

    def __repr__(self):
        return f'<ActionSpaceApp {self.action_space_id}:{self.app_id}>'

    def to_dict(self):
        """转换为字典格式"""
        return {
            'id': self.id,
            'action_space_id': self.action_space_id,
            'app_id': self.app_id,
            'enabled': self.enabled,
            'settings': self.settings,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

# ==================== OAuth 账户模型 ====================

class OAuthAccount(BaseMixin, db.Model):
    """OAuth 账户关联表（精简版）"""
    __tablename__ = 'oauth_accounts'
    
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    provider = Column(String(50), nullable=False)  # google, apple, aws_cognito
    provider_user_id = Column(String(255), nullable=False)
    email = Column(String(255))
    avatar_url = Column(String(500))
    
    user = relationship("User", backref="oauth_accounts")
    
    __table_args__ = (
        UniqueConstraint('provider', 'provider_user_id', name='uq_oauth_provider_user'),
    )

    def __repr__(self):
        return f'<OAuthAccount {self.provider}:{self.provider_user_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'provider': self.provider,
            'provider_user_id': self.provider_user_id,
            'email': self.email,
            'avatar_url': self.avatar_url,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


# ==================== 用户权限系统模型 ====================

class UserRole(BaseMixin, db.Model):
    """用户角色模型"""
    __tablename__ = 'user_roles'

    name = Column(String(50), unique=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    description = Column(LONGTEXT)
    is_system = Column(Boolean, default=False)  # 系统内置角色不可删除
    is_active = Column(Boolean, default=True)

    # 关联关系
    user_role_assignments = relationship("UserRoleAssignment", back_populates="user_role", cascade="all, delete-orphan")
    user_role_permissions = relationship("UserRolePermission", back_populates="user_role", cascade="all, delete-orphan")

    def __repr__(self):
        return f'<UserRole {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'display_name': self.display_name,
            'description': self.description,
            'is_system': self.is_system,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class UserPermission(BaseMixin, db.Model):
    """用户权限模型"""
    __tablename__ = 'user_permissions'

    name = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    description = Column(LONGTEXT)
    category = Column(String(50), nullable=False)  # menu, feature, data
    resource = Column(String(50), nullable=False)  # users, tasks, agents, etc.
    action = Column(String(50), nullable=False)    # view, create, edit, delete, manage
    is_system = Column(Boolean, default=False)     # 系统内置权限不可删除

    # 关联关系
    user_role_permissions = relationship("UserRolePermission", back_populates="user_permission", cascade="all, delete-orphan")

    def __repr__(self):
        return f'<UserPermission {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'display_name': self.display_name,
            'description': self.description,
            'category': self.category,
            'resource': self.resource,
            'action': self.action,
            'is_system': self.is_system,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class UserRoleAssignment(BaseMixin, db.Model):
    """用户角色分配模型"""
    __tablename__ = 'user_role_assignments'

    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    user_role_id = Column(String(36), ForeignKey('user_roles.id'), nullable=False)
    assigned_by = Column(String(36), ForeignKey('users.id'))
    assigned_at = Column(DateTime, default=get_current_time_with_timezone)

    # 关联关系
    user = relationship("User", foreign_keys=[user_id])
    user_role = relationship("UserRole", back_populates="user_role_assignments")
    assigner = relationship("User", foreign_keys=[assigned_by])

    def __repr__(self):
        return f'<UserRoleAssignment user_id={self.user_id} user_role_id={self.user_role_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_role_id': self.user_role_id,
            'assigned_by': self.assigned_by,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'user_role': self.user_role.to_dict() if self.user_role else None
        }

class UserRolePermission(BaseMixin, db.Model):
    """用户角色权限关联模型"""
    __tablename__ = 'user_role_permissions'

    user_role_id = Column(String(36), ForeignKey('user_roles.id'), nullable=False)
    user_permission_id = Column(String(36), ForeignKey('user_permissions.id'), nullable=False)

    # 关联关系
    user_role = relationship("UserRole", back_populates="user_role_permissions")
    user_permission = relationship("UserPermission", back_populates="user_role_permissions")

    def __repr__(self):
        return f'<UserRolePermission user_role_id={self.user_role_id} user_permission_id={self.user_permission_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'user_role_id': self.user_role_id,
            'user_permission_id': self.user_permission_id,
            'user_permission': self.user_permission.to_dict() if self.user_permission else None
        }

# 用户权限常量定义
class UserPermissionConstants:
    """用户权限常量 - 与 seed_data_user_role_permission.json 和前端 permissions.ts 保持一致"""

    # 菜单权限
    MENU_ACTION_TASKS = 'menu:action-tasks'
    MENU_AGENTS = 'menu:agents'
    MENU_ACTION_SPACES = 'menu:action-spaces'
    MENU_SETTINGS = 'menu:settings'
    MENU_SETTINGS_ADMIN = 'menu:settings-admin'
    MENU_SETTINGS_GENERAL = 'menu:settings-general'
    MENU_SETTINGS_MODEL = 'menu:settings-model'
    MENU_SETTINGS_USERS = 'menu:settings-users'
    MENU_SETTINGS_MCP = 'menu:settings-mcp'
    MENU_SETTINGS_GRAPH = 'menu:settings-graph'
    MENU_SETTINGS_LOGS = 'menu:settings-logs'
    MENU_SETTINGS_ABOUT = 'menu:settings-about'
    MENU_USERS = 'menu:users'
    MENU_LOGS = 'menu:logs'

    # 任务权限
    TASK_VIEW_ALL = 'task:view-all'
    TASK_VIEW_OWN = 'task:view-own'
    TASK_CREATE = 'task:create'
    TASK_EDIT = 'task:edit'
    TASK_DELETE = 'task:delete'
    TASK_ASSIGN = 'task:assign'

    # 用户权限
    USER_VIEW = 'user:view'
    USER_CREATE = 'user:create'
    USER_EDIT = 'user:edit'
    USER_DELETE = 'user:delete'
    USER_MANAGE = 'user:manage'

    # 智能体权限
    AGENT_VIEW = 'agent:view'
    AGENT_CREATE = 'agent:create'
    AGENT_EDIT = 'agent:edit'
    AGENT_DELETE = 'agent:delete'
    AGENT_MANAGE = 'agent:manage'

    # 行动空间权限
    SPACE_VIEW = 'space:view'
    SPACE_CREATE = 'space:create'
    SPACE_EDIT = 'space:edit'
    SPACE_DELETE = 'space:delete'
    SPACE_MANAGE = 'space:manage'

    # 系统设置权限
    SETTINGS_VIEW = 'settings:view'
    SETTINGS_EDIT = 'settings:edit'
    SETTINGS_MANAGE = 'settings:manage'

# 默认用户角色定义 - 简化为三种核心角色
class DefaultUserRoles:
    """默认用户角色定义 - 遵循KISS原则，只保留三种核心角色"""

    SUPER_ADMIN = {
        'name': 'super_admin',
        'display_name': '超级管理员',
        'description': '拥有系统所有权限的超级管理员',
        'is_system': True
    }

    REGULAR_USER = {
        'name': 'regular_user',
        'display_name': '普通用户',
        'description': '普通用户，可以创建和管理自己的任务',
        'is_system': True
    }

    VIEWER = {
        'name': 'viewer',
        'display_name': '只读用户',
        'description': '只读用户，只能查看相关信息，不能进行修改操作',
        'is_system': True
    }


class ParallelExperiment(BaseMixin, db.Model):
    """并行实验模型
    
    设计原则：
    - 统一绑定 ActionSpace（场景模板）
    - is_template 只是标记是否系统预置，不影响数据结构和工作流
    - 每个并行实例创建独立的 ActionTask（变量隔离）
    """
    __tablename__ = 'parallel_experiments'

    name = Column(String(200), nullable=False)
    description = Column(LONGTEXT)
    
    # 统一绑定 ActionSpace（场景模板）
    source_action_space_id = Column(String(36), ForeignKey('action_spaces.id'), nullable=False)
    
    config = Column(JSON, nullable=False)  # 完整的实验配置
    status = Column(String(20), default='created')  # template/created/running/paused/completed/failed
    
    # 模板标识
    is_template = Column(Boolean, default=False)  # 是否为系统预置模板
    
    # 当前轮次号（每次重新执行 +1）
    current_iteration = Column(Integer, default=0)
    
    # 关联的克隆 ActionTask IDs，按轮次存储: {1: [task_ids...], 2: [task_ids...]}
    cloned_action_task_ids = Column(JSON, default=dict)
    
    total_runs = Column(Integer, default=0)
    completed_runs = Column(Integer, default=0)
    failed_runs = Column(Integer, default=0)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    results_summary = Column(JSON)  # 实验结果汇总，按轮次存储: {1: {...}, 2: {...}}
    
    # 延迟创建：待创建的参数组合队列，按轮次存储: {1: [{param1: val1, ...}, ...], 2: [...]}
    # 当任务数量很大时（如1000个），只预创建 max_concurrent*2 个任务，其余存在这里按需创建
    pending_combinations = Column(JSON, default=dict)

    # 关联关系
    source_action_space = relationship("ActionSpace")

    def __repr__(self):
        return f'<ParallelExperiment {self.name}>'
    
    def to_dict(self, include_runs=False):
        """转换为字典格式"""
        # 获取当前轮次的任务ID列表
        current_task_ids = []
        if self.cloned_action_task_ids and self.current_iteration:
            current_task_ids = self.cloned_action_task_ids.get(str(self.current_iteration), [])
        
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'source_action_space_id': self.source_action_space_id,
            'source_action_space_name': self.source_action_space.name if self.source_action_space else None,
            'config': self.config,
            'status': self.status,
            'is_template': self.is_template,
            'current_iteration': self.current_iteration or 0,
            'total_runs': self.total_runs,
            'completed_runs': self.completed_runs,
            'failed_runs': self.failed_runs,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'results_summary': self.results_summary.get(str(self.current_iteration)) if self.results_summary and self.current_iteration else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        # 待创建任务数（延迟创建模式）
        pending_count = 0
        if self.pending_combinations and self.current_iteration:
            pending_list = self.pending_combinations.get(str(self.current_iteration), [])
            pending_count = len(pending_list) if isinstance(pending_list, list) else 0
        data['pending_task_count'] = pending_count
        
        if include_runs:
            data['cloned_action_task_ids'] = current_task_ids
            data['all_iterations'] = list(self.cloned_action_task_ids.keys()) if self.cloned_action_task_ids else []
        
        return data


class ExperimentStep(BaseMixin, db.Model):
    """实验步骤记录 - 记录每轮对话结束后的变量快照"""
    __tablename__ = 'experiment_steps'
    
    experiment_id = Column(String(36), ForeignKey('parallel_experiments.id', ondelete='CASCADE'), nullable=False)
    action_task_id = Column(String(36), ForeignKey('action_tasks.id', ondelete='CASCADE'), nullable=False)
    conversation_id = Column(String(36), ForeignKey('conversations.id', ondelete='CASCADE'))
    step_number = Column(Integer, nullable=False)  # 轮数: 1, 2, 3...
    variables_snapshot = Column(JSON)  # 变量快照: {"satisfaction": 0.5, "temperature": 0.7}
    
    # 索引
    __table_args__ = (
        Index('idx_experiment_step', 'experiment_id', 'action_task_id', 'step_number'),
    )
    
    def __repr__(self):
        return f'<ExperimentStep {self.experiment_id}:{self.action_task_id}:step{self.step_number}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'experiment_id': self.experiment_id,
            'action_task_id': self.action_task_id,
            'conversation_id': self.conversation_id,
            'step_number': self.step_number,
            'variables_snapshot': self.variables_snapshot,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class PublishedTask(BaseMixin, db.Model):
    """发布的任务配置"""
    __tablename__ = 'published_tasks'

    # 基本信息
    action_task_id = Column(String(36), ForeignKey('action_tasks.id'), nullable=False)
    share_token = Column(String(64), unique=True, nullable=False, index=True)  # 分享令牌

    # 发布配置
    title = Column(String(200))  # 自定义标题（可选，默认使用任务标题）
    description = Column(LONGTEXT)   # 自定义描述

    # 访问控制
    access_type = Column(String(20), default='public')  # public/private/password
    access_password = Column(String(128))  # 密码保护（加密存储）
    allowed_domains = Column(JSON)  # 允许嵌入的域名白名单

    # 功能配置
    mode = Column(String(20), default='readonly')  # readonly/interactive (交互模式自动允许发送消息)
    show_messages = Column(Boolean, default=True)  # 是否显示消息历史

    # 样式配置
    theme = Column(JSON)  # 自定义主题配置
    branding = Column(JSON)  # 品牌配置（logo、标题等）

    # 统计信息
    view_count = Column(Integer, default=0)  # 访问次数
    last_viewed_at = Column(DateTime)  # 最后访问时间

    # 状态
    is_active = Column(Boolean, default=True)  # 是否启用
    expires_at = Column(DateTime)  # 过期时间（可选）

    # 多租户
    user_id = Column(String(36), ForeignKey('users.id'))  # 发布者

    # 关联关系
    action_task = relationship("ActionTask", back_populates="published_versions")
    user = relationship("User")

    def __repr__(self):
        return f'<PublishedTask {self.share_token}>'

    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'action_task_id': self.action_task_id,
            'share_token': self.share_token,
            'title': self.title,
            'description': self.description,
            'access_type': self.access_type,
            'mode': self.mode,
            'show_messages': self.show_messages,
            'theme': self.theme,
            'branding': self.branding,
            'view_count': self.view_count,
            'last_viewed_at': self.last_viewed_at.isoformat() if self.last_viewed_at else None,
            'is_active': self.is_active,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class ChunkConfig(BaseMixin, db.Model):
    """知识库分段配置模型"""
    __tablename__ = 'chunk_configs'
    
    knowledge_id = Column(String(36), ForeignKey('knowledges.id', ondelete='CASCADE'), 
                         unique=True, nullable=False, index=True)
    method = Column(String(50), nullable=False, default='recursive', index=True)
    config = Column(JSON, nullable=False)
    
    knowledge = relationship("Knowledge", backref="chunk_config")
    
    def __repr__(self):
        return f'<ChunkConfig {self.knowledge_id}:{self.method}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'knowledge_id': self.knowledge_id,
            'method': self.method,
            'config': self.config,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Job(BaseMixin, db.Model):
    """后台任务表（JSON化设计）"""
    __tablename__ = 'jobs'
    
    # 必须的索引字段（用于查询）
    job_type = Column(String(50), nullable=False, index=True)  # 后台任务类型：kb:vectorize_file
    status = Column(String(20), nullable=False, default='pending', index=True)  # pending|running|completed|failed|cancelled
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    
    # JSON 数据字段（包含所有其他信息）
    data = Column(JSON, nullable=False, default=dict)
    
    # 关系
    user = relationship("User", backref="jobs")
    
    # 索引
    __table_args__ = (
        Index('idx_job_user_status', 'user_id', 'status'),
        Index('idx_job_type_status', 'job_type', 'status'),
        Index('idx_job_created_at', 'created_at'),
    )
    
    def __repr__(self):
        return f'<Job {self.id}:{self.job_type}:{self.status}>'
    
    def to_dict(self):
        """转换为字典"""
        result = {
            'job_id': self.id,
            'job_type': self.job_type,
            'status': self.status,
            'user_id': self.user_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        # 合并 data 字段
        if self.data:
            result.update(self.data)
        return result
    
    @property
    def progress(self):
        """便捷属性：进度"""
        return self.data.get('progress', 0) if self.data else 0
    
    @property
    def message(self):
        """便捷属性：消息"""
        return self.data.get('message', '') if self.data else ''
    
    @property
    def params(self):
        """便捷属性：参数"""
        return self.data.get('params', {}) if self.data else {}
    
    @property
    def result(self):
        """便捷属性：结果"""
        return self.data.get('result') if self.data else None
    
    @property
    def error(self):
        """便捷属性：错误"""
        return self.data.get('error') if self.data else None


# ==================== 订阅计划相关模型 ====================

class SubscriptionPlan(BaseMixin, db.Model):
    """订阅计划定义"""
    __tablename__ = 'subscription_plans'
    
    name = Column(String(50), unique=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    description = Column(LONGTEXT)
    badge_color = Column(String(20), default='#666666')
    
    price_monthly = Column(Float, default=0)
    price_yearly = Column(Float, default=0)
    currency = Column(String(10), default='CNY')
    
    limits = Column(JSON, default=dict)
    features = Column(JSON, default=dict)
    
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    is_public = Column(Boolean, default=True)  # 是否公开，非公开计划仅管理员可分配
    
    def __repr__(self):
        return f'<SubscriptionPlan {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'display_name': self.display_name,
            'description': self.description,
            'badge_color': self.badge_color,
            'price_monthly': self.price_monthly,
            'price_yearly': self.price_yearly,
            'currency': self.currency,
            'limits': self.limits or {},
            'features': self.features or {},
            'sort_order': self.sort_order,
            'is_active': self.is_active,
            'is_default': self.is_default,
            'is_public': self.is_public,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class UserSubscription(BaseMixin, db.Model):
    """用户订阅记录"""
    __tablename__ = 'user_subscriptions'
    
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    plan_id = Column(String(36), ForeignKey('subscription_plans.id'), nullable=False)
    
    status = Column(String(20), default='active')
    is_current = Column(Boolean, default=True)
    billing_cycle = Column(String(20), default='monthly')
    
    started_at = Column(DateTime, default=get_current_time_with_timezone)
    expires_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    
    order_id = Column(String(100))
    amount_paid = Column(Float)
    
    source = Column(String(20), default='system_default')
    created_by = Column(String(36))
    notes = Column(LONGTEXT)
    
    plan = relationship('SubscriptionPlan')
    user = relationship('User', backref='subscriptions')
    
    __table_args__ = (
        Index('ix_user_subscription_current', 'user_id', 'is_current'),
    )
    
    def __repr__(self):
        return f'<UserSubscription {self.user_id}:{self.plan_id}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'plan_id': self.plan_id,
            'plan': self.plan.to_dict() if self.plan else None,
            'status': self.status,
            'is_current': self.is_current,
            'billing_cycle': self.billing_cycle,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'cancelled_at': self.cancelled_at.isoformat() if self.cancelled_at else None,
            'source': self.source,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class UsageRecord(BaseMixin, db.Model):
    """用量统计记录"""
    __tablename__ = 'usage_records'
    
    scope = Column(String(20), nullable=False)
    scope_id = Column(String(36), nullable=False)
    period = Column(String(10), nullable=False)
    period_type = Column(String(10), default='monthly')
    resource_type = Column(String(50), nullable=False)
    usage_count = Column(Integer, default=0)
    
    __table_args__ = (
        UniqueConstraint('scope', 'scope_id', 'period', 'resource_type', name='uq_usage_record'),
        Index('ix_usage_scope_period', 'scope', 'scope_id', 'period'),
    )
    
    def __repr__(self):
        return f'<UsageRecord {self.scope}:{self.scope_id}:{self.resource_type}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'scope': self.scope,
            'scope_id': self.scope_id,
            'period': self.period,
            'period_type': self.period_type,
            'resource_type': self.resource_type,
            'usage_count': self.usage_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class StripeConfig(BaseMixin, db.Model):
    """Stripe 支付配置 - 全局单例"""
    __tablename__ = 'stripe_config'
    
    enabled = Column(Boolean, default=False)
    mode = Column(String(10), default='test')  # test, live
    publishable_key = Column(String(255))
    secret_key_encrypted = Column(LONGTEXT)
    webhook_secret_encrypted = Column(LONGTEXT)
    webhook_url = Column(String(500))  # 自定义 Webhook URL
    
    def __repr__(self):
        return f'<StripeConfig {self.mode}>'
    
    def to_dict(self, mask_secrets=True):
        result = {
            'id': self.id,
            'enabled': self.enabled,
            'mode': self.mode,
            'publishable_key': self.publishable_key,
            'webhook_url': self.webhook_url,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        if mask_secrets:
            # 脱敏显示
            if self.secret_key_encrypted:
                result['secret_key'] = self._mask_key(self.secret_key_encrypted)
            else:
                result['secret_key'] = None
            if self.webhook_secret_encrypted:
                result['webhook_secret'] = self._mask_key(self.webhook_secret_encrypted)
            else:
                result['webhook_secret'] = None
        else:
            # 返回完整密钥
            result['secret_key'] = self.secret_key_encrypted
            result['webhook_secret'] = self.webhook_secret_encrypted
        return result
    
    def _mask_key(self, key):
        """脱敏密钥，显示前缀和后4位"""
        if not key or len(key) < 10:
            return '****'
        prefix = key[:7] if key.startswith(('sk_', 'pk_', 'whsec_')) else key[:4]
        return f"{prefix}****{key[-4:]}"


class PaymentRecord(BaseMixin, db.Model):
    """支付记录表"""
    __tablename__ = 'payment_records'
    
    user_id = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'))
    type = Column(String(20), nullable=False)  # subscription, upgrade, renewal, refund
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default='CNY')
    status = Column(String(20), default='pending')  # pending, succeeded, failed, refunded
    
    stripe_payment_intent_id = Column(String(100))
    stripe_charge_id = Column(String(100))
    stripe_invoice_id = Column(String(100))
    stripe_checkout_session_id = Column(String(100))  # Checkout Session ID
    
    subscription_id = Column(String(36), ForeignKey('user_subscriptions.id', ondelete='SET NULL'))
    plan_id = Column(String(36), ForeignKey('subscription_plans.id', ondelete='SET NULL'))
    
    metadata_json = Column(JSON, default=dict)
    failure_reason = Column(LONGTEXT)
    
    user = relationship('User')
    plan = relationship('SubscriptionPlan')
    subscription = relationship('UserSubscription')
    
    __table_args__ = (
        Index('ix_payment_user_created', 'user_id', 'created_at'),
        Index('ix_payment_status', 'status'),
    )
    
    def __repr__(self):
        return f'<PaymentRecord {self.id}:{self.type}:{self.status}>'
    
    def to_dict(self, include_user=False):
        result = {
            'id': self.id,
            'user_id': self.user_id,
            'type': self.type,
            'amount': self.amount,
            'currency': self.currency,
            'status': self.status,
            'stripe_payment_intent_id': self.stripe_payment_intent_id,
            'stripe_charge_id': self.stripe_charge_id,
            'plan_id': self.plan_id,
            'plan': self.plan.to_dict() if self.plan else None,
            'failure_reason': self.failure_reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        if include_user and self.user:
            result['user'] = {
                'id': self.user.id,
                'username': self.user.username,
                'email': self.user.email
            }
        return result


class APIKey(BaseMixin, db.Model):
    """OpenAI Export API Key"""
    __tablename__ = 'api_keys'

    name = Column(String(128), nullable=False)
    key_hash = Column(String(256), nullable=False, unique=True)
    key_prefix = Column(String(16), nullable=False)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime, nullable=True)

    user = relationship("User")

    __table_args__ = (
        Index('ix_api_keys_key_hash', 'key_hash'),
        Index('ix_api_keys_user_id', 'user_id'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'key_prefix': self.key_prefix,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_used_at': self.last_used_at.isoformat() if self.last_used_at else None,
        }


class IMBotConfig(BaseMixin, db.Model):
    """IM Bot 配置"""
    __tablename__ = 'im_bot_configs'

    name = Column(String(128), nullable=False)
    platform = Column(String(32), nullable=False)
    credentials = Column(JSON, default=dict)
    agent_id = Column(String(36), ForeignKey('agents.id'), nullable=True)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    config = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    webhook_registered = Column(Boolean, default=False)

    agent = relationship("Agent")
    user = relationship("User")

    __table_args__ = (
        Index('ix_im_bot_configs_user_id', 'user_id'),
        Index('ix_im_bot_configs_platform', 'platform'),
    )

    def to_dict(self, include_credentials=False):
        result = {
            'id': self.id,
            'name': self.name,
            'platform': self.platform,
            'agent_id': self.agent_id,
            'agent_name': self.agent.name if self.agent else None,
            'user_id': self.user_id,
            'config': self.config or {},
            'is_active': self.is_active,
            'webhook_registered': self.webhook_registered,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_credentials:
            result['credentials'] = self.credentials or {}
        return result