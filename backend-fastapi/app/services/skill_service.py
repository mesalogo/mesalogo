"""
技能管理服务

负责 Skill 的 CRUD、文件系统管理、导入导出
"""
import os
import io
import yaml
import shutil
import zipfile
import tempfile
import logging
from typing import List, Dict, Optional

from app.models import db, Skill, RoleSkill
from app.services.user_permission_service import UserPermissionService

logger = logging.getLogger(__name__)

SKILLS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "skills")


class SkillService:

    def __init__(self):
        os.makedirs(SKILLS_DIR, exist_ok=True)

    # ── CRUD ──

    def list_skills(self, current_user=None) -> List[Dict]:
        query = Skill.query.order_by(Skill.created_at.desc())
        if current_user:
            query = UserPermissionService.filter_viewable_resources(query, Skill, current_user)
        skills = query.all()
        return [self._skill_to_dict(s) for s in skills]

    def get_skill(self, skill_name: str) -> Optional[Dict]:
        skill = Skill.query.filter_by(name=skill_name).first()
        if not skill:
            return None
        result = self._skill_to_dict(skill)
        # 加载完整 SKILL.md
        result['skill_md_content'] = self._read_skill_md(skill_name)
        result['scripts'] = self._list_dir_files(skill_name, 'scripts')
        result['references'] = self._list_dir_files(skill_name, 'references')
        result['assets'] = self._list_dir_files(skill_name, 'assets')
        return result

    def create_skill(self, data: Dict) -> Dict:
        name = data.get('name', '').strip()
        if not name:
            raise ValueError('技能名称不能为空')
        if Skill.query.filter_by(name=name).first():
            raise ValueError(f'技能已存在: {name}')

        # 创建文件系统目录
        skill_path = os.path.join(SKILLS_DIR, name)
        os.makedirs(skill_path, exist_ok=True)
        os.makedirs(os.path.join(skill_path, 'scripts'), exist_ok=True)
        os.makedirs(os.path.join(skill_path, 'references'), exist_ok=True)
        os.makedirs(os.path.join(skill_path, 'assets'), exist_ok=True)

        # 生成 SKILL.md
        skill_md = self._generate_skill_md(data)
        with open(os.path.join(skill_path, 'SKILL.md'), 'w', encoding='utf-8') as f:
            f.write(skill_md)

        # 创建数据库记录
        skill = Skill(
            name=name,
            description=data.get('description', ''),
            display_name=data.get('display_name', ''),
            enabled=data.get('enabled', True),
            security_level=data.get('security_level', 1),
            storage_type='filesystem',
            config=data.get('config', {}),
            created_by=data.get('created_by'),
            is_shared=data.get('is_shared', True),
        )
        db.session.add(skill)
        db.session.commit()
        return self.get_skill(name)

    def update_skill(self, skill_name: str, data: Dict) -> Dict:
        skill = Skill.query.filter_by(name=skill_name).first()
        if not skill:
            raise ValueError(f'技能不存在: {skill_name}')

        for field in ['description', 'display_name', 'enabled', 'security_level', 'config']:
            if field in data:
                setattr(skill, field, data[field])

        # 更新 SKILL.md 内容
        if 'skill_md_content' in data:
            skill_md_path = os.path.join(SKILLS_DIR, skill_name, 'SKILL.md')
            with open(skill_md_path, 'w', encoding='utf-8') as f:
                f.write(data['skill_md_content'])
            # 同步 frontmatter 到数据库
            meta = self._parse_frontmatter(data['skill_md_content'])
            if meta:
                if 'description' in meta and 'description' not in data:
                    skill.description = meta['description'][:1024]

        db.session.commit()
        return self.get_skill(skill_name)

    def delete_skill(self, skill_name: str) -> bool:
        skill = Skill.query.filter_by(name=skill_name).first()
        if skill:
            RoleSkill.query.filter_by(skill_id=skill.id).delete()
            db.session.delete(skill)
            db.session.commit()

        skill_path = os.path.join(SKILLS_DIR, skill_name)
        if os.path.exists(skill_path):
            shutil.rmtree(skill_path)
        return True

    # ── SKILL.md 内容 ──

    def get_skill_content(self, skill_name: str) -> Optional[str]:
        return self._read_skill_md(skill_name)

    def update_skill_content(self, skill_name: str, content: str) -> bool:
        skill_md_path = os.path.join(SKILLS_DIR, skill_name, 'SKILL.md')
        if not os.path.exists(os.path.dirname(skill_md_path)):
            return False
        with open(skill_md_path, 'w', encoding='utf-8') as f:
            f.write(content)
        # 同步 frontmatter
        meta = self._parse_frontmatter(content)
        if meta:
            skill = Skill.query.filter_by(name=skill_name).first()
            if skill and 'description' in meta:
                skill.description = meta['description'][:1024]
                db.session.commit()
        return True

    # ── 脚本管理 ──

    def list_scripts(self, skill_name: str) -> List[Dict]:
        return self._list_dir_files(skill_name, 'scripts')

    def get_script(self, skill_name: str, script_path: str) -> Optional[str]:
        return self._read_sub_file(skill_name, 'scripts', script_path)

    def update_script(self, skill_name: str, script_path: str, content: str) -> bool:
        return self._write_sub_file(skill_name, 'scripts', script_path, content)

    def create_script(self, skill_name: str, script_name: str, content: str = '') -> bool:
        scripts_dir = os.path.join(SKILLS_DIR, skill_name, 'scripts')
        os.makedirs(scripts_dir, exist_ok=True)
        return self._write_sub_file(skill_name, 'scripts', script_name, content)

    def delete_script(self, skill_name: str, script_path: str) -> bool:
        return self._delete_sub_file(skill_name, 'scripts', script_path)

    # ── 参考资料管理 ──

    def list_references(self, skill_name: str) -> List[Dict]:
        return self._list_dir_files(skill_name, 'references')

    def get_reference(self, skill_name: str, ref_path: str) -> Optional[str]:
        return self._read_sub_file(skill_name, 'references', ref_path)

    def update_reference(self, skill_name: str, ref_path: str, content: str) -> bool:
        return self._write_sub_file(skill_name, 'references', ref_path, content)

    # ── 资源管理 ──

    def list_assets(self, skill_name: str) -> List[Dict]:
        return self._list_dir_files(skill_name, 'assets')

    def save_asset(self, skill_name: str, filename: str, file_data: bytes) -> bool:
        assets_dir = os.path.join(SKILLS_DIR, skill_name, 'assets')
        os.makedirs(assets_dir, exist_ok=True)
        full_path = os.path.join(assets_dir, filename)
        if not self._is_safe_path(os.path.join(SKILLS_DIR, skill_name), full_path):
            return False
        with open(full_path, 'wb') as f:
            f.write(file_data)
        return True

    # ── 导入导出 ──

    def import_preview(self, zip_data: bytes) -> Dict:
        """解析 zip 文件，返回预览信息"""
        try:
            with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zf:
                skill_md_path = self._find_skill_md_in_zip(zf)
                if not skill_md_path:
                    return {'success': False, 'error': 'zip 包中未找到 SKILL.md 文件'}

                content = zf.read(skill_md_path).decode('utf-8')
                meta = self._parse_frontmatter(content) or {}

                # 确定 skill 根目录前缀
                prefix = os.path.dirname(skill_md_path)
                if prefix:
                    prefix += '/'

                # 统计文件
                scripts = [n for n in zf.namelist() if n.startswith(prefix + 'scripts/') and not n.endswith('/')]
                references = [n for n in zf.namelist() if n.startswith(prefix + 'references/') and not n.endswith('/')]
                assets = [n for n in zf.namelist() if n.startswith(prefix + 'assets/') and not n.endswith('/')]

                name = meta.get('name', os.path.basename(prefix.rstrip('/')) if prefix else 'unknown')
                exists = Skill.query.filter_by(name=name).first() is not None

                return {
                    'success': True,
                    'name': name,
                    'description': meta.get('description', ''),
                    'metadata': meta.get('metadata', {}),
                    'scripts_count': len(scripts),
                    'references_count': len(references),
                    'assets_count': len(assets),
                    'exists': exists,
                    'prefix': prefix,
                }
        except zipfile.BadZipFile:
            return {'success': False, 'error': '无效的 zip 文件'}
        except Exception as e:
            logger.error(f"导入预览失败: {e}")
            return {'success': False, 'error': str(e)}

    def import_confirm(self, zip_data: bytes, preview: Dict) -> Dict:
        """确认导入"""
        name = preview.get('name')
        if not name:
            return {'success': False, 'error': '缺少技能名称'}

        try:
            with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zf:
                prefix = preview.get('prefix', '')
                skill_path = os.path.join(SKILLS_DIR, name)

                # 如果已存在，先删除文件系统
                if os.path.exists(skill_path):
                    shutil.rmtree(skill_path)
                os.makedirs(skill_path, exist_ok=True)

                # 解压文件
                for member in zf.namelist():
                    if member.endswith('/'):
                        continue
                    if not member.startswith(prefix):
                        continue
                    rel_path = member[len(prefix):]
                    if not rel_path:
                        continue
                    target = os.path.join(skill_path, rel_path)
                    os.makedirs(os.path.dirname(target), exist_ok=True)
                    with zf.open(member) as src, open(target, 'wb') as dst:
                        dst.write(src.read())

            # 读取 SKILL.md 获取元数据
            skill_md_content = self._read_skill_md(name)
            meta = self._parse_frontmatter(skill_md_content) if skill_md_content else {}

            # 创建或更新数据库记录
            skill = Skill.query.filter_by(name=name).first()
            if skill:
                skill.description = (meta.get('description', '') or preview.get('description', ''))[:1024]
                if meta.get('metadata'):
                    skill.config = {**(skill.config or {}), **meta['metadata']}
            else:
                skill = Skill(
                    name=name,
                    description=(meta.get('description', '') or preview.get('description', ''))[:1024],
                    display_name=meta.get('metadata', {}).get('display_name', ''),
                    enabled=True,
                    security_level=1,
                    storage_type='filesystem',
                    config=meta.get('metadata', {}),
                    is_shared=True,
                )
                db.session.add(skill)
            db.session.commit()

            return {'success': True, 'name': name}
        except Exception as e:
            logger.error(f"导入确认失败: {e}")
            return {'success': False, 'error': str(e)}

    def export_skill(self, skill_name: str) -> Optional[bytes]:
        """导出技能为 zip bytes"""
        skill_path = os.path.join(SKILLS_DIR, skill_name)
        if not os.path.exists(skill_path):
            return None

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(skill_path):
                for f in files:
                    full = os.path.join(root, f)
                    arcname = os.path.join(skill_name, os.path.relpath(full, skill_path))
                    zf.write(full, arcname)
        return buf.getvalue()

    # ── 角色绑定 ──

    def get_role_skills(self, role_id: str) -> List[Dict]:
        skills = db.session.query(Skill).join(
            RoleSkill, RoleSkill.skill_id == Skill.id
        ).filter(RoleSkill.role_id == role_id).all()
        return [self._skill_to_dict(s) for s in skills]

    def bind_role_skills(self, role_id: str, skill_ids: List[str]) -> bool:
        RoleSkill.query.filter_by(role_id=role_id).delete()
        for sid in skill_ids:
            db.session.add(RoleSkill(role_id=role_id, skill_id=sid))
        db.session.commit()
        return True

    def unbind_role_skill(self, role_id: str, skill_id: str) -> bool:
        RoleSkill.query.filter_by(role_id=role_id, skill_id=skill_id).delete()
        db.session.commit()
        return True

    # ── Prompt 注入 ──

    def get_skill_metadata_for_prompt(self, role_id: str) -> List[Dict]:
        """获取角色绑定的所有已启用技能的 name + description"""
        skills = db.session.query(Skill.name, Skill.description).join(
            RoleSkill, RoleSkill.skill_id == Skill.id
        ).filter(
            RoleSkill.role_id == role_id,
            Skill.enabled == True
        ).all()
        return [{'name': s.name, 'description': s.description} for s in skills]

    # ── 文件系统同步 ──

    def sync_filesystem_to_db(self):
        """扫描文件系统，同步到数据库"""
        result = {'created': 0, 'updated': 0, 'skipped': 0}
        if not os.path.exists(SKILLS_DIR):
            return result
        for item in os.listdir(SKILLS_DIR):
            skill_path = os.path.join(SKILLS_DIR, item)
            if not os.path.isdir(skill_path):
                continue
            skill_md_path = os.path.join(skill_path, 'SKILL.md')
            if not os.path.exists(skill_md_path):
                continue
            if Skill.query.filter_by(name=item).first():
                result['skipped'] += 1
                continue
            try:
                with open(skill_md_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                meta = self._parse_frontmatter(content) or {}
                skill = Skill(
                    name=item,
                    description=(meta.get('description', '') or '')[:1024],
                    display_name=meta.get('metadata', {}).get('display_name', ''),
                    enabled=True,
                    security_level=1,
                    storage_type='filesystem',
                    config=meta.get('metadata', {}),
                    is_shared=True,
                )
                db.session.add(skill)
                result['created'] += 1
                logger.info(f"同步文件系统技能到数据库: {item}")
            except Exception as e:
                logger.error(f"同步技能 {item} 失败: {e}")
        db.session.commit()
        return result

    # ── 内部工具方法 ──

    def _skill_to_dict(self, skill: Skill) -> Dict:
        return {
            'id': skill.id,
            'name': skill.name,
            'description': skill.description,
            'display_name': skill.display_name,
            'enabled': skill.enabled,
            'security_level': skill.security_level,
            'storage_type': skill.storage_type,
            'config': skill.config,
            'created_by': skill.created_by,
            'is_shared': skill.is_shared,
            'created_at': skill.created_at.isoformat() if skill.created_at else None,
            'updated_at': skill.updated_at.isoformat() if skill.updated_at else None,
        }

    def _read_skill_md(self, skill_name: str) -> Optional[str]:
        # 优先检查数据库存储
        skill = Skill.query.filter_by(name=skill_name).first()
        if skill and skill.storage_type == 'database' and skill.skill_md_content:
            return skill.skill_md_content
        # 回退到文件系统
        path = os.path.join(SKILLS_DIR, skill_name, 'SKILL.md')
        if not os.path.exists(path):
            return None
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()

    def _generate_skill_md(self, data: Dict) -> str:
        metadata = {
            'name': data.get('name'),
            'description': data.get('description', ''),
        }
        if data.get('license'):
            metadata['license'] = data['license']
        if data.get('compatibility'):
            metadata['compatibility'] = data['compatibility']
        extra_meta = {}
        if data.get('display_name'):
            extra_meta['display_name'] = data['display_name']
        if data.get('config', {}).get('version'):
            extra_meta['version'] = data['config']['version']
        if extra_meta:
            metadata['metadata'] = extra_meta

        yaml_str = yaml.dump(metadata, allow_unicode=True, default_flow_style=False)
        body = data.get('body', f"# {data.get('display_name') or data.get('name')}\n\n## 概述\n{data.get('description', '')}\n\n## 执行步骤\n1. 待定义\n")
        return f"---\n{yaml_str}---\n\n{body}"

    def _parse_frontmatter(self, content: str) -> Optional[Dict]:
        if not content or not content.startswith('---'):
            return None
        parts = content.split('---', 2)
        if len(parts) < 3:
            return None
        try:
            return yaml.safe_load(parts[1])
        except Exception:
            return None

    def _list_dir_files(self, skill_name: str, subdir: str) -> List[Dict]:
        dir_path = os.path.join(SKILLS_DIR, skill_name, subdir)
        if not os.path.exists(dir_path):
            return []
        result = []
        for root, _, files in os.walk(dir_path):
            for f in files:
                full = os.path.join(root, f)
                rel = os.path.relpath(full, dir_path)
                result.append({'name': f, 'path': rel, 'size': os.path.getsize(full)})
        return result

    def _read_sub_file(self, skill_name: str, subdir: str, file_path: str) -> Optional[str]:
        full = os.path.join(SKILLS_DIR, skill_name, subdir, file_path)
        if not self._is_safe_path(os.path.join(SKILLS_DIR, skill_name), full):
            return None
        if not os.path.exists(full):
            return None
        with open(full, 'r', encoding='utf-8') as f:
            return f.read()

    def _write_sub_file(self, skill_name: str, subdir: str, file_path: str, content: str) -> bool:
        full = os.path.join(SKILLS_DIR, skill_name, subdir, file_path)
        if not self._is_safe_path(os.path.join(SKILLS_DIR, skill_name), full):
            return False
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, 'w', encoding='utf-8') as f:
            f.write(content)
        return True

    def _delete_sub_file(self, skill_name: str, subdir: str, file_path: str) -> bool:
        full = os.path.join(SKILLS_DIR, skill_name, subdir, file_path)
        if not self._is_safe_path(os.path.join(SKILLS_DIR, skill_name), full):
            return False
        if os.path.exists(full):
            os.remove(full)
            return True
        return False

    def _is_safe_path(self, base: str, target: str) -> bool:
        return os.path.realpath(target).startswith(os.path.realpath(base))

    def _find_skill_md_in_zip(self, zf: zipfile.ZipFile) -> Optional[str]:
        """在 zip 中查找 SKILL.md（根目录或一级子目录）"""
        for name in zf.namelist():
            basename = os.path.basename(name)
            if basename == 'SKILL.md':
                depth = name.count('/')
                if name.endswith('SKILL.md') and depth <= 1:
                    return name
        return None
