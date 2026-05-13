"""
SubAgent 服务模块

提供 Agent 主动调用 Agent 的并行协作能力。
SubAgent 通过 MCP 工具调用实现，调用方 Agent 保持控制权，等待结果后继续推理。

模块结构：
- executor.py: SubAgent 执行引擎，处理单个和并行调用
- context_builder.py: SubAgent 上下文构建，组装 system_prompt
- security.py: 安全检查（嵌套深度、循环检测、频率限制）
"""

from .executor import SubAgentExecutor
from .security import SubAgentSecurity

__all__ = ['SubAgentExecutor', 'SubAgentSecurity']
