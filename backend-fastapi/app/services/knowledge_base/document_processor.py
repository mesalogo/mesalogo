"""
文档处理服务

负责文档的文本提取、分块处理和向量化
"""

import os
import json
import logging
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class DocumentProcessor:
    """文档处理器"""
    
    def __init__(self):
        self.supported_extensions = {'.txt', '.md', '.json'}
        # TODO: 添加对PDF、Word等格式的支持
    
    def extract_text(self, file_path: str) -> Tuple[bool, str, Dict[str, Any]]:
        """从文件中提取文本"""
        try:
            if not os.path.exists(file_path):
                return False, "文件不存在", {}
            
            ext = os.path.splitext(file_path)[1].lower()
            
            if ext in {'.txt', '.md'}:
                return self._extract_text_file(file_path)
            elif ext == '.json':
                return self._extract_json_file(file_path)
            else:
                return False, f"不支持的文件格式: {ext}", {}
                
        except Exception as e:
            logger.error(f"文本提取失败: {e}")
            return False, f"文本提取失败: {str(e)}", {}
    
    def _extract_text_file(self, file_path: str) -> Tuple[bool, str, Dict[str, Any]]:
        """提取文本文件内容"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            return True, content, {
                'file_type': 'text',
                'char_count': len(content),
                'line_count': content.count('\n') + 1
            }
            
        except UnicodeDecodeError:
            # 尝试其他编码
            try:
                with open(file_path, 'r', encoding='gbk') as f:
                    content = f.read()
                return True, content, {
                    'file_type': 'text',
                    'encoding': 'gbk',
                    'char_count': len(content),
                    'line_count': content.count('\n') + 1
                }
            except Exception:
                return False, "文件编码不支持", {}
    
    def _extract_json_file(self, file_path: str) -> Tuple[bool, str, Dict[str, Any]]:
        """提取JSON文件内容"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 将JSON转换为可读文本
            content = json.dumps(data, ensure_ascii=False, indent=2)
            
            return True, content, {
                'file_type': 'json',
                'char_count': len(content),
                'structure': type(data).__name__
            }
            
        except json.JSONDecodeError as e:
            return False, f"JSON格式错误: {str(e)}", {}
    
    def chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[Dict[str, Any]]:
        """将文本分块"""
        if not text:
            return []
        
        chunks = []
        start = 0
        chunk_id = 0
        
        while start < len(text):
            end = start + chunk_size
            
            # 如果不是最后一块，尝试在句号、换行符等处分割
            if end < len(text):
                # 寻找最近的句号或换行符
                for i in range(end, max(start + chunk_size // 2, end - 100), -1):
                    if text[i] in '.。\n':
                        end = i + 1
                        break
            
            chunk_text = text[start:end].strip()
            if chunk_text:
                chunks.append({
                    'id': chunk_id,
                    'text': chunk_text,
                    'start_pos': start,
                    'end_pos': end,
                    'char_count': len(chunk_text)
                })
                chunk_id += 1
            
            # 计算下一个块的起始位置（考虑重叠）
            start = max(start + 1, end - overlap)
        
        return chunks
    
    def process_document(self, file_path: str, chunk_size: int = 1000, 
                        overlap: int = 200) -> Tuple[bool, Dict[str, Any]]:
        """处理文档：提取文本并分块"""
        try:
            # 提取文本
            success, text, extract_info = self.extract_text(file_path)
            if not success:
                return False, {'error': text}
            
            # 分块处理
            chunks = self.chunk_text(text, chunk_size, overlap)
            
            # 构建处理结果
            result = {
                'file_path': file_path,
                'file_name': os.path.basename(file_path),
                'extract_info': extract_info,
                'text': text,
                'chunks': chunks,
                'chunk_count': len(chunks),
                'total_chars': len(text),
                'processed_at': datetime.utcnow().isoformat()
            }
            
            return True, result
            
        except Exception as e:
            logger.error(f"文档处理失败: {e}")
            return False, {'error': f"文档处理失败: {str(e)}"}


class VectorProcessor:
    """向量处理器"""
    
    def __init__(self):
        pass
    
    def vectorize_chunks(self, chunks: List[Dict[str, Any]], 
                        model_config=None) -> Tuple[bool, List[Dict[str, Any]], Dict[str, Any]]:
        """对文本块进行向量化"""
        try:
            from app.services.vector_db.embedding_service import embedding_service
            
            # 提取文本
            texts = [chunk['text'] for chunk in chunks]
            
            # 生成向量
            success, embeddings, meta_info = embedding_service.generate_embeddings(texts, model_config)
            
            if not success:
                return False, [], {'error': embeddings}
            
            # 将向量添加到块信息中
            vectorized_chunks = []
            for i, chunk in enumerate(chunks):
                vectorized_chunk = chunk.copy()
                vectorized_chunk['embedding'] = embeddings[i] if i < len(embeddings) else None
                vectorized_chunks.append(vectorized_chunk)
            
            return True, vectorized_chunks, meta_info
            
        except Exception as e:
            logger.error(f"向量化处理失败: {e}")
            return False, [], {'error': f"向量化处理失败: {str(e)}"}


class KnowledgeBaseProcessor:
    """知识库处理器"""
    
    def __init__(self):
        self.doc_processor = DocumentProcessor()
        self.vector_processor = VectorProcessor()
    
    def process_file_for_knowledge_base(self, knowledge_id: int, file_path: str, 
                                      chunk_size: int = 1000, overlap: int = 200) -> Tuple[bool, Dict[str, Any]]:
        """为知识库处理文件"""
        try:
            # 1. 文档处理
            success, doc_result = self.doc_processor.process_document(file_path, chunk_size, overlap)
            if not success:
                return False, doc_result
            
            # 2. 向量化处理
            success, vectorized_chunks, vector_info = self.vector_processor.vectorize_chunks(doc_result['chunks'])
            if not success:
                return False, {'error': '向量化处理失败', 'details': vector_info}
            
            # 3. 存储到向量数据库
            from app.services.vector_db_service import get_vector_db_service
            vector_db_service = get_vector_db_service()

            if vector_db_service.is_available():
                # 准备文档数据
                texts = [chunk['text'] for chunk in vectorized_chunks]
                metadatas = [{
                    'chunk_id': chunk['id'],
                    'file_name': doc_result['file_name'],
                    'start_pos': chunk['start_pos'],
                    'end_pos': chunk['end_pos'],
                    'char_count': chunk['char_count']
                } for chunk in vectorized_chunks]
                
                # 添加到向量数据库
                kb_name = f"knowledge_{knowledge_id}"
                success, message, db_info = vector_db_service.add_documents(
                    kb_name, texts, metadatas, source=doc_result['file_name']
                )
                
                if not success:
                    logger.warning(f"向量数据库存储失败: {message}")
            
            # 4. 保存处理结果
            processed_result = {
                'knowledge_id': knowledge_id,
                'file_info': doc_result,
                'vector_info': vector_info,
                'chunks': vectorized_chunks,
                'processing_summary': {
                    'total_chunks': len(vectorized_chunks),
                    'total_chars': doc_result['total_chars'],
                    'vector_dimension': vector_info.get('vector_dimension', 0),
                    'processing_time': vector_info.get('processing_time', 0)
                }
            }
            
            return True, processed_result
            
        except Exception as e:
            logger.error(f"知识库文件处理失败: {e}")
            return False, {'error': f"知识库文件处理失败: {str(e)}"}


# 全局处理器实例
knowledge_processor = KnowledgeBaseProcessor()
