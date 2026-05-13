"""
LightRAG 容器化服务客户端

提供与 LightRAG Docker 容器的 HTTP API 交互
"""
import requests
from typing import Dict, Any, Optional, Tuple, List
import logging

logger = logging.getLogger(__name__)


class LightRAGService:
    """LightRAG 容器化服务客户端"""
    
    def __init__(self, service_url: str = "http://127.0.0.1:9621"):
        """
        初始化 LightRAG 服务客户端
        
        Args:
            service_url: LightRAG 服务地址
        """
        self.service_url = service_url.rstrip('/')
    
    def health_check(self) -> Dict[str, Any]:
        """
        检查服务健康状态
        
        Returns:
            健康状态信息
        """
        try:
            response = requests.get(f"{self.service_url}/health", timeout=5)
            
            if response.ok:
                return {
                    'status': 'healthy',
                    'details': response.json() if response.content else None
                }
            else:
                return {
                    'status': 'unhealthy',
                    'details': None
                }
        except requests.exceptions.ConnectionError:
            return {
                'status': 'unreachable',
                'error': '无法连接到 LightRAG 服务'
            }
        except requests.exceptions.Timeout:
            return {
                'status': 'timeout',
                'error': '连接超时'
            }
        except Exception as e:
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def get_status(self) -> Dict[str, Any]:
        """
        获取 LightRAG 服务状态
        
        Returns:
            服务状态信息
        """
        health = self.health_check()
        
        # 如果服务健康，尝试获取更多统计信息
        if health.get('status') == 'healthy':
            try:
                # 尝试获取工作空间统计
                workspaces = self.get_workspaces()
                health['statistics'] = {
                    'workspace_count': len(workspaces) if isinstance(workspaces, list) else 0,
                    'document_count': 0  # TODO: 需要 LightRAG API 支持
                }
            except Exception as e:
                logger.warning(f"获取 LightRAG 统计信息失败: {e}")
                health['statistics'] = None
        
        return health
    
    def query(
        self,
        query: str,
        workspace: str = "default",
        mode: str = "hybrid",
        top_k: int = 60,
        response_type: str = "Multiple Paragraphs",
        **kwargs
    ) -> Tuple[bool, Any]:
        """
        执行 LightRAG 查询
        
        Args:
            query: 查询内容
            workspace: 知识库工作空间
            mode: 查询模式 (naive, local, global, hybrid, mix)
            top_k: 返回结果数量
            response_type: 响应类型
            **kwargs: 其他参数
            
        Returns:
            (success, result) 元组
        """
        try:
            headers = {
                "LIGHTRAG-WORKSPACE": workspace,
                "Content-Type": "application/json"
            }
            
            payload = {
                "query": query,
                "mode": mode,
                "top_k": top_k,
                "response_type": response_type,
                **kwargs
            }
            
            response = requests.post(
                f"{self.service_url}/query",
                headers=headers,
                json=payload,
                timeout=60
            )
            
            if response.ok:
                result = response.json()
                logger.info(f"LightRAG 查询成功: {query[:50]}...")
                return True, result
            else:
                error_msg = f"查询失败: HTTP {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg = f"{error_msg} - {error_detail}"
                except:
                    error_msg = f"{error_msg} - {response.text}"
                logger.error(error_msg)
                return False, error_msg
                
        except requests.exceptions.ConnectionError:
            error_msg = "无法连接到 LightRAG 服务"
            logger.error(error_msg)
            return False, error_msg
        except requests.exceptions.Timeout:
            error_msg = "查询超时"
            logger.error(error_msg)
            return False, error_msg
        except Exception as e:
            error_msg = f"查询异常: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def query_stream(
        self,
        query: str,
        workspace: str = "default",
        mode: str = "hybrid",
        **kwargs
    ):
        """
        执行 LightRAG 流式查询
        
        Args:
            query: 查询内容
            workspace: 知识库工作空间
            mode: 查询模式
            **kwargs: 其他参数
            
        Yields:
            响应数据块
        """
        try:
            headers = {
                "LIGHTRAG-WORKSPACE": workspace,
                "Content-Type": "application/json"
            }
            
            payload = {
                "query": query,
                "mode": mode,
                "stream": True,
                **kwargs
            }
            
            with requests.post(
                f"{self.service_url}/query/stream",
                headers=headers,
                json=payload,
                stream=True,
                timeout=120
            ) as response:
                if response.ok:
                    for chunk in response.iter_content(chunk_size=None):
                        if chunk:
                            yield chunk.decode('utf-8')
                else:
                    yield f"Error: HTTP {response.status_code}"
                    
        except Exception as e:
            logger.error(f"流式查询异常: {str(e)}")
            yield f"Error: {str(e)}"
    
    def upload_document(
        self,
        content: str,
        workspace: str = "default",
        filename: str = None
    ) -> Tuple[bool, Any]:
        """
        上传文档到 LightRAG
        
        Args:
            content: 文档内容
            workspace: 目标工作空间
            filename: 文件名（可选）
            
        Returns:
            (success, result) 元组，result 包含 track_id
        """
        try:
            headers = {
                "LIGHTRAG-WORKSPACE": workspace,
                "Content-Type": "application/json"
            }
            
            payload = {
                "text": content
            }
            if filename:
                payload["file_source"] = filename
            
            response = requests.post(
                f"{self.service_url}/documents/text",
                headers=headers,
                json=payload,
                timeout=120
            )
            
            if response.ok:
                result = response.json()
                track_id = result.get('track_id')
                logger.info(f"文档上传成功到 workspace: {workspace}, track_id: {track_id}")
                return True, result
            else:
                error_msg = f"上传失败: HTTP {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg = error_detail.get('detail', error_detail.get('message', error_msg))
                except:
                    pass
                logger.error(error_msg)
                return False, error_msg
                
        except Exception as e:
            error_msg = f"上传异常: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def upload_file(
        self,
        file_path: str,
        workspace: str = "default"
    ) -> Tuple[bool, Any]:
        """
        上传文件到 LightRAG
        
        Args:
            file_path: 文件路径
            workspace: 目标工作空间
            
        Returns:
            (success, result) 元组，result 包含 track_id
        """
        try:
            headers = {
                "LIGHTRAG-WORKSPACE": workspace
            }
            
            with open(file_path, 'rb') as f:
                files = {'file': f}
                response = requests.post(
                    f"{self.service_url}/documents/upload",
                    headers=headers,
                    files=files,
                    timeout=300
                )
            
            if response.ok:
                result = response.json()
                track_id = result.get('track_id')
                logger.info(f"文件上传成功: {file_path}, track_id: {track_id}")
                return True, result
            else:
                error_msg = f"上传失败: HTTP {response.status_code}"
                logger.error(error_msg)
                return False, error_msg
                
        except Exception as e:
            error_msg = f"上传异常: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def get_workspaces(self) -> List[str]:
        """
        获取所有工作空间列表
        
        Returns:
            工作空间名称列表
        """
        try:
            response = requests.get(
                f"{self.service_url}/workspaces",
                timeout=10
            )
            
            if response.ok:
                return response.json()
            else:
                logger.warning(f"获取工作空间列表失败: HTTP {response.status_code}")
                return []
                
        except Exception as e:
            logger.warning(f"获取工作空间列表异常: {str(e)}")
            return []
    
    def get_documents(self, workspace: str = "default") -> List[Dict]:
        """
        获取指定工作空间的文档列表
        
        Args:
            workspace: 工作空间名称
            
        Returns:
            文档列表
        """
        try:
            headers = {
                "LIGHTRAG-WORKSPACE": workspace
            }
            
            response = requests.get(
                f"{self.service_url}/documents",
                headers=headers,
                timeout=30
            )
            
            if response.ok:
                return response.json()
            else:
                logger.warning(f"获取文档列表失败: HTTP {response.status_code}")
                return []
                
        except Exception as e:
            logger.warning(f"获取文档列表异常: {str(e)}")
            return []
    
    def delete_document(
        self,
        document_id: str,
        workspace: str = "default",
        delete_cache: bool = True
    ) -> Tuple[bool, str]:
        """
        删除文档及其关联数据
        
        Args:
            document_id: 文档 ID（通常是文件名）
            workspace: 工作空间名称
            delete_cache: 是否同时删除关联的 LLM 缓存（默认 True）
            
        Returns:
            (success, message) 元组
        """
        try:
            headers = {
                "LIGHTRAG-WORKSPACE": workspace,
                "Content-Type": "application/json"
            }
            
            # 使用新的 delete_document API
            payload = {
                "doc_ids": [document_id],
                "delete_cache": delete_cache
            }
            
            response = requests.delete(
                f"{self.service_url}/documents/delete_document",
                headers=headers,
                json=payload,
                timeout=60
            )
            
            if response.ok:
                result = response.json()
                status = result.get('status', 'unknown')
                if status == 'deletion_started':
                    logger.info(f"文档删除已启动: {document_id}, workspace: {workspace}, delete_cache: {delete_cache}")
                    return True, "文档删除已启动"
                elif status == 'busy':
                    logger.warning(f"LightRAG 管道繁忙，无法删除文档: {document_id}")
                    return False, "LightRAG 管道繁忙，请稍后重试"
                else:
                    logger.info(f"文档删除状态: {status}")
                    return True, f"文档删除状态: {status}"
            else:
                error_msg = f"删除失败: HTTP {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg = f"{error_msg} - {error_detail.get('detail', error_detail)}"
                except:
                    error_msg = f"{error_msg} - {response.text}"
                logger.error(error_msg)
                return False, error_msg
                
        except Exception as e:
            error_msg = f"删除异常: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def clear_cache(self, workspace: str = "default") -> Tuple[bool, str]:
        """
        清理 LLM 响应缓存
        
        Args:
            workspace: 工作空间名称
            
        Returns:
            (success, message) 元组
        """
        try:
            headers = {
                "LIGHTRAG-WORKSPACE": workspace,
                "Content-Type": "application/json"
            }
            
            # 请求体可以为空，API 会忽略
            payload = {}
            
            response = requests.post(
                f"{self.service_url}/documents/clear_cache",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.ok:
                result = response.json()
                logger.info(f"缓存清理成功: workspace={workspace}, result={result}")
                return True, result.get('message', '缓存清理成功')
            else:
                error_msg = f"清理缓存失败: HTTP {response.status_code}"
                logger.error(error_msg)
                return False, error_msg
                
        except Exception as e:
            error_msg = f"清理缓存异常: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def clear_workspace(self, workspace: str = "default") -> Tuple[bool, str]:
        """
        清空工作空间数据
        
        Args:
            workspace: 工作空间名称
            
        Returns:
            (success, message) 元组
        """
        try:
            headers = {
                "LIGHTRAG-WORKSPACE": workspace
            }
            
            response = requests.delete(
                f"{self.service_url}/documents",
                headers=headers,
                timeout=60
            )
            
            if response.ok:
                logger.info(f"工作空间清空成功: {workspace}")
                return True, "工作空间数据已清空"
            else:
                error_msg = f"清空失败: HTTP {response.status_code}"
                logger.error(error_msg)
                return False, error_msg
                
        except Exception as e:
            error_msg = f"清空异常: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def get_graph_data(
        self,
        workspace: str = "default",
        limit: int = 100
    ) -> Tuple[bool, Any]:
        """
        获取知识图谱数据（用于可视化）
        
        Args:
            workspace: 工作空间名称
            limit: 返回节点数量限制
            
        Returns:
            (success, data) 元组
        """
        try:
            headers = {
                "LIGHTRAG-WORKSPACE": workspace
            }
            
            response = requests.get(
                f"{self.service_url}/graph",
                headers=headers,
                params={"limit": limit},
                timeout=30
            )
            
            if response.ok:
                return True, response.json()
            else:
                error_msg = f"获取图谱数据失败: HTTP {response.status_code}"
                logger.error(error_msg)
                return False, error_msg
                
        except Exception as e:
            error_msg = f"获取图谱数据异常: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def get_track_status(
        self,
        track_id: str,
        workspace: str = "default"
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        获取文档处理状态（通过 track_id）
        
        Args:
            track_id: 上传时返回的追踪 ID
            workspace: 工作空间名称
            
        Returns:
            (success, result) 元组
            result: {
                "track_id": "xxx",
                "documents": [...],
                "total_count": 1,
                "status_summary": {"PROCESSED": 1}
            }
        """
        try:
            headers = {
                "LIGHTRAG-WORKSPACE": workspace
            }
            
            response = requests.get(
                f"{self.service_url}/documents/track_status/{track_id}",
                headers=headers,
                timeout=30
            )
            
            if response.ok:
                return True, response.json()
            else:
                error_msg = f"获取处理状态失败: HTTP {response.status_code}"
                logger.error(error_msg)
                return False, {"error": error_msg}
                
        except Exception as e:
            error_msg = f"获取处理状态异常: {str(e)}"
            logger.error(error_msg)
            return False, {"error": error_msg}
    
    def wait_for_processing(
        self,
        track_id: str,
        workspace: str = "default",
        timeout: int = 600,
        poll_interval: int = 5,
        progress_callback: callable = None
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        等待文档处理完成（轮询 track_status）
        
        Args:
            track_id: 上传时返回的追踪 ID
            workspace: 工作空间名称
            timeout: 超时时间（秒），默认 10 分钟
            poll_interval: 轮询间隔（秒），默认 5 秒
            progress_callback: 进度回调函数，签名为 callback(status_summary, documents)
            
        Returns:
            (success, result) 元组
            success: True 表示所有文档处理完成（PROCESSED），False 表示有失败或超时
            result: 最终的 track_status 响应
        """
        import time
        
        start_time = time.time()
        last_status = None
        
        while True:
            elapsed = time.time() - start_time
            if elapsed > timeout:
                logger.warning(f"等待处理超时: track_id={track_id}, elapsed={elapsed}s")
                return False, {
                    "error": "处理超时",
                    "track_id": track_id,
                    "last_status": last_status
                }
            
            # 获取当前状态
            success, result = self.get_track_status(track_id, workspace)
            
            if not success:
                logger.warning(f"获取状态失败，继续等待: {result}")
                time.sleep(poll_interval)
                continue
            
            last_status = result
            status_summary = result.get('status_summary', {})
            documents = result.get('documents', [])
            total_count = result.get('total_count', 0)
            
            # 调用进度回调
            if progress_callback:
                try:
                    progress_callback(status_summary, documents)
                except Exception as e:
                    logger.warning(f"进度回调异常: {e}")
            
            # 检查是否全部完成
            # LightRAG 返回的 status_summary 键可能是 'PROCESSED' 或 'DocStatus.PROCESSED'
            processed_count = status_summary.get('PROCESSED') or status_summary.get('DocStatus.PROCESSED') or 0
            failed_count = status_summary.get('FAILED') or status_summary.get('DocStatus.FAILED') or 0
            
            if processed_count + failed_count >= total_count and total_count > 0:
                # 所有文档都已处理完成（成功或失败）
                if failed_count > 0:
                    logger.warning(f"部分文档处理失败: processed={processed_count}, failed={failed_count}")
                    return False, result
                else:
                    logger.info(f"所有文档处理完成: processed={processed_count}")
                    return True, result
            
            # 记录当前状态
            logger.debug(f"等待处理中: track_id={track_id}, status={status_summary}, elapsed={elapsed:.1f}s")
            
            time.sleep(poll_interval)

