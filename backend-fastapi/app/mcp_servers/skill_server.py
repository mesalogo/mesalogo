"""
技能 MCP 服务器

提供 4 个工具供 Agent 使用：
- read_skill: 读取完整 SKILL.md
- read_skill_reference: 读取参考资料
- run_skill_script: 执行脚本（黑盒）
- get_skill_asset: 获取资源文件路径
"""
import os
import subprocess
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

SKILLS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "skills")

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
                "skill_name": {"type": "string", "description": "Skill name"},
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
                "skill_name": {"type": "string", "description": "Skill name"},
                "script_path": {"type": "string", "description": "Relative path within scripts/ (e.g. 'analyze_data.py')"},
                "args": {"type": "array", "items": {"type": "string"}, "description": "Command line arguments"},
                "stdin": {"type": "string", "description": "Optional stdin input"}
            },
            "required": ["skill_name", "script_path"]
        }
    },
    {
        "name": "get_skill_asset",
        "description": "Get the absolute file path of an asset from a skill's assets/ directory. Returns the path for use with other tools.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "skill_name": {"type": "string", "description": "Skill name"},
                "file_path": {"type": "string", "description": "Relative path within assets/"}
            },
            "required": ["skill_name", "file_path"]
        }
    }
]


def get_tools() -> List[Dict]:
    return SKILL_TOOLS


def _safe_path(base: str, target: str) -> bool:
    return os.path.realpath(target).startswith(os.path.realpath(base))


def handle_request(request_data: Dict) -> Dict:
    """处理 MCP 工具调用请求"""
    tool_name = request_data.get("name")
    params = request_data.get("input", {})

    handlers = {
        "read_skill": _handle_read_skill,
        "read_skill_reference": _handle_read_skill_reference,
        "run_skill_script": _handle_run_skill_script,
        "get_skill_asset": _handle_get_skill_asset,
    }

    handler = handlers.get(tool_name)
    if not handler:
        return {"error": f"Unknown skill tool: {tool_name}", "is_error": True}

    try:
        return handler(params)
    except Exception as e:
        logger.error(f"Skill tool {tool_name} failed: {e}", exc_info=True)
        return {"error": str(e), "is_error": True}


def _handle_read_skill(params: Dict) -> Dict:
    skill_name = params.get("skill_name", "")

    # 优先检查数据库存储
    try:
        from app.models import Skill
        skill = Skill.query.filter_by(name=skill_name).first()
        if skill and skill.storage_type == 'database' and skill.skill_md_content:
            content = skill.skill_md_content
            # 去掉 frontmatter
            if content.startswith("---"):
                parts = content.split("---", 2)
                if len(parts) >= 3:
                    content = parts[2].strip()
            return {"content": content, "skill_name": skill_name}
    except Exception:
        pass

    # 回退到文件系统
    skill_md_path = os.path.join(SKILLS_DIR, skill_name, "SKILL.md")

    if not _safe_path(SKILLS_DIR, skill_md_path):
        return {"error": "Invalid skill name", "is_error": True}
    if not os.path.exists(skill_md_path):
        return {"error": f"Skill not found: {skill_name}", "is_error": True}

    with open(skill_md_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 去掉 frontmatter，只返回 body
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            content = parts[2].strip()

    return {"content": content, "skill_name": skill_name}


def _handle_read_skill_reference(params: Dict) -> Dict:
    skill_name = params.get("skill_name", "")
    file_path = params.get("file_path", "")
    full_path = os.path.join(SKILLS_DIR, skill_name, "references", file_path)

    if not _safe_path(os.path.join(SKILLS_DIR, skill_name), full_path):
        return {"error": "Invalid file path", "is_error": True}
    if not os.path.exists(full_path):
        return {"error": f"Reference not found: {file_path}", "is_error": True}

    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()

    return {"content": content, "skill_name": skill_name, "file_path": file_path}


def _handle_run_skill_script(params: Dict) -> Dict:
    skill_name = params.get("skill_name", "")
    script_path = params.get("script_path", "")
    args = params.get("args", [])
    stdin_input = params.get("stdin")

    # security_level 检查
    try:
        from app.models import Skill
        skill = Skill.query.filter_by(name=skill_name).first()
        if skill and skill.security_level >= 3:
            return {"error": f"Skill '{skill_name}' has high security level ({skill.security_level}), script execution is blocked", "is_error": True}
    except Exception:
        pass

    full_path = os.path.join(SKILLS_DIR, skill_name, "scripts", script_path)

    if not _safe_path(os.path.join(SKILLS_DIR, skill_name), full_path):
        return {"error": "Invalid script path", "is_error": True}
    if not os.path.exists(full_path):
        return {"error": f"Script not found: {script_path}", "is_error": True}

    # 确定执行器
    cmd = []
    if script_path.endswith(".py"):
        cmd = ["python3", full_path] + args
    elif script_path.endswith(".sh"):
        cmd = ["bash", full_path] + args
    elif script_path.endswith(".js"):
        cmd = ["node", full_path] + args
    else:
        # 尝试直接执行
        cmd = [full_path] + args

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=os.path.join(SKILLS_DIR, skill_name),
            stdin=subprocess.PIPE if stdin_input else None,
            input=stdin_input,
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
            "skill_name": skill_name,
            "script_path": script_path,
        }
    except subprocess.TimeoutExpired:
        return {"error": "Script execution timed out (120s)", "is_error": True}
    except Exception as e:
        return {"error": f"Script execution failed: {str(e)}", "is_error": True}


def _handle_get_skill_asset(params: Dict) -> Dict:
    skill_name = params.get("skill_name", "")
    file_path = params.get("file_path", "")
    full_path = os.path.join(SKILLS_DIR, skill_name, "assets", file_path)

    if not _safe_path(os.path.join(SKILLS_DIR, skill_name), full_path):
        return {"error": "Invalid asset path", "is_error": True}
    if not os.path.exists(full_path):
        return {"error": f"Asset not found: {file_path}", "is_error": True}

    return {"path": os.path.abspath(full_path), "skill_name": skill_name, "file_path": file_path}
