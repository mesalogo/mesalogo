"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: roles_ext.py
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from core.config import settings
from core.dependencies import get_current_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================
# Source: roles_ext.py
# ============================================================

"""
外部角色API路由

处理与外部角色连接测试相关的API请求
"""
import requests
import json

import logging
logger = logging.getLogger(__name__)

# 创建Blueprint


@router.post('/roles/test-external-connection')
async def test_external_connection(request: Request):
    """测试外部角色连接"""
    data = await request.json()

    # 验证必要参数
    platform = data.get('platform')
    if not platform:
        raise HTTPException(status_code=400, detail={'error': '缺少平台类型参数'})

    try:
        # 根据平台类型进行实际连接测试
        if platform == 'dify':
            response_mode = data.get('responseMode', 'blocking')
            if response_mode == 'streaming':
                # 流式响应，返回SSE流
                return test_dify_connection_stream(data)
            else:
                # 阻塞响应，返回JSON
                result = test_dify_connection(data)
                return result

        elif platform == 'openai':
            api_key = data.get('apiKey')
            assistant_id = data.get('assistantId')
            if not api_key or not assistant_id:
                raise HTTPException(status_code=400, detail={'error': '缺少必要的OpenAI配置参数'})
            # TODO: 实现OpenAI连接测试
            return {
                'success': True,
                'message': 'OpenAI平台连接测试成功（模拟）',
                'platform': platform
            }

        elif platform == 'coze':
            # 检查响应模式，Coze优先使用流式
            response_mode = data.get('responseMode', 'streaming')
            if response_mode == 'streaming':
                # 流式响应，返回SSE流
                return test_coze_connection_stream(data)
            else:
                # 阻塞响应，返回JSON
                result = test_coze_connection(data)
                return result

        elif platform == 'fastgpt':
            api_key = data.get('apiKey')
            api_server = data.get('apiServer')
            assistant_id = data.get('assistantId')
            if not api_key or not api_server or not assistant_id:
                raise HTTPException(status_code=400, detail={'error': '缺少必要的FastGPT配置参数'})

            # 检查响应模式
            response_mode = data.get('responseMode', 'blocking')
            if response_mode == 'streaming':
                # 流式响应，返回SSE流
                return test_fastgpt_connection_stream(data)
            else:
                # 阻塞响应，返回JSON
                result = test_fastgpt_connection(data)
                return result

        elif platform == 'custom':
            # 自定义平台连接测试
            result = test_custom_connection(data)
            return result

        else:
            raise HTTPException(status_code=400, detail={'error': f'不支持的平台类型: {platform}'})

    except Exception as e:
        raise HTTPException(status_code=500, detail={'error': f'连接测试失败: {str(e)}'})


def test_coze_connection(data):
    """测试Coze平台连接（非流式）"""
    api_key = data.get('apiKey')
    api_server = data.get('apiServer', 'https://api.coze.cn')
    bot_id = data.get('botId')
    user_id = data.get('userIdentifier', 'test_user')
    timeout = data.get('timeout', 60)

    if not api_key or not bot_id:
        return {'error': '缺少必要的Coze配置参数'}

    # 验证URL格式
    if not api_server.startswith(('http://', 'https://')):
        return {'error': '请输入完整的URL地址，必须以http://或https://开头'}

    # 移除末尾的斜杠
    api_server = api_server.rstrip('/')

    try:
        # 构建测试请求
        test_query = "你好！请简单介绍一下你自己，这是一个连接测试。"
        endpoint = f"{api_server}/v3/chat"

        test_payload = {
            "bot_id": bot_id,
            "user_id": user_id,
            "stream": False,
            "additional_messages": [
                {
                    "content": test_query,
                    "content_type": "text",
                    "role": "user",
                    "type": "question"
                }
            ],
            "parameters": {}
        }

        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

        logger.info(f"测试Coze连接: {endpoint}")
        logger.info(f"请求体: {test_payload}")

        # 发送测试请求
        response = requests.post(
            endpoint,
            json=test_payload,
            headers=headers,
            timeout=timeout
        )

        logger.info(f"响应状态码: {response.status_code}")
        logger.info(f"响应内容: {response.text}")

        if response.status_code == 200:
            result = response.json()
            if result.get('code') == 0:
                return {
                    'success': True,
                    'message': 'Coze平台连接测试成功',
                    'platform': 'coze',
                    'test_output': f"状态: {result.get('data', {}).get('status', 'unknown')}"
                }
            else:
                error_msg = result.get('msg', '未知错误')
                return {
                    'success': False,
                    'error': f'Coze API错误: {error_msg}'
                }
        else:
            return {
                'success': False,
                'error': f'HTTP错误 {response.status_code}: {response.text}'
            }

    except requests.exceptions.Timeout:
        return {
            'success': False,
            'error': f'连接超时（{timeout}秒），请检查网络连接或增加超时时间'
        }
    except requests.exceptions.ConnectionError:
        return {
            'success': False,
            'error': '无法连接到Coze服务器，请检查网络连接和服务器地址'
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'连接测试失败: {str(e)}'
        }


def test_coze_connection_stream(data):
    """测试Coze平台连接（流式）"""
    api_key = data.get('apiKey')
    api_server = data.get('apiServer', 'https://api.coze.cn')
    bot_id = data.get('botId')
    user_id = data.get('userIdentifier', 'test_user')
    timeout = data.get('timeout', 60)

    if not api_key or not bot_id:
        def error_generator():
            yield f"data: {json.dumps({'error': '缺少必要的Coze配置参数'})}\n\n"
        return StreamingResponse(error_generator(), media_type='text/event-stream')

    # 验证URL格式
    if not api_server.startswith(('http://', 'https://')):
        def error_generator():
            yield f"data: {json.dumps({'error': '请输入完整的URL地址，必须以http://或https://开头'})}\n\n"
        return StreamingResponse(error_generator(), media_type='text/event-stream')

    def generate():
        try:
            # 移除末尾的斜杠
            api_server_clean = api_server.rstrip('/')

            # 构建测试请求
            test_query = "你好！请简单介绍一下你自己，这是一个连接测试。"
            endpoint = f"{api_server_clean}/v3/chat"

            test_payload = {
                "bot_id": bot_id,
                "user_id": user_id,
                "stream": True,
                "additional_messages": [
                    {
                        "content": test_query,
                        "content_type": "text",
                        "role": "user",
                        "type": "question"
                    }
                ],
                "parameters": {}
            }

            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            }

            logger.info(f"测试Coze流式连接: {endpoint}")
            logger.info(f"请求体: {test_payload}")

            # 发送流式请求
            response = requests.post(
                endpoint,
                json=test_payload,
                headers=headers,
                stream=True,
                timeout=timeout
            )

            logger.info(f"响应状态码: {response.status_code}")

            if response.status_code == 200:
                yield f"data: {json.dumps({'status': 'connected', 'message': 'Coze连接成功，开始接收响应...'})}\n\n"

                full_content = ""
                line_count = 0
                max_lines = 100  # 防止无限循环

                for line in response.iter_lines():
                    line_count += 1
                    if line_count > max_lines:
                        logger.info(f"达到最大行数限制 {max_lines}，强制结束")
                        break

                    if line:
                        line_str = line.decode('utf-8')
                        logger.info(f"原始响应行: {line_str}")

                        # 处理SSE格式
                        if line_str.startswith('data:'):
                            data_str = line_str[5:].strip()

                            if data_str == '[DONE]' or data_str == '"[DONE]"':
                                yield f"data: {json.dumps({'status': 'completed', 'message': '测试完成', 'full_content': full_content, 'type': 'done'})}\n\n"
                                return

                            try:
                                chunk_data = json.loads(data_str)

                                # 提取内容
                                if chunk_data.get('type') == 'answer' and 'content' in chunk_data:
                                    content = chunk_data.get('content', '')
                                    if content:
                                        full_content += content
                                        yield f"data: {json.dumps({'content': content, 'type': 'chunk'})}\n\n"

                            except json.JSONDecodeError:
                                continue

                # 如果没有收到DONE信号，手动结束
                if full_content:
                    yield f"data: {json.dumps({'status': 'completed', 'message': 'Coze连接测试成功', 'full_content': full_content, 'type': 'done'})}\n\n"
                else:
                    yield f"data: {json.dumps({'status': 'completed', 'message': 'Coze连接成功但未收到内容', 'type': 'done'})}\n\n"
            else:
                error_msg = f"HTTP错误 {response.status_code}: {response.text}"
                yield f"data: {json.dumps({'error': error_msg})}\n\n"

        except requests.exceptions.Timeout:
            yield f"data: {json.dumps({'error': f'连接超时（{timeout}秒），请检查网络连接或增加超时时间'})}\n\n"
        except requests.exceptions.ConnectionError:
            yield f"data: {json.dumps({'error': '无法连接到Coze服务器，请检查网络连接和服务器地址'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': f'连接测试失败: {str(e)}'})}\n\n"

    return StreamingResponse(generate(), media_type='text/event-stream')


def test_dify_connection(data):
    """测试Dify平台连接"""
    api_key = data.get('apiKey')
    api_server = data.get('apiServer')
    timeout = data.get('timeout', 60)

    if not api_key or not api_server:
        return {'error': '缺少必要的Dify配置参数'}

    # 直接使用用户提供的API服务器地址
    if not api_server.startswith(('http://', 'https://')):
        return {'error': '请输入完整的URL地址，必须以http://或https://开头'}

    # 移除末尾的斜杠
    api_server = api_server.rstrip('/')

    try:
        # 简化测试逻辑，统一使用 chat-messages 端点进行连接测试
        test_query = "你好！请简单介绍一下你自己，这是一个连接测试。"

        # 使用最通用的 chat-messages 端点
        endpoint = f"{api_server}/chat-messages"
        test_payload = {
            "inputs": {},
            "query": test_query,
            "response_mode": "blocking",  # 阻塞模式
            "conversation_id": "",
            "user": "connection_test"
        }

        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

        logger.info(f"原始API服务器: {data.get('apiServer')}")
        logger.info(f"处理后的API服务器: {api_server}")
        logger.info(f"测试Dify连接: {endpoint}")
        logger.info(f"超时设置: {timeout}秒")
        logger.info(f"请求头: {headers}")
        logger.info(f"请求体: {test_payload}")

        # 先测试基础连接
        try:
            base_response = requests.get(api_server, timeout=min(timeout, 30))  # 基础连接测试最多30秒
            logger.info(f"基础连接测试 - 状态码: {base_response.status_code}")
        except Exception as e:
            logger.error(f"基础连接测试失败: {e}")

        # 发送测试请求
        response = requests.post(
            endpoint,
            json=test_payload,
            headers=headers,
            timeout=timeout  # 使用角色设置中的超时时间
        )

        logger.info(f"响应状态码: {response.status_code}")

        if response.status_code == 200:
            # 解析响应内容
            logger.info(f"响应内容: {response.text}")
            response_data = response.json()
            logger.info(f"完整响应数据: {response_data}")

            # 解析阻塞响应
            test_response = parse_dify_blocking_response(response_data)

            return {
                'success': True,
                'message': 'Dify应用连接测试成功',
                'platform': 'dify',
                'test_input': test_query,
                'test_output': test_response[:500] + ('...' if len(test_response) > 500 else ''),
                'endpoint': endpoint
            }
        else:
            error_msg = f"API请求失败 (状态码: {response.status_code})"
            try:
                error_data = response.json()
                if 'message' in error_data:
                    error_msg = error_data['message']
                elif 'error' in error_data:
                    if isinstance(error_data['error'], dict):
                        error_msg += f": {error_data['error'].get('message', str(error_data['error']))}"
                    else:
                        error_msg += f": {error_data['error']}"
            except:
                error_msg += f": {response.text}"

            return {'error': error_msg}

    except requests.exceptions.Timeout:
        return {'error': 'Dify API请求超时，请检查网络连接和服务器地址'}
    except requests.exceptions.ConnectionError:
        return {'error': 'Dify API连接失败，请检查服务器地址是否正确'}
    except Exception as e:
        return {'error': f'Dify连接测试失败: {str(e)}'}


def parse_dify_blocking_response(response_data):
    """解析Dify阻塞响应"""
    try:
        # Dify阻塞响应格式
        if 'answer' in response_data:
            return response_data['answer']
        elif 'data' in response_data and 'answer' in response_data['data']:
            return response_data['data']['answer']
        elif 'message' in response_data:
            return response_data['message']
        else:
            return f"收到响应但格式异常: {response_data}"
    except Exception as e:
        logger.error(f"解析阻塞响应失败: {e}")
        return f"阻塞响应解析失败: {str(e)}"


def test_dify_connection_stream(data):
    """测试Dify平台连接（流式响应）"""
    api_key = data.get('apiKey')
    api_server = data.get('apiServer')
    timeout = data.get('timeout', 60)

    if not api_key or not api_server:
        # 返回错误的SSE格式
        def error_generator():
            yield f"data: {json.dumps({'error': '缺少必要的Dify配置参数'})}\n\n"
        return StreamingResponse(error_generator(), media_type='text/event-stream')

    # 直接使用用户提供的API服务器地址
    if not api_server.startswith(('http://', 'https://')):
        def error_generator():
            yield f"data: {json.dumps({'error': '请输入完整的URL地址，必须以http://或https://开头'})}\n\n"
        return StreamingResponse(error_generator(), media_type='text/event-stream')

    # 移除末尾的斜杠
    api_server = api_server.rstrip('/')

    def stream_generator():
        try:
            # 构建测试请求
            test_query = "你好！请简单介绍一下你自己，这是一个连接测试。"
            endpoint = f"{api_server}/chat-messages"
            test_payload = {
                "inputs": {},
                "query": test_query,
                "response_mode": "streaming",
                "conversation_id": "",
                "user": "connection_test"
            }

            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            }

            logger.info(f"流式测试Dify连接: {endpoint}")
            logger.info(f"请求体: {test_payload}")

            # 发送流式请求
            response = requests.post(
                endpoint,
                json=test_payload,
                headers=headers,
                stream=True,
                timeout=timeout
            )

            logger.info(f"流式响应状态码: {response.status_code}")

            if response.status_code == 200:
                # 发送成功状态
                yield f"data: {json.dumps({'status': 'connected', 'message': 'Dify连接成功，开始接收响应...'})}\n\n"

                # 使用Dify适配器解析流式响应
                from app.services.conversation.adapters.dify_adapter import DifyAdapter
                temp_adapter = DifyAdapter({})

                # 逐行处理流式响应
                for line in response.iter_lines(decode_unicode=True):
                    if not line:
                        continue

                    logger.info(f"收到流式数据行: {line}")

                    # 解析响应块
                    content, meta = temp_adapter.parse_streaming_chunk(line)

                    if content:
                        # 发送内容块
                        yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
                        logger.info(f"发送内容: {content}")

                    if meta and meta.get('type') == 'done':
                        # 发送完成信号
                        yield f"data: {json.dumps({'type': 'done', 'message': '流式响应完成'})}\n\n"
                        logger.info("流式响应结束")
                        break

            else:
                # 发送错误信息
                try:
                    error_data = response.json()
                    error_msg = error_data.get('message', f'API请求失败 (状态码: {response.status_code})')
                except:
                    error_msg = f'API请求失败 (状态码: {response.status_code}): {response.text}'

                yield f"data: {json.dumps({'error': error_msg})}\n\n"

        except requests.exceptions.Timeout:
            yield f"data: {json.dumps({'error': 'Dify API请求超时，请检查网络连接和服务器地址'})}\n\n"
        except requests.exceptions.ConnectionError:
            yield f"data: {json.dumps({'error': 'Dify API连接失败，请检查服务器地址是否正确'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': f'Dify连接测试失败: {str(e)}'})}\n\n"

    return StreamingResponse(stream_generator(), media_type='text/event-stream')


def test_fastgpt_connection(data):
    """测试FastGPT平台连接"""
    api_key = data.get('apiKey')
    api_server = data.get('apiServer')
    assistant_id = data.get('assistantId')
    timeout = data.get('timeout', 60)

    if not api_key or not api_server or not assistant_id:
        return {'error': '缺少必要的FastGPT配置参数'}

    # 验证API密钥格式
    if not (api_key.startswith('fastgpt-') or api_key.startswith('app-')):
        return {'error': 'API密钥格式不正确，应以"fastgpt-"或"app-"开头。请使用应用特定的API密钥，而不是账户密钥。'}

    # 验证URL格式
    if not api_server.startswith(('http://', 'https://')):
        return {'error': '请输入完整的URL地址，必须以http://或https://开头'}

    # 移除末尾的斜杠
    api_server = api_server.rstrip('/')

    try:
        # FastGPT使用OpenAI兼容的端点
        test_query = "你好！请简单介绍一下你自己，这是一个连接测试。"

        # 智能处理API端点
        if api_server.endswith('/chat/completions'):
            endpoint = api_server
        elif api_server.endswith('/v1'):
            endpoint = f"{api_server}/chat/completions"
        elif api_server.endswith('/api'):
            endpoint = f"{api_server}/v1/chat/completions"
        else:
            # 假设用户提供的是基础URL
            endpoint = f"{api_server}/api/v1/chat/completions"

        # 构建OpenAI兼容的请求
        test_payload = {
            "messages": [
                {"role": "user", "content": test_query}
            ],
            "stream": False
        }

        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

        logger.info(f"测试FastGPT连接: {endpoint}")
        logger.info(f"应用ID: {assistant_id}")
        logger.info(f"超时设置: {timeout}秒")
        logger.info(f"请求头: {headers}")
        logger.info(f"请求体: {test_payload}")

        # 发送测试请求
        response = requests.post(
            endpoint,
            json=test_payload,
            headers=headers,
            timeout=timeout
        )

        logger.info(f"响应状态码: {response.status_code}")

        if response.status_code == 200:
            # 解析OpenAI格式的响应
            logger.info(f"响应内容: {response.text}")
            response_data = response.json()
            logger.info(f"完整响应数据: {response_data}")

            # 使用FastGPT适配器解析响应
            from app.services.conversation.adapters.fastgpt_adapter import FastGPTAdapter
            # 创建临时适配器用于解析响应，使用正确的配置结构
            temp_config = {
                'settings': {
                    'external_config': {
                        'api_config': {
                            'api_key': api_key,
                            'base_url': api_server
                        },
                        'external_id': assistant_id
                    }
                }
            }
            temp_adapter = FastGPTAdapter(temp_config)
            test_response = temp_adapter.parse_response(response_data)

            return {
                'success': True,
                'message': 'FastGPT应用连接测试成功',
                'platform': 'fastgpt',
                'test_input': test_query,
                'test_output': test_response[:500] + ('...' if len(test_response) > 500 else ''),
                'app_id': assistant_id
            }
        else:
            error_msg = f"API请求失败 (状态码: {response.status_code})"
            try:
                error_data = response.json()
                if 'message' in error_data:
                    error_msg = error_data['message']
                    # 处理FastGPT特定错误
                    if "Key is error" in error_msg and "app key" in error_msg:
                        error_msg = "API密钥错误：请使用应用特定的API密钥，而不是账户密钥。请在FastGPT应用详情页面获取正确的API密钥。"
                elif 'error' in error_data:
                    if isinstance(error_data['error'], dict):
                        error_msg += f": {error_data['error'].get('message', str(error_data['error']))}"
                    else:
                        error_msg += f": {error_data['error']}"
            except:
                error_msg += f": {response.text}"

            return {'error': error_msg}

    except requests.exceptions.Timeout:
        return {'error': 'FastGPT API请求超时，请检查网络连接和服务器地址'}
    except requests.exceptions.ConnectionError:
        return {'error': 'FastGPT API连接失败，请检查服务器地址是否正确'}
    except Exception as e:
        return {'error': f'FastGPT连接测试失败: {str(e)}'}


def test_fastgpt_connection_stream(data):
    """测试FastGPT平台连接（流式响应）"""
    api_key = data.get('apiKey')
    api_server = data.get('apiServer')
    assistant_id = data.get('assistantId')
    timeout = data.get('timeout', 60)

    if not api_key or not api_server or not assistant_id:
        # 返回错误的SSE格式
        def error_generator():
            yield f"data: {json.dumps({'error': '缺少必要的FastGPT配置参数'})}\n\n"
        return StreamingResponse(error_generator(), media_type='text/event-stream')

    # 验证API密钥格式
    if not (api_key.startswith('fastgpt-') or api_key.startswith('app-')):
        def error_generator():
            error_msg = 'API密钥格式不正确，应以"fastgpt-"或"app-"开头'
            yield f"data: {json.dumps({'error': error_msg})}\n\n"
        return StreamingResponse(error_generator(), media_type='text/event-stream')

    # 验证URL格式
    if not api_server.startswith(('http://', 'https://')):
        def error_generator():
            yield f"data: {json.dumps({'error': '请输入完整的URL地址，必须以http://或https://开头'})}\n\n"
        return StreamingResponse(error_generator(), media_type='text/event-stream')

    # 移除末尾的斜杠
    api_server = api_server.rstrip('/')

    def stream_generator():
        try:
            # 构建测试请求
            test_query = "你好！请简单介绍一下你自己，这是一个连接测试。"

            # 智能处理API端点
            if api_server.endswith('/chat/completions'):
                endpoint = api_server
            elif api_server.endswith('/v1'):
                endpoint = f"{api_server}/chat/completions"
            elif api_server.endswith('/api'):
                endpoint = f"{api_server}/v1/chat/completions"
            else:
                # 假设用户提供的是基础URL
                endpoint = f"{api_server}/api/v1/chat/completions"

            # 构建OpenAI兼容的请求
            test_payload = {
                "messages": [
                    {"role": "user", "content": test_query}
                ],
                "stream": True  # 启用流式响应
            }

            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            }

            logger.info(f"流式测试FastGPT连接: {endpoint}")
            logger.info(f"应用ID: {assistant_id}")
            logger.info(f"请求体: {test_payload}")

            # 发送流式请求
            response = requests.post(
                endpoint,
                json=test_payload,
                headers=headers,
                stream=True,
                timeout=timeout
            )

            logger.info(f"流式响应状态码: {response.status_code}")

            if response.status_code == 200:
                # 发送成功状态
                yield f"data: {json.dumps({'status': 'connected', 'message': 'FastGPT连接成功，开始接收响应...'})}\n\n"

                # 使用FastGPT适配器解析流式响应
                # 创建临时适配器用于解析响应，使用正确的配置结构
                temp_config = {
                    'settings': {
                        'external_config': {
                            'api_config': {
                                'api_key': api_key,
                                'base_url': api_server
                            },
                            'external_id': assistant_id
                        }
                    }
                }
                temp_adapter = FastGPTAdapter(temp_config)

                # 逐行处理流式响应
                for line in response.iter_lines(decode_unicode=True):
                    if not line:
                        continue

                    logger.info(f"收到流式数据行: {line}")

                    # 解析响应块
                    content, meta = temp_adapter.parse_streaming_chunk(line)

                    if content:
                        # 发送内容块
                        yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
                        logger.info(f"发送内容: {content}")

                    if meta and meta.get('finish_reason'):
                        # 发送完成信号
                        yield f"data: {json.dumps({'type': 'done', 'message': '流式响应完成'})}\n\n"
                        logger.info("流式响应结束")
                        break

            else:
                # 发送错误信息
                try:
                    error_data = response.json()
                    error_msg = error_data.get('message', f'API请求失败 (状态码: {response.status_code})')
                    # 处理FastGPT特定错误
                    if "Key is error" in error_msg and "app key" in error_msg:
                        error_msg = "API密钥错误：请使用应用特定的API密钥，而不是账户密钥"
                except:
                    error_msg = f'API请求失败 (状态码: {response.status_code}): {response.text}'

                yield f"data: {json.dumps({'error': error_msg})}\n\n"

        except requests.exceptions.Timeout:
            yield f"data: {json.dumps({'error': 'FastGPT API请求超时，请检查网络连接和服务器地址'})}\n\n"
        except requests.exceptions.ConnectionError:
            yield f"data: {json.dumps({'error': 'FastGPT API连接失败，请检查服务器地址是否正确'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': f'FastGPT连接测试失败: {str(e)}'})}\n\n"

    return StreamingResponse(stream_generator(), media_type='text/event-stream')


def test_custom_connection(data):
    """测试自定义平台连接"""
    # TODO: 实现自定义平台连接测试
    return {
        'success': True,
        'message': '自定义平台连接测试成功（模拟）',
        'platform': 'custom'
    }

