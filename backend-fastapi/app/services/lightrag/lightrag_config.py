"""
LightRAG 配置同步服务

负责从平台 ModelConfig 生成 LightRAG 环境变量配置，并同步到容器
"""
import os
import subprocess
from typing import Dict, Optional, Tuple
from app.models import ModelConfig, GraphEnhancement
from app.extensions import db
import logging

logger = logging.getLogger(__name__)


class LightRAGConfigService:
    """LightRAG 配置同步服务"""

    # 默认服务地址
    DEFAULT_SERVICE_URL = "http://127.0.0.1:9621"

    @staticmethod
    def get_lightrag_config() -> Optional[GraphEnhancement]:
        """
        获取 LightRAG 配置记录
        
        Returns:
            GraphEnhancement 配置对象，如果不存在则返回 None
        """
        return GraphEnhancement.query.filter_by(framework='lightrag').first()

    @staticmethod
    def get_or_create_config() -> GraphEnhancement:
        """
        获取或创建 LightRAG 配置
        
        Returns:
            GraphEnhancement 配置对象
        """
        config = LightRAGConfigService.get_lightrag_config()
        if not config:
            config = GraphEnhancement(
                name='LightRAG 知识库配置',
                description='LightRAG 容器化知识库系统配置',
                enabled=False,
                framework='lightrag',
                framework_config={
                    'service_url': LightRAGConfigService.DEFAULT_SERVICE_URL,
                    'partition_strategy': 'by_knowledge',
                    'chunk_size': 1200,
                    'chunk_overlap': 100,
                    'summary_language': 'Chinese',
                    'top_k': 40,
                }
            )
            db.session.add(config)
            db.session.commit()
        return config

    @staticmethod
    def save_config(data: dict) -> Tuple[bool, str]:
        """
        保存 LightRAG 配置
        
        Args:
            data: 配置数据
            
        Returns:
            (success, message) 元组
        """
        try:
            config = LightRAGConfigService.get_or_create_config()
            
            # 更新基础字段
            if 'enabled' in data:
                config.enabled = data['enabled']
            if 'name' in data:
                config.name = data['name']
            if 'description' in data:
                config.description = data['description']
            
            # 更新框架配置
            framework_config = config.framework_config or {}
            if 'framework_config' in data:
                framework_config.update(data['framework_config'])
            config.framework_config = framework_config
            
            # 强制标记 JSON 字段为已修改
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(config, 'framework_config')
            
            db.session.commit()
            logger.info("LightRAG 配置保存成功")
            return True, "配置保存成功"
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"保存 LightRAG 配置失败: {str(e)}")
            return False, f"保存配置失败: {str(e)}"

    @staticmethod
    def get_lightrag_env_config() -> Dict[str, str]:
        """
        从平台 ModelConfig 生成 LightRAG 环境变量配置
        用于 Docker 启动或配置同步
        """
        try:
            # 获取 LightRAG 配置
            lightrag_config = LightRAGConfigService.get_lightrag_config()
            framework_config = lightrag_config.framework_config if lightrag_config else {}
            
            # 获取默认文本生成模型
            llm_model = ModelConfig.query.filter_by(
                is_default_text=True
            ).first()

            # 获取默认嵌入模型
            embedding_model = ModelConfig.query.filter_by(
                is_default_embedding=True
            ).first()

            # 获取默认重排序模型（可选）
            rerank_model = ModelConfig.query.filter_by(
                is_default_rerank=True
            ).first()
            
            # 检查是否启用重排序（从 framework_config 获取）
            enable_rerank = framework_config.get('enable_rerank', True)

            config = {
                # 服务配置
                'HOST': '0.0.0.0',
                'PORT': '9621',
                'WEBUI_TITLE': 'ABM-LLM Knowledge Graph',
                
                # LLM 配置
                'LLM_BINDING': 'openai',  # 默认使用 OpenAI 兼容接口
                'LLM_MODEL': llm_model.model_id if llm_model else 'gpt-4o-mini',
                'LLM_BINDING_HOST': llm_model.base_url if llm_model else 'https://api.openai.com/v1',
                'LLM_BINDING_API_KEY': llm_model.api_key if llm_model else '',

                # Embedding 配置
                'EMBEDDING_BINDING': 'openai',
                'EMBEDDING_MODEL': embedding_model.model_id if embedding_model else 'text-embedding-3-large',
                # 优先使用 framework_config 中的 embedding_dimension，否则从模型配置读取
                'EMBEDDING_DIM': str(framework_config.get('embedding_dimension') or (embedding_model.additional_params.get('embedding_dim', 1024) if embedding_model and embedding_model.additional_params else 1024)),
                'EMBEDDING_BINDING_HOST': embedding_model.base_url if embedding_model else 'https://api.openai.com/v1',
                'EMBEDDING_BINDING_API_KEY': embedding_model.api_key if embedding_model else '',
                'EMBEDDING_SEND_DIM': 'false',
                'EMBEDDING_TOKEN_LIMIT': '8192',

                # 文档处理配置（默认值）
                'CHUNK_SIZE': '1200',
                'CHUNK_OVERLAP_SIZE': '100',
                'SUMMARY_LANGUAGE': 'Chinese',

                # 查询配置
                'TOP_K': '40',
                'MAX_TOTAL_TOKENS': '30000',
                'ENABLE_LLM_CACHE': 'true',
                'ENABLE_LLM_CACHE_FOR_EXTRACT': 'true',
            }

            # Rerank 配置：通过 RERANK_BINDING=null 禁用重排序
            if enable_rerank and rerank_model:
                config.update({
                    'RERANK_BINDING': 'cohere',  # 根据 provider 判断
                    'RERANK_MODEL': rerank_model.model_id,
                    'RERANK_BINDING_HOST': rerank_model.base_url,
                    'RERANK_BINDING_API_KEY': rerank_model.api_key,
                })
            else:
                # 禁用重排序：设置 RERANK_BINDING=null
                config['RERANK_BINDING'] = 'null'

            logger.info(f"成功生成 LightRAG 环境变量配置 (enable_rerank={enable_rerank})")
            return config

        except Exception as e:
            logger.error(f"生成 LightRAG 配置失败: {str(e)}")
            raise

    @staticmethod
    def generate_env_file(output_path: str = None) -> str:
        """
        生成 LightRAG 的 .env 文件
        
        Args:
            output_path: 输出文件路径，默认为 abm-docker/lightrag.env
            
        Returns:
            生成的文件路径
        """
        if output_path is None:
            # 默认路径：项目根目录/abm-docker/lightrag.env
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))
            output_path = os.path.join(base_dir, 'abm-docker', 'lightrag.env')

        try:
            config = LightRAGConfigService.get_lightrag_env_config()

            # 读取现有的 lightrag.env 模板（如果存在）
            env_lines = []
            if os.path.exists(output_path):
                with open(output_path, 'r', encoding='utf-8') as f:
                    env_lines = f.readlines()

            # 更新配置项
            updated_lines = []
            updated_keys = set()

            for line in env_lines:
                line = line.rstrip('\n')
                # 跳过注释和空行
                if line.startswith('#') or not line.strip():
                    updated_lines.append(line)
                    continue

                # 检查是否是配置项
                if '=' in line:
                    key = line.split('=')[0].strip()
                    if key in config:
                        # 更新配置值
                        updated_lines.append(f'{key}={config[key]}')
                        updated_keys.add(key)
                    else:
                        # 保留原有配置
                        updated_lines.append(line)
                else:
                    updated_lines.append(line)

            # 添加新的配置项（如果不存在）
            for key, value in config.items():
                if key not in updated_keys:
                    updated_lines.append(f'{key}={value}')

            # 写回文件
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(updated_lines))
                f.write('\n')  # 确保文件以换行符结尾

            logger.info(f"成功生成 LightRAG 配置文件: {output_path}")
            return output_path

        except Exception as e:
            logger.error(f"生成 LightRAG 配置文件失败: {str(e)}")
            raise

    @staticmethod
    def _get_docker_dir() -> str:
        """获取 docker-compose 文件所在目录"""
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))
        return os.path.join(base_dir, 'abm-docker')

    @staticmethod
    def restart_lightrag_container() -> Tuple[bool, str]:
        """
        重启 LightRAG Docker 容器
        
        Returns:
            (success, message) 元组
        """
        try:
            docker_dir = LightRAGConfigService._get_docker_dir()

            if not os.path.exists(docker_dir):
                return False, f"Docker 目录不存在: {docker_dir}"

            result = subprocess.run(
                ['docker', 'compose', '-f', 'docker-compose.lightrag.yml', '--profile', 'lightrag', 'restart'],
                cwd=docker_dir,
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode == 0:
                logger.info("成功重启 LightRAG 容器")
                return True, "LightRAG 容器已重启"
            else:
                error_msg = result.stderr or result.stdout
                logger.error(f"重启 LightRAG 容器失败: {error_msg}")
                return False, f"重启失败: {error_msg}"

        except subprocess.TimeoutExpired:
            logger.error("重启 LightRAG 容器超时")
            return False, "重启超时，请检查 Docker 服务"
        except FileNotFoundError:
            logger.error("Docker 或 docker-compose 命令不存在")
            return False, "Docker 命令不存在，请确保已安装 Docker"
        except Exception as e:
            logger.error(f"重启 LightRAG 异常: {str(e)}")
            return False, f"重启异常: {str(e)}"

    @staticmethod
    def start_lightrag_container() -> Tuple[bool, str]:
        """
        启动 LightRAG Docker 容器
        
        Returns:
            (success, message) 元组
        """
        try:
            docker_dir = LightRAGConfigService._get_docker_dir()

            if not os.path.exists(docker_dir):
                return False, f"Docker 目录不存在: {docker_dir}"

            result = subprocess.run(
                ['docker', 'compose', '-f', 'docker-compose.lightrag.yml', '--profile', 'lightrag', 'up', '-d'],
                cwd=docker_dir,
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.returncode == 0:
                logger.info("成功启动 LightRAG 容器")
                return True, "LightRAG 容器已启动"
            else:
                error_msg = result.stderr or result.stdout
                logger.error(f"启动 LightRAG 容器失败: {error_msg}")
                return False, f"启动失败: {error_msg}"

        except subprocess.TimeoutExpired:
            logger.error("启动 LightRAG 容器超时")
            return False, "启动超时，请检查 Docker 服务"
        except FileNotFoundError:
            logger.error("Docker 或 docker-compose 命令不存在")
            return False, "Docker 命令不存在，请确保已安装 Docker"
        except Exception as e:
            logger.error(f"启动 LightRAG 异常: {str(e)}")
            return False, f"启动异常: {str(e)}"

    @staticmethod
    def stop_lightrag_container() -> Tuple[bool, str]:
        """
        停止 LightRAG Docker 容器
        
        Returns:
            (success, message) 元组
        """
        try:
            docker_dir = LightRAGConfigService._get_docker_dir()

            if not os.path.exists(docker_dir):
                return False, f"Docker 目录不存在: {docker_dir}"

            result = subprocess.run(
                ['docker', 'compose', '-f', 'docker-compose.lightrag.yml', '--profile', 'lightrag', 'down'],
                cwd=docker_dir,
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode == 0:
                logger.info("成功停止并移除 LightRAG 容器")
                return True, "LightRAG 容器已停止并移除"
            else:
                error_msg = result.stderr or result.stdout
                logger.error(f"停止 LightRAG 容器失败: {error_msg}")
                return False, f"停止失败: {error_msg}"

        except subprocess.TimeoutExpired:
            logger.error("停止 LightRAG 容器超时")
            return False, "停止超时，请检查 Docker 服务"
        except FileNotFoundError:
            logger.error("Docker 或 docker-compose 命令不存在")
            return False, "Docker 命令不存在，请确保已安装 Docker"
        except Exception as e:
            logger.error(f"停止 LightRAG 异常: {str(e)}")
            return False, f"停止异常: {str(e)}"
