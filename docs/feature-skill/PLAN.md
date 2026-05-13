# Skills 功能集成方案 v2

## 概述

基于 Anthropic 官方 Agent Skills 规范（agentskills.io），为系统增加标准化的技能管理能力。Skills 与现有 Capability 体系并行存在，是一种独立的"上下文增强包"——本质上是给 LLM 的操作手册，包含指令、脚本和参考资料。

### 与现有 Capability 的关系

| 维度 | Capability（现有） | Skill（新增） |
|------|-------------------|--------------|
| 本质 | 工具的声明式关联（桥接 MCP 工具） | LLM 的操作手册（指令 + 脚本 + 参考资料） |
| 内容 | 能力描述 + MCP 工具映射 | SKILL.md + scripts/ + references/ + assets/ |
| 触发 | 始终注入 prompt | 元数据始终注入，body 按需加载 |
| 执行 | Agent 自行决定如何使用工具 | Agent 按 SKILL.md 指令执行，脚本作为黑盒调用 |
| 绑定 | 通过 RoleCapability 绑定到角色 | 通过 RoleSkill 绑定到角色 |

两者并行：Capability 管理"Agent 能用什么工具"，Skill 管理"Agent 遇到特定任务该怎么做"。

## 一、Claude 官方 Skills 设计哲学

### 1.1 核心理念

通过分析 Claude 官方 skills 仓库（docx、pdf、webapp-testing、skill-creator），总结出以下关键设计原则：

**1. Skill 就是给 LLM 的操作手册**
不是代码插件，不是 API 接口。SKILL.md body 是纯粹的指令文本——告诉模型"遇到这类任务该怎么做"。例如 docx skill 就是一份 docx-js 使用指南 + XML 编辑指南。

**2. 触发完全靠 description 字段 + 模型自主判断**
没有关键词匹配引擎，没有 embedding 检索。做法是：
- 启动时把所有 skill 的 name + description 注入 system prompt（约 100 tokens/skill）
- 模型自己判断当前任务是否匹配某个 skill
- 匹配后模型通过工具读取完整 SKILL.md

**3. scripts/ 是黑盒工具，不是被读取的代码**
官方明确说："Always run scripts with `--help` first. DO NOT read the source... They exist to be called directly as black-box scripts."
脚本是给模型执行的，不是给模型读的，节省 context window。

**4. references/ 是按需加载的知识库**
渐进式加载的关键：SKILL.md 只放核心流程，详细参考资料放 references/，模型需要时才读取。

**5. 渐进式加载（Progressive Disclosure）**
三层加载策略：
1. 元数据层（~100 tokens/skill）：name + description，启动时注入
2. 指令层（< 5000 tokens）：SKILL.md body，激活时加载
3. 资源层（按需）：scripts/references/assets/，执行时加载

### 1.2 官方执行流程

```
启动时：注入所有 skill 的 name + description 到 system prompt
         ↓
用户请求 → 模型自主判断是否需要某个 skill
         ↓
激活：模型调用 read_skill 工具读取完整 SKILL.md body
         ↓
执行：模型按 SKILL.md 指令操作
      ├── 调用 run_skill_script 执行脚本（黑盒，不读源码）
      ├── 调用 read_skill_reference 读取参考资料（按需）
      └── 使用其他已有 MCP 工具完成任务
         ↓
脚本输出返回给模型（源码不进入上下文，只有输出进入）
```

## 二、SKILL.md 格式规范

严格遵循官方 Agent Skills 规范，系统扩展字段存数据库。

### 2.1 标准格式（兼容官方）

```yaml
---
name: financial-report
description: >
  处理Excel财务数据，生成标准化图表和报告。当用户需要分析财务Excel数据、
  生成财务图表、创建季度/年度财务报告时使用此技能。
  触发场景：提到"财务报表"、"Excel分析"、"财务图表"、"季度报告"等。
license: MIT
compatibility: Requires pandas, openpyxl, matplotlib
metadata:
  author: system
  version: "1.0"
---

# 财务报表处理

## 概述
本技能用于处理Excel格式的财务数据，自动生成标准化的图表和报告。

## 执行步骤

1. **读取数据**: 使用 filesystem 工具读取用户提供的Excel文件

2. **数据处理**: 执行分析脚本（先运行 --help 查看用法）
   ```
   scripts/analyze_data.py --help
   scripts/analyze_data.py <input_file> --output <output_file>
   ```

3. **生成图表**: 执行图表生成脚本
   ```
   scripts/generate_chart.py <processed_data> --type bar --output chart.png
   ```

4. **输出报告**: 基于分析结果生成文字摘要

## 参考资料
- 详细的数据格式说明见 [references/data-formats.md](references/data-formats.md)
- 图表样式配置见 [references/chart-styles.md](references/chart-styles.md)
```

### 2.2 Frontmatter 字段说明

| 字段 | 必须 | 说明 |
|------|------|------|
| `name` | 是 | kebab-case，最长64字符，必须与目录名一致 |
| `description` | 是 | 最长1024字符，包含功能描述和触发场景（这是唯一的触发机制） |
| `license` | 否 | 许可证 |
| `compatibility` | 否 | 环境要求（依赖包、系统工具等） |
| `metadata` | 否 | 任意 key-value（author、version 等） |
| `allowed-tools` | 否 | 空格分隔的预授权工具列表（实验性） |

**关键原则**：description 是唯一的触发机制，必须写得详细，包含所有触发场景和关键词。不要在 body 中写"何时使用此技能"——body 只在激活后才加载。

### 2.3 目录结构

```
skill-name/
├── SKILL.md              # 必须：元数据 + 指令
├── scripts/              # 可选：可执行脚本（黑盒工具）
├── references/           # 可选：参考文档（按需加载到上下文）
└── assets/               # 可选：静态资源（模板、图片等，不加载到上下文）
```

## 三、数据模型设计

### 3.1 新增 Skill 模型

独立于 Capability，新建 Skill 表：

```python
class Skill(BaseMixin, db.Model):
    __tablename__ = 'skills'
    
    # 基本信息（对应 SKILL.md frontmatter）
    name = Column(String(64), nullable=False, unique=True)  # kebab-case，与目录名一致
    description = Column(String(1024), nullable=False)       # 触发描述
    
    # 系统扩展字段（不写入 SKILL.md）
    display_name = Column(String(100))                       # 显示名称（中文等）
    icon = Column(String(50))
    enabled = Column(Boolean, default=True)
    security_level = Column(Integer, default=1)              # 1=低 2=中 3=高
    
    # 存储配置
    storage_type = Column(String(20), default='filesystem')  # filesystem | database
    skill_md_content = Column(LONGTEXT, nullable=True)       # database 模式下存完整 SKILL.md
    
    # 扩展配置（JSON）
    config = Column(JSON, default=dict)
    # {
    #   "dependencies": {"python": ["pandas"], "system": ["pandoc"]},
    #   "timeout": 120,
    #   "max_context_tokens": 5000
    # }
    
    # 多租户
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    is_shared = Column(Boolean, default=True)
    
    # 关联
    roles = relationship("RoleSkill", back_populates="skill")
    creator = relationship("User", foreign_keys=[created_by])


class RoleSkill(BaseMixin, db.Model):
    __tablename__ = 'role_skills'
    
    role_id = Column(String(36), ForeignKey('roles.id'), nullable=False)
    skill_id = Column(String(36), ForeignKey('skills.id'), nullable=False)
    
    role = relationship("Role", back_populates="skills")
    skill = relationship("Skill", back_populates="roles")
```

### 3.2 为什么不复用 Capability

- Capability 的核心是 `tools` 字段（MCP 工具映射），Skill 不需要
- Capability 没有文件系统存储的概念
- Skill 有独立的渐进式加载逻辑
- 分开后各自职责清晰，不会互相污染
- 绑定关系独立：RoleCapability 管工具权限，RoleSkill 管技能权限

### 3.3 Skill 文件系统

```
backend/skills/
├── financial-report/
│   ├── SKILL.md
│   ├── scripts/
│   │   ├── analyze_data.py
│   │   └── generate_chart.py
│   ├── references/
│   │   ├── data-formats.md
│   │   └── chart-styles.md
│   └── assets/
│       └── report_template.xlsx
│
├── docx/                          # 可直接从 anthropics/skills 导入
│   ├── SKILL.md
│   ├── scripts/
│   │   └── office/
│   └── references/
│
└── pdf/                           # 可直接从 anthropics/skills 导入
    ├── SKILL.md
    ├── scripts/
    └── references/
        ├── REFERENCE.md
        └── FORMS.md
```

## 四、核心模块实现

### 4.1 Skill MCP 服务器（4个工具）

```python
# backend/app/mcp_servers/skill_server.py

SKILL_TOOLS = [
    {
        "name": "read_skill",
        "description": "Read the full SKILL.md content for an activated skill. Use this when you determine a skill is relevant to the current task.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "skill_name": {"type": "string", "description": "Skill name (e.g. 'financial-report')"}
            },
            "required": ["skill_name"]
        }
    },
    {
        "name": "read_skill_reference",
        "description": "Read a reference file from a skill's references/ directory. Use when SKILL.md points you to a reference for more details.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "skill_name": {"type": "string"},
                "file_path": {"type": "string", "description": "Relative path within references/ (e.g. 'data-formats.md')"}
            },
            "required": ["skill_name", "file_path"]
        }
    },
    {
        "name": "run_skill_script",
        "description": "Execute a script from a skill's scripts/ directory. Scripts are black-box tools - run with --help first to see usage, don't read source code.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "skill_name": {"type": "string"},
                "script_path": {"type": "string", "description": "Relative path within scripts/ (e.g. 'analyze_data.py')"},
                "args": {"type": "array", "items": {"type": "string"}, "description": "Command line arguments"},
                "stdin": {"type": "string", "description": "Optional stdin input"}
            },
            "required": ["skill_name", "script_path"]
        }
    },
    {
        "name": "get_skill_asset",
        "description": "Get the file path of an asset from a skill's assets/ directory. Returns the absolute path for use with other tools.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "skill_name": {"type": "string"},
                "file_path": {"type": "string", "description": "Relative path within assets/"}
            },
            "required": ["skill_name", "file_path"]
        }
    }
]
```

工具设计原则：
- `read_skill`：加载完整 SKILL.md body（渐进式加载第2层）
- `read_skill_reference`：按需加载参考资料（渐进式加载第3层）
- `run_skill_script`：黑盒执行脚本，返回 stdout/stderr
- `get_skill_asset`：返回资源文件路径，不加载到上下文

### 4.2 Skill 管理服务

```python
# backend/app/services/skill_service.py

class SkillService:
    """技能管理服务 - 负责 CRUD + 文件系统 + 导入导出"""
    
    def __init__(self):
        self.skills_dir = os.path.join(os.getcwd(), "skills")
    
    def list_skills(self) -> List[Dict]:
        """列出所有技能（合并文件系统和数据库）"""
    
    def get_skill(self, skill_name: str) -> Optional[Dict]:
        """获取技能详情"""
    
    def create_skill(self, data: Dict) -> Dict:
        """创建技能（同时创建文件系统目录和数据库记录）"""
    
    def update_skill(self, skill_name: str, data: Dict) -> Dict:
        """更新技能"""
    
    def delete_skill(self, skill_name: str) -> bool:
        """删除技能"""
    
    def import_skill(self, skill_dir_path: str) -> Dict:
        """从外部导入技能（兼容 anthropics/skills 仓库）
        
        1. 解析 SKILL.md frontmatter
        2. 复制整个目录到 backend/skills/
        3. 创建数据库记录（自动生成默认 config）
        """
    
    def export_skill(self, skill_name: str, output_path: str) -> str:
        """导出技能为标准格式（只输出 SKILL.md + scripts/ + references/ + assets/）"""
    
    def sync_filesystem_to_db(self):
        """扫描文件系统，同步到数据库（启动时调用）"""
    
    def get_skill_metadata_for_prompt(self, role_id: str) -> List[Dict]:
        """获取角色绑定的所有技能的元数据（name + description），用于注入 prompt
        
        Returns: [{"name": "...", "description": "..."}, ...]
        """
```

### 4.3 集成到 prompt_builder.py

在 `build_system_prompt` 中，`<agentCapabilities>` 之后注入可用技能列表：

```python
# prompt_builder.py 新增逻辑

def _build_available_skills_prompt(agent_role) -> str:
    """构建可用技能的 prompt 注入内容"""
    from app.services.skill_service import SkillService
    skill_service = SkillService()
    
    skills_metadata = skill_service.get_skill_metadata_for_prompt(agent_role.id)
    if not skills_metadata:
        return ""
    
    # 使用 XML 格式（官方推荐）
    prompt = "<available_skills>\n"
    prompt += "# Available Skills\n"
    prompt += "The following skills are available to you. When a user's request matches a skill's description, "
    prompt += "use the `read_skill` tool to load the full instructions, then follow them.\n\n"
    
    for skill in skills_metadata:
        prompt += f"""<skill>
<name>{skill['name']}</name>
<description>{skill['description']}</description>
</skill>
"""
    
    prompt += "</available_skills>\n"
    return prompt
```

注入位置：在 `</agentCapabilities>` 之后、`<knowledgeBases>` 之前。

**关键设计决策**：不做后端匹配，让模型自己判断。原因：
1. Claude 官方就是这么做的，经过验证有效
2. 模型对语义理解远超关键词匹配
3. 减少后端复杂度，不需要 SkillMatcher 服务
4. description 写得好就够了，这是 skill-creator 的核心指导原则

### 4.4 注入示例

实际注入到 system prompt 中的内容：

```xml
<available_skills>
# Available Skills
The following skills are available to you. When a user's request matches a skill's description,
use the `read_skill` tool to load the full instructions, then follow them.

<skill>
<name>financial-report</name>
<description>处理Excel财务数据，生成标准化图表和报告。当用户需要分析财务Excel数据、生成财务图表、创建季度/年度财务报告时使用此技能。</description>
</skill>
<skill>
<name>docx</name>
<description>Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files). Triggers include: any mention of "Word doc", ".docx", or requests to produce professional documents with formatting.</description>
</skill>
</available_skills>
```

每个 skill 约 50-100 tokens，10 个 skill 约 500-1000 tokens，对 context window 影响很小。

## 五、API 路由设计

```python
# backend/app/api/routes/skills.py

# 技能 CRUD
GET    /api/skills                              # 列表
POST   /api/skills                              # 创建
GET    /api/skills/<name>                       # 详情
PUT    /api/skills/<name>                       # 更新
DELETE /api/skills/<name>                       # 删除

# SKILL.md 编辑
GET    /api/skills/<name>/content               # 获取 SKILL.md 内容
PUT    /api/skills/<name>/content               # 更新 SKILL.md 内容

# 脚本管理
GET    /api/skills/<name>/scripts               # 列出脚本
GET    /api/skills/<name>/scripts/<path>        # 获取脚本内容
PUT    /api/skills/<name>/scripts/<path>        # 更新脚本
POST   /api/skills/<name>/scripts               # 新建脚本
DELETE /api/skills/<name>/scripts/<path>        # 删除脚本

# 参考资料管理
GET    /api/skills/<name>/references            # 列出参考资料
GET    /api/skills/<name>/references/<path>     # 获取参考资料内容
PUT    /api/skills/<name>/references/<path>     # 更新参考资料

# 资源管理
GET    /api/skills/<name>/assets                # 列出资源
POST   /api/skills/<name>/assets                # 上传资源

# 导入（两步式：预览 → 确认）
POST   /api/skills/import/preview               # 上传 .zip，解析预览（不实际导入）
POST   /api/skills/import/confirm               # 确认导入

# 导出
GET    /api/skills/<name>/export                # 导出技能为 .zip

# 角色绑定
GET    /api/roles/<role_id>/skills              # 获取角色绑定的技能
POST   /api/roles/<role_id>/skills              # 绑定技能到角色
DELETE /api/roles/<role_id>/skills/<skill_id>   # 解绑技能
```

## 六、前端界面

### 6.1 菜单位置

```
角色与能力
├── 角色管理        /roles/management
├── 能力管理        /roles/tools
├── 🆕 技能管理     /roles/skills          ← 新增，与能力管理同级
```

### 6.2 技能列表页

参考 ToolManagement 表格 + MCPServersPage 的 Switch 开关风格：

```
┌──────────────────────────────────────────────────────────────────┐
│  技能管理                                [导入技能]  [创建技能]  │
├──────────────────────────────────────────────────────────────────┤
│  🔍 搜索技能...                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  名称              描述                    版本   状态    操作    │
│  ─────────────────────────────────────────────────────────────── │
│  📊 financial-     处理Excel财务数据，     1.0   [🔘开]  编辑    │
│     report         生成标准化图表...                      删除    │
│                    scripts: 2 | refs: 2                          │
│  ─────────────────────────────────────────────────────────────── │
│  📄 docx           Create, read, edit     1.0   [  关]  编辑    │
│                    Word documents...                      删除    │
│                    scripts: 5 | refs: 3                          │
│  ─────────────────────────────────────────────────────────────── │
│  📑 pdf            Read, extract, merge   1.0   [🔘开]  编辑    │
│                    PDF files...                           删除    │
│                    scripts: 1 | refs: 2                          │
└──────────────────────────────────────────────────────────────────┘
```

- 状态列用 `Switch` 组件（全局开关，关闭后任何角色都无法使用该技能）
- 展开行可查看 scripts 列表和 references 列表（参考 MCPServersPage 展开看工具列表）
- "导入技能"和"创建技能"两个按钮并排

### 6.3 导入技能

点击"导入技能"弹出 Modal，参考 AboutPage 的 `Upload.Dragger` 风格，两步式（预览 → 确认）：

```
┌──────────────────────────────────────────────┐
│  导入技能                               [×]  │
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │                                        │  │
│  │     📦 拖拽 .zip 文件到此处             │  │
│  │        或点击选择文件                   │  │
│  │                                        │  │
│  │  要求：zip 包根目录或一级子目录下      │  │
│  │  必须包含 SKILL.md 文件                │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ── 导入预览（上传后显示）──                  │
│  ┌────────────────────────────────────────┐  │
│  │ 名称: docx                             │  │
│  │ 描述: Create, read, edit Word docs...  │  │
│  │ 文件: SKILL.md, scripts/(5), refs/(3)  │  │
│  │ ⚠ 同名技能已存在，导入将覆盖           │  │
│  └────────────────────────────────────────┘  │
│                                              │
│                    [取消]  [确认导入]         │
└──────────────────────────────────────────────┘
```

导入流程：
1. 用户上传 .zip 文件
2. 调用 `POST /api/skills/import/preview` 解析预览
3. 前端展示预览信息（名称、描述、文件列表、是否有同名冲突）
4. 用户确认后调用 `POST /api/skills/import/confirm` 实际导入
5. 导入成功后刷新列表

后端处理：
```
上传 .zip → 解压到临时目录 → 查找 SKILL.md（根目录或一级子目录）
→ 解析 frontmatter 获取 name + description → 返回预览
→ 用户确认 → 复制到 backend/skills/{name}/ → 创建/更新数据库记录
```

### 6.4 技能编辑页

参考 InternalRoleModal 的 Tabs 风格，使用 Modal 弹窗：

```
┌──────────────────────────────────────────────────────────────┐
│  编辑技能: financial-report                            [×]   │
├──────────────────────────────────────────────────────────────┤
│  [基本信息] [SKILL.md] [脚本] [参考资料] [资源] [角色绑定]   │
│  ════════════════════════════════════════════════════════════ │
│                                                              │
│  ── Tab: 基本信息 ──                                         │
│  显示名称:  [财务报表处理________________]                    │
│  技能名称:  financial-report  (只读，创建后不可改)            │
│  描述:      [处理Excel财务数据，生成标准化图表和报告。       │
│              当用户需要分析财务Excel数据、生成财务图表、      │
│              创建季度/年度财务报告时使用此技能。_____]        │
│  图标:      [📊 ▼]                                           │
│  安全级别:  [低风险 ▼]                                       │
│  启用:      [🔘 开]                                          │
│                                                              │
│  ── Tab: SKILL.md ──                                         │
│  (Monaco Editor - Markdown 模式，编辑完整 SKILL.md)          │
│                                                              │
│  ── Tab: 脚本 ──                                             │
│  脚本列表:                              [+ 新建脚本]         │
│  📄 analyze_data.py              [编辑] [运行] [删除]        │
│  📄 generate_chart.py            [编辑] [运行] [删除]        │
│  点击"编辑"展开 Monaco Editor (Python/JS/Shell 模式)         │
│                                                              │
│  ── Tab: 参考资料 ──                                         │
│  📄 data-formats.md              [编辑] [删除]               │
│  📄 chart-styles.md              [编辑] [删除]               │
│  点击"编辑"展开 Monaco Editor (Markdown 模式)                │
│                                                              │
│  ── Tab: 资源 ──                                             │
│  📄 report_template.xlsx         [下载] [删除]               │
│  [+ 上传资源]                                                │
│                                                              │
│  ── Tab: 角色绑定 ──                                         │
│  (Checkbox 列表，和 ToolManagement 的角色分配一致)           │
│  ☑ 数据分析师                                                │
│  ☐ 项目经理                                                  │
│  ☑ 财务顾问                                                  │
│                                                              │
│                              [取消]  [保存]                   │
└──────────────────────────────────────────────────────────────┘
```

### 6.5 角色编辑中的技能绑定

在 InternalRoleModal 的 Tabs 中新增"技能配置"tab：

```
现有: [角色设置] [能力配置] [知识库]
新增: [角色设置] [能力配置] [知识库] [技能配置]
```

技能配置 tab 内容为 Checkbox 列表（和能力配置交互方式一致）：

```
可用技能:
☑ 📊 financial-report    处理Excel财务数据，生成标准化图表
☐ 📄 docx                Create, read, edit Word documents
☑ 📑 pdf                 Read, extract, merge PDF files
```

### 6.6 开关逻辑

两层控制：
1. **全局开关**（技能列表页 Switch）：控制技能是否在系统中可用。关闭后不注入任何 prompt。
2. **角色绑定**（角色编辑 Checkbox）：控制特定角色是否使用该技能。

只有"全局启用 + 角色绑定"的技能才会注入到该角色的 system prompt 中。
与现有 Capability 体系一致：Capability 有 `default_enabled`，角色通过 RoleCapability 绑定。

## 七、兼容性设计

### 7.1 导入 anthropics/skills 仓库

两种导入方式：

**方式一：前端上传 .zip（推荐）**
从 anthropics/skills 仓库下载某个 skill 文件夹，打成 zip 包，通过前端"导入技能"上传。

**方式二：服务端文件系统**
```bash
# 直接复制目录到 backend/skills/
cp -r anthropics-skills/skills/docx backend/skills/docx
cp -r anthropics-skills/skills/pdf backend/skills/pdf

# 系统启动时自动扫描 backend/skills/ 并同步到数据库
```

导入时自动处理：
1. 解析 SKILL.md frontmatter 获取 name、description
2. 创建数据库记录，生成默认 config
3. 如果 frontmatter 中有 metadata.author/version，存入 config

### 7.2 导出为 .zip

导出时打包为标准 .zip，只包含：
- SKILL.md（只保留官方规范字段）
- scripts/
- references/
- assets/

系统扩展字段（display_name、icon、security_level、config）不写入导出包。
导出的 zip 可以直接在其他系统中通过"导入技能"导入。

## 八、安全考虑

1. **脚本沙箱**：run_skill_script 在受限环境执行，设置 timeout、工作目录限制
2. **路径安全**：所有文件访问做路径遍历检查（realpath 验证）
3. **权限控制**：通过 RoleSkill 控制角色可用技能，security_level 区分风险等级
4. **审计日志**：记录技能激活和脚本执行日志

## 九、实现计划

### 第一阶段：数据层 + 服务层（2天）
- [ ] 新增 Skill、RoleSkill 模型 + 数据库迁移
- [ ] 实现 SkillService（CRUD + 文件系统管理）
- [ ] 创建 backend/skills/ 目录结构

### 第二阶段：MCP + Prompt 集成（2天）
- [ ] 实现 skill_server.py（4个 MCP 工具）
- [ ] 注册到 mcp_config.json
- [ ] 修改 prompt_builder.py 注入 available_skills
- [ ] 修改 message_processor.py 传递 skill 工具

### 第三阶段：API 路由（1天）
- [ ] 实现 skills.py API 路由
- [ ] 实现角色-技能绑定 API
- [ ] 实现导入/导出 API

### 第四阶段：前端界面（3天）
- [ ] 技能列表页
- [ ] 技能编辑页（SKILL.md 编辑器 + 脚本编辑器）
- [ ] 角色设置中的技能绑定
- [ ] 导入/导出功能

### 第五阶段：测试 + 示例（1天）
- [ ] 导入 anthropics/skills 中的 docx、pdf 技能验证兼容性
- [ ] 创建 1-2 个自定义示例技能
- [ ] 端到端测试

## 十、与旧方案的主要差异

| 维度 | 旧方案 | 新方案 |
|------|--------|--------|
| 数据模型 | 复用 Capability（type=skill） | 独立 Skill 表 |
| 触发机制 | SkillMatcher 关键词+语义匹配引擎 | 模型自主判断（prompt 注入 description） |
| 目录结构 | resources/ | references/ + assets/（对齐官方） |
| SKILL.md | 自定义 frontmatter（trigger/permissions/dependencies） | 官方标准 frontmatter |
| Prompt 格式 | Markdown | XML（官方推荐） |
| MCP 工具 | 4个（含 list_skill_scripts） | 4个（read_skill/read_skill_reference/run_skill_script/get_skill_asset） |
| 复杂度 | 高（需要匹配引擎） | 低（让模型自己判断） |
| 兼容性 | 需要适配 | 直接兼容 anthropics/skills 仓库 |
