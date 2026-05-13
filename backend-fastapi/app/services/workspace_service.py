"""
项目空间服务模块

负责处理智能体项目空间的创建、读取和更新
"""
import os
from datetime import datetime
from typing import Dict, List

import logging
logger = logging.getLogger(__name__)

class WorkspaceService:
    """项目空间服务类，处理智能体项目文件的创建和管理"""

    def __init__(self):
        """初始化项目空间服务"""
        # 使用backend目录下的agent-workspace
        # 当前文件: backend/app/services/workspace_service.py
        # backend目录: ../../ (相对于当前文件)
        current_dir = os.path.dirname(os.path.abspath(__file__))  # backend/app/services/
        app_dir = os.path.dirname(current_dir)  # backend/app/
        backend_dir = os.path.dirname(app_dir)  # backend/
        self.workspace_dir = os.path.join(backend_dir, 'agent-workspace')


        # 确保项目空间目录存在
        os.makedirs(self.workspace_dir, exist_ok=True)

    def safe_filename_with_unicode(self, filename):
        """
        生成支持中文的安全文件名
        保留中文字符、英文字母、数字、下划线、连字符和点号
        移除或替换其他可能有害的字符
        """
        if not filename:
            return 'unnamed_file'

        # 移除路径分隔符和其他危险字符
        dangerous_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\0']
        safe_name = filename

        for char in dangerous_chars:
            safe_name = safe_name.replace(char, '_')

        # 移除开头和结尾的空格和点号
        safe_name = safe_name.strip(' .')

        # 如果文件名为空或只包含点号，使用默认名称
        if not safe_name or safe_name == '.' or safe_name == '..':
            safe_name = 'unnamed_file'

        # 限制文件名长度（考虑到文件系统限制，通常为255字节）
        # 对于UTF-8编码，一个中文字符通常占3字节
        max_length = 200  # 保守估计，留出扩展名和时间戳的空间
        if len(safe_name.encode('utf-8')) > max_length:
            # 截断文件名，但保留扩展名
            name, ext = os.path.splitext(safe_name)
            while len(name.encode('utf-8')) + len(ext.encode('utf-8')) > max_length and len(name) > 1:
                name = name[:-1]
            safe_name = name + ext

        return safe_name

    def render_template(self, template_content: str, variables: Dict) -> str:
        """
        渲染模板，替换占位符
        
        支持的占位符格式：
        - {{variable_name}} - 简单变量替换
        - {{#list_name}}...{{/list_name}} - 列表循环
        
        Args:
            template_content: 模板内容
            variables: 变量字典
            
        Returns:
            str: 渲染后的内容
        """
        import re
        
        result = template_content
        
        # 处理列表循环 {{#agent_list}}...{{/agent_list}}
        list_pattern = r'\{\{#(\w+)\}\}(.*?)\{\{/\1\}\}'
        
        def replace_list(match):
            list_name = match.group(1)
            list_template = match.group(2)
            
            if list_name not in variables:
                return ''
            
            list_data = variables[list_name]
            if not isinstance(list_data, list):
                return ''
            
            result_parts = []
            for item in list_data:
                # 对每个列表项渲染模板
                item_content = list_template
                if isinstance(item, dict):
                    for key, value in item.items():
                        item_content = item_content.replace(f'{{{{{key}}}}}', str(value))
                result_parts.append(item_content)
            
            return ''.join(result_parts)
        
        # 替换列表循环
        result = re.sub(list_pattern, replace_list, result, flags=re.DOTALL)
        
        # 处理简单变量 {{variable_name}}
        for key, value in variables.items():
            if not isinstance(value, list):  # 跳过列表变量（已经处理过了）
                result = result.replace(f'{{{{{key}}}}}', str(value))
        
        return result

    def get_default_template(self, file_type: str) -> str:
        """
        获取指定类型的默认模板
        
        Args:
            file_type: 文件类型 (ProjectIndex, ProjectSummary, AgentWorkspace)
            
        Returns:
            str: 模板内容，如果没有找到则返回None
        """
        try:
            from app.models import WorkspaceTemplate
            
            # 获取所有活动的模板，然后在 Python 中过滤
            templates = WorkspaceTemplate.query.filter_by(is_active=True).all()
            
            for template in templates:
                if template.settings:
                    # 检查是否是默认模板且文件类型匹配
                    is_default = template.settings.get('is_default', False)
                    template_file_type = template.settings.get('file_type', '')
                    
                    if is_default and template_file_type == file_type:
                        return template.content
            
            return None
            
        except Exception as e:
            logger.error(f"获取默认模板失败: {str(e)}")
            return None

    def initialize_workspace_for_action_task(self, task_id: int, agent_ids: List[int], task_title: str = None, agent_info: List[Dict] = None) -> bool:
        """
        为新创建的行动任务初始化项目空间文件结构

        Args:
            task_id: 行动任务ID
            agent_ids: 参与该任务的智能体ID列表
            task_title: 行动任务标题（可选）
            agent_info: 智能体信息列表，每个元素是包含id、name、role_name等字段的字典（可选）

        Returns:
            bool: 初始化是否成功
        """
        try:
            # 获取全局设置：是否创建智能体独立工作空间
            from app.models import SystemSetting
            create_agent_workspace = SystemSetting.get('create_agent_workspace', False)
            
            # 创建行动任务目录（项目共享工作目录）
            task_dir = os.path.join(self.workspace_dir, f'ActionTask-{task_id}')

            # 如果目录已存在，先删除它
            if os.path.exists(task_dir):
                import shutil
                shutil.rmtree(task_dir)
                logger.info(f"已删除现有的行动任务 {task_id} 项目共享工作目录")

            # 创建新的目录
            os.makedirs(task_dir, exist_ok=True)

            # 获取任务标题，如果没有提供则使用默认值
            task_title_display = task_title if task_title else f"任务 {task_id}"

            # 创建项目索引文件
            index_path = os.path.join(task_dir, 'ProjectIndex.md')
            self._create_workspace_index_file(index_path, task_id, agent_ids, task_title_display, agent_info, create_agent_workspace)

            # 创建项目总结文件
            summary_path = os.path.join(task_dir, 'ProjectSummary.md')
            self._create_project_summary_file(summary_path, task_id, task_title_display, agent_info)

            # 根据全局设置决定是否创建智能体独立工作空间
            if create_agent_workspace:
                # 为每个智能体创建工作目录和个人工作空间说明文件
                for i, agent_id in enumerate(agent_ids):
                    # 获取智能体信息
                    agent_name = None
                    agent_role = None
                    if agent_info and i < len(agent_info):
                        agent_name = agent_info[i].get('name')
                        agent_role = agent_info[i].get('role_name')

                    # 如果没有提供智能体信息，使用默认值
                    agent_display = f"{agent_name}[{agent_role}][ID: {agent_id}]" if agent_name and agent_role else f"智能体 {agent_id}"

                    # 创建智能体工作目录
                    agent_dir = os.path.join(task_dir, f'Agent-{agent_id}')
                    os.makedirs(agent_dir, exist_ok=True)

                    # 创建智能体个人工作空间说明文件
                    agent_workspace_path = os.path.join(agent_dir, 'AgentWorkspace.md')
                    self._create_agent_workspace_file(agent_workspace_path, task_id, agent_id, task_title_display, agent_display)
                logger.info(f"已成功为行动任务 {task_id} 初始化项目空间文件结构（包含智能体独立工作空间）")
            else:
                logger.info(f"已成功为行动任务 {task_id} 初始化项目空间文件结构（未创建智能体独立工作空间）")

            return True

        except Exception as e:
            logger.info(f"为行动任务 {task_id} 初始化项目空间文件结构时出错: {str(e)}")
            return False



    def _create_workspace_index_file(self, file_path: str, task_id: int, agent_ids: List[int], task_title: str, agent_info: List[Dict] = None, create_agent_workspace: bool = True) -> None:
        """创建项目索引文件
        
        Args:
            file_path: 文件路径
            task_id: 任务ID
            agent_ids: 智能体ID列表
            task_title: 任务标题
            agent_info: 智能体信息列表
            create_agent_workspace: 是否创建智能体个人工作空间
        """
        if not os.path.exists(file_path):
            # 尝试从模板创建
            template_content = self.get_default_template('ProjectIndex')
            logger.debug(f"[DEBUG] ProjectIndex 模板查询结果: {'找到模板' if template_content else '未找到模板'}")
            
            if template_content:
                # 构建智能体列表数据
                agent_list = []
                # 只有在开启个人工作空间时才添加智能体列表
                if create_agent_workspace:
                    for i, agent_id in enumerate(agent_ids):
                        agent_name = None
                        agent_role = None
                        if agent_info and i < len(agent_info):
                            agent_name = agent_info[i].get('name')
                            agent_role = agent_info[i].get('role_name')
                        
                        agent_display = f"{agent_name}[{agent_role}]" if agent_name and agent_role else f"智能体 {agent_id}"
                        agent_list.append({
                            'agent_id': agent_id,
                            'agent_name': agent_name or f'智能体 {agent_id}',
                            'agent_role': agent_role or '未知角色',
                            'agent_display': agent_display
                        })
                
                # 渲染模板
                variables = {
                    'task_id': task_id,
                    'task_title': task_title,
                    'agent_list': agent_list
                }
                content = self.render_template(template_content, variables)
            else:
                # 使用硬编码的默认内容（向后兼容）
                content = f"""# {task_title} 项目索引

## 工作目录结构说明
- 项目共享工作目录: `ActionTask-{task_id}/`
- 项目总结文件: `ActionTask-{task_id}/ProjectSummary.md`
"""
                # 只有在开启个人工作空间时才添加智能体工作目录章节
                if create_agent_workspace:
                    content += "\n## 智能体工作目录\n"
                    for i, agent_id in enumerate(agent_ids):
                        agent_name = None
                        agent_role = None
                        if agent_info and i < len(agent_info):
                            agent_name = agent_info[i].get('name')
                            agent_role = agent_info[i].get('role_name')
                        
                        agent_display = f"{agent_name}[{agent_role}]" if agent_name and agent_role else f"智能体 {agent_id}"
                        content += f"- {agent_display}[ID: {agent_id}] 工作目录: `ActionTask-{task_id}/Agent-{agent_id}/`\n"
                        content += f"  - 个人工作空间说明: `ActionTask-{task_id}/Agent-{agent_id}/AgentWorkspace.md`\n"

            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)

    def _create_project_summary_file(self, file_path: str, task_id: int, task_title: str, agent_info: List[Dict] = None) -> None:
        """创建项目总结文件"""
        if not os.path.exists(file_path):
            # 尝试从模板创建
            template_content = self.get_default_template('ProjectSummary')
            logger.debug(f"[DEBUG] ProjectSummary 模板查询结果: {'找到模板' if template_content else '未找到模板'}")
            
            if template_content:
                # 构建智能体列表数据
                agent_list = []
                if agent_info and len(agent_info) > 0:
                    for i, agent in enumerate(agent_info):
                        agent_name = agent.get('name', f'智能体{i+1}')
                        agent_role = agent.get('role_name', '未知角色')
                        agent_id = agent.get('id', f'{i+1}')
                        agent_list.append({
                            'agent_id': agent_id,
                            'agent_name': agent_name,
                            'agent_role': agent_role
                        })
                
                # 渲染模板
                variables = {
                    'task_id': task_id,
                    'task_title': task_title,
                    'create_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'agent_list': agent_list
                }
                content = self.render_template(template_content, variables)
            else:
                # 使用硬编码的默认内容（向后兼容）
                agents_section = ""
                if agent_info and len(agent_info) > 0:
                    for i, agent in enumerate(agent_info):
                        agent_name = agent.get('name', f'智能体{i+1}')
                        agent_role = agent.get('role_name', '未知角色')
                        agent_id = agent.get('id', f'{i+1}')
                        agents_section += f"- {agent_name}[{agent_role}][ID: {agent_id}]\n"
                else:
                    agents_section = "- 暂无智能体信息\n"

                content = f"""# {task_title} 项目总结

行动任务"{task_title}"[ID: {task_id}]的项目总结记录。
创建时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
任务状态: 进行中

### 参与智能体
{agents_section}

## 项目记录
智能体可在此记录项目目标、执行过程、结果总结和后续行动。

"""
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)

    def _create_agent_workspace_file(self, file_path: str, task_id: int, agent_id: int, task_title: str, agent_display: str) -> None:
        """创建智能体个人工作空间说明文件"""
        if not os.path.exists(file_path):
            # 尝试从模板创建
            template_content = self.get_default_template('AgentWorkspace')
            logger.debug(f"[DEBUG] AgentWorkspace 模板查询结果: {'找到模板' if template_content else '未找到模板'}")
            
            if template_content:
                # 渲染模板
                variables = {
                    'task_id': task_id,
                    'task_title': task_title,
                    'agent_id': agent_id,
                    'agent_display': agent_display,
                    'create_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
                content = self.render_template(template_content, variables)
            else:
                # 使用硬编码的默认内容（向后兼容）
                content = f"""# {agent_display} 个人工作空间说明

## 工作目录说明
这是{agent_display}在行动任务"{task_title}"[ID: {task_id}]中的个人工作目录。

## 目录结构
- 工作目录: `ActionTask-{task_id}/Agent-{agent_id}/`
- 个人工作空间说明: `ActionTask-{task_id}/Agent-{agent_id}/AgentWorkspace.md`（本文件）
- 项目共享工作目录: `ActionTask-{task_id}/`

## 使用说明
- 智能体可以在个人工作目录 `Agent-{agent_id}/` 下创建任何文件和文件夹
- 项目共享工作目录 `ActionTask-{task_id}/` 可供所有智能体共享使用
- 本文件用于记录个人工作空间的使用说明和工作记录

## 重要信息
- 创建时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 工作记录与经验

"""
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)



    def get_workspace_files_for_task(self, task_id: int) -> Dict[str, List[Dict]]:
        """
        获取指定任务的所有项目文件信息，包括所有子目录中的文件

        Args:
            task_id: 行动任务ID

        Returns:
            Dict: 包含项目共享文件和智能体工作文件的字典
        """
        try:
            task_dir = os.path.join(self.workspace_dir, f'ActionTask-{task_id}')

            if not os.path.exists(task_dir):
                return {'shared_files': [], 'agent_workspaces': []}

            shared_files = []
            agent_workspaces = []

            # 递归扫描任务目录下的所有文件
            def scan_directory(directory, relative_base=''):
                """递归扫描目录获取所有项目文件"""
                try:
                    for item in os.listdir(directory):
                        item_path = os.path.join(directory, item)
                        relative_path = os.path.join(relative_base, item) if relative_base else item

                        if os.path.isfile(item_path) and item.endswith('.md'):
                            # 获取文件信息
                            stat = os.stat(item_path)
                            file_info = {
                                'title': self._extract_title_from_file(item_path) or item.replace('.md', ''),
                                'file_path': f'ActionTask-{task_id}/{relative_path}',
                                'created_at': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                                'updated_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                                'size': stat.st_size
                            }

                            # 根据文件位置和名称判断类型
                            if relative_base == '':
                                # 根目录下的文件视为项目共享文件
                                file_info['type'] = 'shared'
                                shared_files.append(file_info)
                            elif relative_base.startswith('Agent-'):
                                # Agent目录下的文件视为智能体工作文件
                                agent_id_str = relative_base.replace('Agent-', '')
                                try:
                                    agent_id = int(agent_id_str)
                                    file_info['type'] = 'agent'
                                    file_info['agent_id'] = agent_id
                                    file_info['agent_name'] = f'智能体 {agent_id}'
                                    agent_workspaces.append(file_info)
                                except ValueError:
                                    # 如果agent_id不是数字，仍然作为智能体工作文件处理
                                    file_info['type'] = 'agent'
                                    file_info['agent_name'] = agent_id_str
                                    agent_workspaces.append(file_info)
                            else:
                                # 其他子目录下的文件也视为项目共享文件
                                file_info['type'] = 'shared'
                                file_info['subfolder'] = relative_base
                                shared_files.append(file_info)

                        elif os.path.isdir(item_path):
                            # 递归扫描子目录
                            scan_directory(item_path, relative_path)

                except Exception as e:
                    logger.info(f"扫描目录 {directory} 时出错: {str(e)}")

            # 开始扫描任务目录
            scan_directory(task_dir)

            return {
                'shared_files': shared_files,
                'agent_workspaces': agent_workspaces
            }

        except Exception as e:
            logger.error(f"获取任务 {task_id} 项目文件失败: {str(e)}")
            return {'shared_files': [], 'agent_workspaces': []}

    def _extract_title_from_file(self, file_path: str) -> str:
        """
        从文件中提取标题（第一行的# 标题）

        Args:
            file_path: 文件路径

        Returns:
            str: 提取的标题，如果没有则返回None
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                first_line = f.readline().strip()
                if first_line.startswith('# '):
                    return first_line[2:].strip()
        except Exception:
            pass
        return None

    def get_workspace_file_content(self, file_path: str) -> str:
        """
        获取项目文件内容（仅支持文本文件）

        Args:
            file_path: 相对于workspace_dir的文件路径

        Returns:
            str: 文件内容
        """
        try:
            full_path = os.path.join(self.workspace_dir, file_path)

            if not os.path.exists(full_path):
                raise FileNotFoundError(f"项目文件不存在: {file_path}")

            # 检查文件扩展名，判断是否为文本文件
            _, ext = os.path.splitext(file_path.lower())
            text_extensions = {'.txt', '.md', '.json', '.xml', '.html', '.htm', '.css', '.js', '.py', '.java', '.cpp', '.c', '.h', '.php', '.rb', '.go', '.rs', '.sql', '.yaml', '.yml', '.csv', '.log', '.conf', '.ini', '.sh', '.bat'}

            if ext not in text_extensions:
                raise ValueError(f"文件类型 {ext} 不支持文本预览，请使用下载功能")

            with open(full_path, 'r', encoding='utf-8') as f:
                return f.read()

        except UnicodeDecodeError:
            raise ValueError(f"文件编码不支持或为二进制文件，请使用下载功能")
        except Exception as e:
            logger.error(f"读取项目文件 {file_path} 失败: {str(e)}")
            raise

    def update_workspace_file_content(self, file_path: str, content: str) -> bool:
        """
        更新项目文件内容

        Args:
            file_path: 相对于workspace_dir的文件路径
            content: 新的文件内容

        Returns:
            bool: 更新是否成功
        """
        try:
            full_path = os.path.join(self.workspace_dir, file_path)

            # 确保目录存在
            os.makedirs(os.path.dirname(full_path), exist_ok=True)

            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)

            logger.info(f"已更新项目文件: {file_path}")
            return True

        except Exception as e:
            logger.error(f"更新项目文件 {file_path} 失败: {str(e)}")
            raise

    def create_workspace_file(self, task_id: int, agent_id: int = None, title: str = '未命名文件', content: str = '', file_type: str = 'agent') -> str:
        """
        创建新的项目文件

        Args:
            task_id: 行动任务ID
            agent_id: 智能体ID（如果是共享文件则为None）
            title: 文件标题
            content: 文件内容
            file_type: 文件类型（'agent' 或 'shared'）

        Returns:
            str: 创建的文件路径
        """
        try:
            task_dir = os.path.join(self.workspace_dir, f'ActionTask-{task_id}')
            os.makedirs(task_dir, exist_ok=True)

            if file_type == 'shared':
                # 创建共享项目文件
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f'SharedWorkspace_{timestamp}.md'
                file_path = os.path.join(task_dir, filename)
                relative_path = f'ActionTask-{task_id}/{filename}'
            else:
                # 创建智能体项目文件
                if not agent_id:
                    raise ValueError("创建智能体项目文件时必须提供agent_id")

                agent_dir = os.path.join(task_dir, f'Agent-{agent_id}')
                os.makedirs(agent_dir, exist_ok=True)

                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f'Workspace_{timestamp}.md'
                file_path = os.path.join(agent_dir, filename)
                relative_path = f'ActionTask-{task_id}/Agent-{agent_id}/{filename}'

            # 写入文件内容
            file_content = f"""# {title}

创建时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

{content}
"""

            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(file_content)

            logger.info(f"已创建记忆文件: {relative_path}")
            return relative_path

        except Exception as e:
            logger.error(f"创建项目文件失败: {str(e)}")
            raise

    def delete_workspace_file(self, file_path: str) -> bool:
        """
        删除项目文件

        Args:
            file_path: 相对于workspace_dir的文件路径

        Returns:
            bool: 删除是否成功
        """
        try:
            full_path = os.path.join(self.workspace_dir, file_path)

            if not os.path.exists(full_path):
                logger.info(f"项目文件不存在: {file_path}")
                return True  # 文件不存在视为删除成功

            os.remove(full_path)
            logger.info(f"已删除项目文件: {file_path}")
            return True

        except Exception as e:
            logger.error(f"删除项目文件 {file_path} 失败: {str(e)}")
            raise

    def upload_workspace_file(self, task_id: int, sub_path: str, file_obj, filename: str) -> str:
        """
        上传文件到工作空间目录

        Args:
            task_id: 行动任务ID
            sub_path: 子路径（相对于任务目录）
            file_obj: 文件对象
            filename: 文件名

        Returns:
            str: 上传后的文件相对路径
        """
        try:
            # 构建目标目录路径
            task_dir = os.path.join(self.workspace_dir, f'ActionTask-{task_id}')

            if sub_path:
                target_dir = os.path.join(task_dir, sub_path)
                relative_dir = f'ActionTask-{task_id}/{sub_path}'
            else:
                target_dir = task_dir
                relative_dir = f'ActionTask-{task_id}'

            # 确保目标目录存在
            os.makedirs(target_dir, exist_ok=True)

            # 生成支持中文的安全文件名
            safe_filename = self.safe_filename_with_unicode(filename)

            # 如果文件已存在，添加时间戳避免冲突
            target_path = os.path.join(target_dir, safe_filename)
            if os.path.exists(target_path):
                name, ext = os.path.splitext(safe_filename)
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                safe_filename = f"{name}_{timestamp}{ext}"
                target_path = os.path.join(target_dir, safe_filename)

            # 保存文件
            file_obj.save(target_path)

            # 返回相对路径
            relative_path = f'{relative_dir}/{safe_filename}'
            logger.info(f"已上传文件到工作空间: {relative_path}")
            return relative_path

        except Exception as e:
            logger.error(f"上传文件到工作空间失败: {str(e)}")
            raise

    def create_workspace_template(self, source_file_path: str, template_name: str, template_description: str = '') -> dict:
        """
        从项目文件创建模板

        Args:
            source_file_path: 源项目文件路径
            template_name: 模板名称
            template_description: 模板描述

        Returns:
            dict: 创建的模板信息
        """
        try:
            from app.models import WorkspaceTemplate
            from app.extensions import db

            # 读取源文件内容
            source_content = self.get_workspace_file_content(source_file_path)

            # 根据源文件路径推断分类
            template_category = 'agent'  # 默认分类
            if 'ProjectSummary' in source_file_path or 'ProjectIndex' in source_file_path:
                template_category = 'shared'

            # 创建数据库记录
            template = WorkspaceTemplate(
                name=template_name,
                description=template_description,
                category=template_category,
                content=source_content,
                source_file_path=source_file_path,
                is_active=True
            )

            db.session.add(template)
            db.session.commit()

            logger.info(f"已创建工作空间模板: {template.id} - {template.name}")

            return {
                'id': template.id,
                'name': template.name,
                'description': template.description,
                'category': template.category,
                'content': template.content,
                'source_file_path': template.source_file_path,
                'created_at': template.created_at.strftime('%Y-%m-%d %H:%M:%S') if template.created_at else ''
            }

        except Exception as e:
            logger.error(f"创建工作空间模板失败: {str(e)}")
            raise

    def create_new_workspace_template(self, template_name: str, template_content: str,
                                 template_description: str = '', template_category: str = 'agent') -> dict:
        """
        创建新的工作空间模板

        Args:
            template_name: 模板名称
            template_content: 模板内容
            template_description: 模板描述
            template_category: 模板分类

        Returns:
            dict: 创建的模板信息
        """
        try:
            from app.models import WorkspaceTemplate
            from app.extensions import db

            # 创建数据库记录
            template = WorkspaceTemplate(
                name=template_name,
                description=template_description,
                category=template_category,
                content=template_content,
                is_active=True
            )

            db.session.add(template)
            db.session.commit()

            logger.info(f"已创建新工作空间模板: {template.id} - {template.name}")

            return {
                'id': template.id,
                'name': template.name,
                'description': template.description,
                'category': template.category,
                'content': template.content,
                'created_at': template.created_at.strftime('%Y-%m-%d %H:%M:%S') if template.created_at else ''
            }

        except Exception as e:
            logger.error(f"创建新工作空间模板失败: {str(e)}")
            raise

    def delete_workspace_for_action_task(self, task_id: int) -> bool:
        """
        删除行动任务的所有项目文件

        Args:
            task_id: 行动任务ID

        Returns:
            bool: 删除是否成功
        """
        try:
            # 获取行动任务目录路径
            task_dir = os.path.join(self.workspace_dir, f'ActionTask-{task_id}')

            # 检查目录是否存在
            if not os.path.exists(task_dir):
                logger.info(f"行动任务 {task_id} 的项目空间目录不存在")
                return True  # 目录不存在视为删除成功

            # 递归删除目录及其内容
            import shutil
            shutil.rmtree(task_dir)

            logger.info(f"已成功删除行动任务 {task_id} 的项目文件")
            return True

        except Exception as e:
            logger.info(f"删除行动任务 {task_id} 的项目文件时出错: {str(e)}")
            return False

    def get_workspace_templates(self) -> list:
        """
        获取工作空间模板列表

        Returns:
            list: 模板列表
        """
        try:
            from app.models import WorkspaceTemplate
            from app.extensions import db

            templates = WorkspaceTemplate.query.filter_by(is_active=True).all()

            template_list = []
            for template in templates:
                template_info = {
                    'id': template.id,
                    'name': template.name,
                    'description': template.description or '',
                    'category': template.category,
                    'content': template.content,
                    'source_file_path': template.source_file_path,
                    'created_at': template.created_at.strftime('%Y-%m-%d %H:%M:%S') if template.created_at else '',
                    'updated_at': template.updated_at.strftime('%Y-%m-%d %H:%M:%S') if template.updated_at else ''
                }
                template_list.append(template_info)

            return template_list

        except Exception as e:
            logger.error(f"获取工作空间模板列表失败: {str(e)}")
            return []



    def update_workspace_template(self, template_id: int, template_name: str,
                             template_content: str, template_description: str = '',
                             template_category: str = 'agent') -> dict:
        """
        更新工作空间模板

        Args:
            template_id: 模板ID
            template_name: 模板名称
            template_content: 模板内容
            template_description: 模板描述
            template_category: 模板分类

        Returns:
            dict: 更新后的模板信息
        """
        try:
            from app.models import WorkspaceTemplate
            from app.extensions import db

            template = WorkspaceTemplate.query.get(template_id)
            if not template:
                raise ValueError(f"模板不存在: {template_id}")

            # 更新模板信息
            template.name = template_name
            template.content = template_content
            template.description = template_description
            template.category = template_category

            db.session.commit()

            # 返回更新后的模板信息
            return {
                'id': template.id,
                'name': template.name,
                'description': template.description,
                'category': template.category,
                'content': template.content,
                'updated_at': template.updated_at.strftime('%Y-%m-%d %H:%M:%S') if template.updated_at else ''
            }

        except Exception as e:
            logger.error(f"更新工作空间模板失败: {str(e)}")
            raise

    def delete_workspace_template(self, template_id: int) -> bool:
        """
        删除工作空间模板

        Args:
            template_id: 模板ID

        Returns:
            bool: 删除是否成功
        """
        try:
            from app.models import WorkspaceTemplate
            from app.extensions import db

            template = WorkspaceTemplate.query.get(template_id)
            if not template:
                logger.info(f"模板不存在: {template_id}")
                return True  # 模板不存在视为删除成功

            # 软删除：设置为不活跃
            template.is_active = False
            db.session.commit()

            logger.info(f"已成功删除工作空间模板: {template_id}")
            return True

        except Exception as e:
            logger.error(f"删除工作空间模板失败: {str(e)}")
            return False

    def update_project_index_if_needed(self, task_id: int) -> None:
        """
        检查并更新ProjectIndex.md文件，确保它反映当前workspace的实际结构
        
        Args:
            task_id: 行动任务ID
        """
        try:
            import os
            from app.models import ActionTask, Agent, ActionTaskAgent, Role
            
            # 获取任务信息
            action_task = ActionTask.query.get(task_id)
            if not action_task:
                logger.info(f"未找到任务ID {task_id}")
                return
                
            # 获取参与该任务的智能体信息
            agent_relations = ActionTaskAgent.query.filter_by(
                action_task_id=task_id
            ).all()
            
            agent_info = []
            for relation in agent_relations:
                agent = Agent.query.get(relation.agent_id)
                if agent:
                    role = Role.query.get(agent.role_id) if agent.role_id else None
                    agent_info.append({
                        'id': agent.id,
                        'name': agent.name,
                        'role_name': role.name if role else '未知角色'
                    })
            
            # 获取当前workspace的实际文件结构
            task_dir = os.path.join(self.workspace_dir, f'ActionTask-{task_id}')
            if not os.path.exists(task_dir):
                logger.info(f"任务目录不存在: {task_dir}")
                return
                
            # 生成当前实际的目录结构
            current_structure = self._generate_workspace_structure(task_dir, task_id)
            
            # 读取现有的ProjectIndex.md内容
            index_path = os.path.join(task_dir, 'ProjectIndex.md')
            existing_content = ""
            if os.path.exists(index_path):
                try:
                    with open(index_path, 'r', encoding='utf-8') as f:
                        existing_content = f.read()
                except Exception as e:
                    logger.error(f"读取ProjectIndex.md失败: {str(e)}")
            
            # 生成新的ProjectIndex.md内容
            new_content = self._generate_project_index_content(
                task_id, action_task.title, agent_info, current_structure
            )
            
            # 如果内容有变化，则更新文件
            if new_content != existing_content:
                try:
                    with open(index_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    logger.info(f"已更新ProjectIndex.md: {index_path}")
                except Exception as e:
                    logger.error(f"更新ProjectIndex.md失败: {str(e)}")
            else:
                logger.info("ProjectIndex.md内容无变化，跳过更新")
                
        except Exception as e:
            logger.info(f"更新ProjectIndex.md时出错: {str(e)}")
    
    def _generate_workspace_structure(self, task_dir: str, task_id: int) -> str:
        """
        生成workspace的实际目录结构字符串
        
        Args:
            task_dir: 任务目录路径
            task_id: 任务ID
            
        Returns:
            str: 目录结构字符串
        """
        import os
        
        structure_lines = []
        structure_lines.append(f"ActionTask-{task_id}/")
        
        try:
            # 扫描任务目录下的所有内容
            items = sorted(os.listdir(task_dir))
            
            for i, item in enumerate(items):
                item_path = os.path.join(task_dir, item)
                is_last = i == len(items) - 1
                prefix = "└── " if is_last else "├── "
                
                if os.path.isdir(item_path):
                    structure_lines.append(f"{prefix}{item}/")
                    # 扫描子目录
                    try:
                        sub_items = sorted(os.listdir(item_path))
                        for j, sub_item in enumerate(sub_items):
                            sub_is_last = j == len(sub_items) - 1
                            sub_prefix = "    └── " if is_last else "│   └── " if sub_is_last else "│   ├── "
                            if is_last:
                                sub_prefix = "    └── " if sub_is_last else "    ├── "
                            structure_lines.append(f"{sub_prefix}{sub_item}")
                    except Exception as e:
                        logger.error(f"扫描子目录失败 {item_path}: {str(e)}")
                else:
                    structure_lines.append(f"{prefix}{item}")
                    
        except Exception as e:
            logger.error(f"生成目录结构失败: {str(e)}")
            structure_lines.append("# 无法读取目录结构")
            
        return "\n".join(structure_lines)
    
    def _generate_project_index_content(self, task_id: int, task_title: str, agent_info: list, structure: str) -> str:
        """
        生成ProjectIndex.md的内容
        
        Args:
            task_id: 任务ID
            task_title: 任务标题
            agent_info: 智能体信息列表
            structure: 目录结构字符串
            
        Returns:
            str: ProjectIndex.md内容
        """
        from datetime import datetime
        import os
        
        content = f"""# {task_title} 项目索引

## 工作目录结构
```
{structure}
```
"""
        
        # 检查并添加存在的智能体个人工作空间
        task_dir = os.path.join(self.workspace_dir, f'ActionTask-{task_id}')
        agent_workspace_section = ""
        
        for agent in agent_info:
            agent_id = agent['id']
            agent_dir = os.path.join(task_dir, f'Agent-{agent_id}')
            
            # 只有目录实际存在时才添加
            if os.path.exists(agent_dir):
                agent_name = agent.get('name', f'智能体{agent_id}')
                agent_role = agent.get('role_name', '未知角色')
                agent_workspace_section += f"- {agent_name}[{agent_role}][ID: {agent_id}] 工作目录: `ActionTask-{task_id}/Agent-{agent_id}/`\n"
                agent_workspace_section += f"  - 个人工作空间: `ActionTask-{task_id}/Agent-{agent_id}/AgentWorkspace.md`\n"
        
        # 如果有个人工作空间，添加章节
        if agent_workspace_section:
            content += "\n## 智能体工作目录\n" + agent_workspace_section
        
        content += f"""
## 共享文件
- 项目总结: `ActionTask-{task_id}/ProjectSummary.md`
- 项目索引: `ActionTask-{task_id}/ProjectIndex.md`（本文件）

最后更新: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        
        return content

# 创建全局实例
workspace_service = WorkspaceService()
