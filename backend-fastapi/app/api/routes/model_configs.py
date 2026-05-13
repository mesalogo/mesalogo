"""
模型配置API路由

处理与模型配置相关的所有API请求

Flask → FastAPI 变更:
- Blueprint → APIRouter
- request.args.get() → Query()
- request.get_json() → await request.json()
- jsonify(data) → 直接返回 dict
- jsonify(data), 4xx → HTTPException
- Response(stream_with_context(generate()), mimetype=...) → StreamingResponse(generate(), media_type=...)
"""
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from app.models import ModelConfig, db
import json
import logging

router = APIRouter()

# 设置日志
logger = logging.getLogger(__name__)


@router.get('/model-configs')
def get_model_configs(
    include_api_keys: str = Query('false'),
):
    """获取所有模型配置"""
    # 检查是否需要返回真实API密钥
    include_keys = include_api_keys.lower() == 'true'

    configs = ModelConfig.query.all()
    result = []

    for config in configs:
        # 如果需要返回真实API密钥则返回，否则返回掩码或None
        if include_keys:
            api_key = config.api_key
        else:
            api_key = "********" if config.api_key else None

        result.append({
            'id': config.id,
            'name': config.name,
            'provider': config.provider,
            'model_id': config.model_id,
            'base_url': config.base_url,
            'api_key': api_key,
            'context_window': config.context_window,
            'max_output_tokens': config.max_output_tokens,
            'request_timeout': config.request_timeout,
            'is_default_text': getattr(config, 'is_default_text', False),
            'is_default_embedding': getattr(config, 'is_default_embedding', False),
            'is_default_rerank': getattr(config, 'is_default_rerank', False),
            'modalities': config.modalities,
            'capabilities': config.capabilities,
            'additional_params': config.additional_params,
            'format_compatibility': config.format_compatibility or 'openai',
            'created_at': config.created_at.isoformat(),
            'updated_at': config.updated_at.isoformat()
        })

    return {'model_configs': result}


@router.get('/model-configs/defaults')
def get_default_models():
    """获取当前的默认模型配置"""
    try:
        # 获取默认文本生成模型
        text_model = ModelConfig.query.filter_by(is_default_text=True).first()

        # 获取默认嵌入模型
        embedding_model = ModelConfig.query.filter_by(is_default_embedding=True).first()

        # 获取默认重排序模型
        rerank_model = ModelConfig.query.filter_by(is_default_rerank=True).first()

        # 如果没有设置默认文本生成模型，查找第一个支持文本输出的模型
        if not text_model:
            text_models = ModelConfig.query.filter(
                ModelConfig.modalities.contains('text_output')
            ).all()
            if text_models:
                text_model = text_models[0]

        result = {}

        if text_model:
            result['text_model'] = {
                'id': text_model.id,
                'name': text_model.name,
                'provider': text_model.provider,
                'model_id': text_model.model_id
            }

        if embedding_model:
            result['embedding_model'] = {
                'id': embedding_model.id,
                'name': embedding_model.name,
                'provider': embedding_model.provider,
                'model_id': embedding_model.model_id
            }

        if rerank_model:
            result['rerank_model'] = {
                'id': rerank_model.id,
                'name': rerank_model.name,
                'provider': rerank_model.provider,
                'model_id': rerank_model.model_id
            }

        return result

    except Exception as e:
        logger.error(f"获取默认模型失败: {e}")
        raise HTTPException(status_code=500, detail=f'Failed to get default models: {str(e)}')


@router.get('/model-configs/{config_id}')
def get_model_config(
    config_id: str,
    include_api_keys: str = Query('false'),
):
    """获取特定模型配置详情"""
    # 检查是否需要返回真实API密钥
    include_keys = include_api_keys.lower() == 'true'

    config = ModelConfig.query.get(config_id)
    if not config:
        raise HTTPException(status_code=404, detail='Model configuration not found')

    # 如果需要返回真实API密钥则返回，否则返回掩码或None
    if include_keys:
        api_key = config.api_key
    else:
        api_key = "********" if config.api_key else None

    return {
        'id': config.id,
        'name': config.name,
        'provider': config.provider,
        'model_id': config.model_id,
        'base_url': config.base_url,
        'api_key': api_key,
        'context_window': config.context_window,
        'max_output_tokens': config.max_output_tokens,
        'request_timeout': config.request_timeout,
        'is_default_text': getattr(config, 'is_default_text', False),
        'is_default_embedding': getattr(config, 'is_default_embedding', False),
        'is_default_rerank': getattr(config, 'is_default_rerank', False),
        'modalities': config.modalities,
        'capabilities': config.capabilities,
        'additional_params': config.additional_params,
        'format_compatibility': config.format_compatibility or 'openai',
        'created_at': config.created_at.isoformat(),
        'updated_at': config.updated_at.isoformat()
    }


@router.post('/model-configs', status_code=201)
async def create_model_config(request: Request):
    """创建新模型配置"""
    data = await request.json()

    # 验证必填字段
    required_fields = ['name', 'provider', 'model_id']
    for field in required_fields:
        if field not in data:
            raise HTTPException(status_code=400, detail=f'Missing required field: {field}')

    # 验证数值字段的范围
    if 'context_window' in data:
        context_window = data.get('context_window')
        if context_window is not None and context_window < 1:
            raise HTTPException(status_code=400, detail='context_window must be at least 1')

    if 'max_output_tokens' in data:
        max_output_tokens = data.get('max_output_tokens')
        if max_output_tokens is not None and max_output_tokens < 1:
            raise HTTPException(status_code=400, detail='max_output_tokens must be at least 1')

    if 'request_timeout' in data:
        request_timeout = data.get('request_timeout')
        if request_timeout is not None and (request_timeout < 10 or request_timeout > 300):
            raise HTTPException(status_code=400, detail='request_timeout must be between 10 and 300 seconds')

    # 如果设置为默认文本生成模型，需要更新其他文本生成模型
    if data.get('is_default_text'):
        existing_text_defaults = ModelConfig.query.filter_by(is_default_text=True).all()
        for model in existing_text_defaults:
            model.is_default_text = False
        db.session.commit()

    # 如果设置为默认嵌入模型，需要更新其他嵌入模型
    if data.get('is_default_embedding'):
        existing_embedding_defaults = ModelConfig.query.filter_by(is_default_embedding=True).all()
        for model in existing_embedding_defaults:
            model.is_default_embedding = False
        db.session.commit()

    # 创建新的模型配置
    new_config = ModelConfig(
        name=data['name'],
        provider=data['provider'],
        model_id=data['model_id'],
        base_url=data.get('base_url'),
        api_key=data.get('api_key'),
        context_window=data.get('context_window', 16000),
        max_output_tokens=data.get('max_output_tokens', 2000),
        request_timeout=data.get('request_timeout', 60),
        is_default_text=data.get('is_default_text', False),
        is_default_embedding=data.get('is_default_embedding', False),
        modalities=data.get('modalities', []),
        capabilities=data.get('capabilities', []),
        additional_params=data.get('additional_params', {}),
        format_compatibility=data.get('format_compatibility', 'openai')
    )

    db.session.add(new_config)
    db.session.commit()

    return {
        'id': new_config.id,
        'name': new_config.name,
        'provider': new_config.provider,
        'model_id': new_config.model_id,
        'is_default_text': new_config.is_default_text,
        'is_default_embedding': new_config.is_default_embedding,
        'is_default_rerank': getattr(new_config, 'is_default_rerank', False),
        'modalities': new_config.modalities,
        'capabilities': new_config.capabilities,
        'created_at': new_config.created_at.isoformat()
    }


@router.put('/model-configs/{config_id}')
async def update_model_config(config_id: str, request: Request):
    """更新模型配置"""
    config = ModelConfig.query.get(config_id)
    if not config:
        raise HTTPException(status_code=404, detail='Model configuration not found')

    data = await request.json()

    # 验证数值字段的范围
    if 'context_window' in data:
        context_window = data.get('context_window')
        if context_window is not None and context_window < 1:
            raise HTTPException(status_code=400, detail='context_window must be at least 1')

    if 'max_output_tokens' in data:
        max_output_tokens = data.get('max_output_tokens')
        if max_output_tokens is not None and max_output_tokens < 1:
            raise HTTPException(status_code=400, detail='max_output_tokens must be at least 1')

    if 'request_timeout' in data:
        request_timeout = data.get('request_timeout')
        if request_timeout is not None and (request_timeout < 10 or request_timeout > 300):
            raise HTTPException(status_code=400, detail='request_timeout must be between 10 and 300 seconds')

    # 如果设置为默认文本生成模型，需要更新其他文本生成模型
    if data.get('is_default_text') and not getattr(config, 'is_default_text', False):
        existing_text_defaults = ModelConfig.query.filter_by(is_default_text=True).all()
        for model in existing_text_defaults:
            model.is_default_text = False
        db.session.commit()

    # 如果设置为默认嵌入模型，需要更新其他嵌入模型
    if data.get('is_default_embedding') and not getattr(config, 'is_default_embedding', False):
        existing_embedding_defaults = ModelConfig.query.filter_by(is_default_embedding=True).all()
        for model in existing_embedding_defaults:
            model.is_default_embedding = False
        db.session.commit()

    # 更新模型配置
    for key, value in data.items():
        if hasattr(config, key) and key != 'id':
            setattr(config, key, value)

    db.session.commit()



    return {
        'id': config.id,
        'name': config.name,
        'provider': config.provider,
        'model_id': config.model_id,
        'base_url': config.base_url,
        'context_window': config.context_window,
        'max_output_tokens': config.max_output_tokens,
        'request_timeout': config.request_timeout,
        'is_default_text': getattr(config, 'is_default_text', False),
        'is_default_embedding': getattr(config, 'is_default_embedding', False),
        'is_default_rerank': getattr(config, 'is_default_rerank', False),
        'modalities': config.modalities,
        'capabilities': config.capabilities,
        'format_compatibility': config.format_compatibility or 'openai',
        'updated_at': config.updated_at.isoformat()
    }


@router.delete('/model-configs/{config_id}')
def delete_model_config(config_id: str):
    """删除模型配置"""
    config = ModelConfig.query.get(config_id)
    if not config:
        raise HTTPException(status_code=404, detail='Model configuration not found')

    db.session.delete(config)
    db.session.commit()

    return {'message': 'Model configuration deleted successfully'}


@router.post('/model-configs/set-defaults')
async def set_default_models(request: Request):
    """设置默认模型配置（支持分别设置文本生成、嵌入和重排序模型）"""
    data = await request.json()

    if not data:
        raise HTTPException(status_code=400, detail='No data provided')

    text_model_id = data.get('text_model_id')
    embedding_model_id = data.get('embedding_model_id')
    rerank_model_id = data.get('rerank_model_id')

    if not text_model_id and not embedding_model_id and not rerank_model_id:
        raise HTTPException(status_code=400, detail='At least one model type must be specified')

    try:
        # 设置默认文本生成模型
        if text_model_id:
            text_config = ModelConfig.query.get(text_model_id)
            if not text_config:
                raise HTTPException(status_code=404, detail=f'Text model configuration {text_model_id} not found')

            # 检查模型是否支持文本输出
            modalities = text_config.modalities or []
            if 'text_output' not in modalities:
                raise HTTPException(status_code=400, detail='Selected text model does not support text output')

            # 清除其他模型的默认文本生成标记
            all_configs = ModelConfig.query.all()
            for model in all_configs:
                if hasattr(model, 'is_default_text'):
                    model.is_default_text = (model.id == text_model_id)

        # 设置默认嵌入模型
        if embedding_model_id:
            embedding_config = ModelConfig.query.get(embedding_model_id)
            if not embedding_config:
                raise HTTPException(status_code=404, detail=f'Embedding model configuration {embedding_model_id} not found')

            # 检查模型是否支持向量输出
            modalities = embedding_config.modalities or []
            if 'vector_output' not in modalities:
                raise HTTPException(status_code=400, detail='Selected embedding model does not support vector output')

            # 清除其他模型的默认嵌入标记
            all_configs = ModelConfig.query.all()
            for model in all_configs:
                if hasattr(model, 'is_default_embedding'):
                    model.is_default_embedding = (model.id == embedding_model_id)

        # 设置默认重排序模型
        if rerank_model_id:
            rerank_config = ModelConfig.query.get(rerank_model_id)
            if not rerank_config:
                raise HTTPException(status_code=404, detail=f'Rerank model configuration {rerank_model_id} not found')

            # 检查模型是否支持重排序输出
            modalities = rerank_config.modalities or []
            if 'rerank_output' not in modalities:
                raise HTTPException(status_code=400, detail='Selected rerank model does not support rerank output')

            # 清除其他模型的默认重排序标记
            all_configs = ModelConfig.query.all()
            for model in all_configs:
                if hasattr(model, 'is_default_rerank'):
                    model.is_default_rerank = (model.id == rerank_model_id)

        db.session.commit()

        result = {'message': 'Default models updated successfully'}
        if text_model_id:
            result['text_model'] = {
                'id': text_config.id,
                'name': text_config.name
            }
        if embedding_model_id:
            result['embedding_model'] = {
                'id': embedding_config.id,
                'name': embedding_config.name
            }
        if rerank_model_id:
            result['rerank_model'] = {
                'id': rerank_config.id,
                'name': rerank_config.name
            }

        return result

    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        logger.error(f"设置默认模型失败: {e}")
        raise HTTPException(status_code=500, detail=f'Failed to set default models: {str(e)}')


@router.get('/model-configs/{config_id}/has-api-key')
def check_api_key(config_id: str):
    """检查模型配置是否有API密钥"""
    config = ModelConfig.query.get(config_id)
    if not config:
        raise HTTPException(status_code=404, detail='Model configuration not found')

    has_key = bool(config.api_key)

    return {
        'id': config.id,
        'has_api_key': has_key
    }


@router.post('/model-configs/{config_id}/test-stream')
async def sse_test_model_config(config_id: str, request: Request):
    """使用SSE (Server-Sent Events) 提供流式模型测试API"""
    import queue
    import threading
    import sys
    import time
    import json as json_mod

    from app.models import ModelConfig
    from app.services.conversation.model_client import ModelClient

    # 获取模型配置
    config = ModelConfig.query.get(config_id)
    if not config:
        raise HTTPException(status_code=404, detail='Model configuration not found')

    # 检查URL是否配置
    if not config.base_url:
        raise HTTPException(status_code=400, detail='API URL not configured')

    # 获取请求数据
    data = await request.json()
    prompt = data.get('prompt', 'Hello, respond with a short greeting.')
    system_prompt = data.get('system_prompt', 'You are a helpful assistant.')

    # 获取高级参数
    advanced_params = {}
    params_mapping = {
        'temperature': 'temperature',
        'top_p': 'top_p',
        'frequency_penalty': 'frequency_penalty',
        'presence_penalty': 'presence_penalty',
        'max_tokens': 'max_tokens',
        'stop': 'stop_sequences'
    }

    for front_param, back_param in params_mapping.items():
        if front_param in data:
            advanced_params[back_param] = data[front_param]

    logger.info(f"[SSE] 请求参数: prompt长度={len(prompt)}, 高级参数={advanced_params}")

    # 创建统一模型客户端实例
    model_client = ModelClient()

    # 创建队列用于线程间通信
    result_queue = queue.Queue()

    # 回调函数，将内容放入队列
    def handle_chunk(content):
        if content:
            try:
                # 确保内容是UTF-8字符串
                if isinstance(content, bytes):
                    content = content.decode('utf-8', errors='replace')

                # 创建SSE格式的数据
                sse_data = json_mod.dumps({
                    "choices": [{
                        "delta": {
                            "content": content
                        }
                    }]
                }, ensure_ascii=False)

                # 将数据放入队列
                result_queue.put(f"data: {sse_data}\n\n")
            except Exception as e:
                logger.error(f"[SSE] 处理内容错误: {str(e)}")

    # 在后台线程中运行模型
    def run_model():
        try:
            logger.info(f"[SSE] 开始模型流式测试: 模型ID={config.id}")

            # 调用test_model_stream方法，传递高级参数
            result = model_client.test_model_stream(
                config=config,
                prompt=prompt,
                system_prompt=system_prompt,
                callback=handle_chunk,
                **advanced_params
            )

            # 如果返回的是错误结果，发送错误消息
            if isinstance(result, dict) and result.get('success') is False:
                error_msg = result.get('message', '未知错误')
                logger.error(f"[SSE] 模型返回错误: {error_msg}")
                error_json = json_mod.dumps({"error": error_msg}, ensure_ascii=False)
                result_queue.put(f"data: {error_json}\n\n")

            logger.info("[SSE] 模型流式测试完成")
        except Exception as e:
            logger.error(f"[SSE] 模型流式测试出错: {str(e)}")
            error_json = json_mod.dumps({"error": str(e)}, ensure_ascii=False)
            result_queue.put(f"data: {error_json}\n\n")
        finally:
            # 发送结束标记
            result_queue.put("data: [DONE]\n\n")

    # 定义生成器函数，用于流式传输响应
    def generate():
        # 发送初始状态
        yield "data: {\"status\": \"connected\"}\n\n"

        # 启动模型线程
        model_thread = threading.Thread(target=run_model)
        model_thread.daemon = True
        model_thread.start()

        # 持续从队列获取内容并发送，直到收到结束标记
        while True:
            try:
                chunk = result_queue.get(timeout=0.01)

                yield chunk

                # 检查是否为结束标记
                if "data: [DONE]" in chunk:
                    break

                time.sleep(0.0001)

            except queue.Empty:
                # 发送心跳以保持连接
                yield ": keepalive\n\n"
                time.sleep(0.01)
                continue
            except GeneratorExit:
                logger.info("[SSE] 客户端断开连接")
                break
            except Exception as e:
                logger.error(f"[SSE] 生成器异常: {str(e)}")
                error_json = json_mod.dumps({"error": str(e)}, ensure_ascii=False)
                yield f"data: {error_json}\n\n"
                yield "data: [DONE]\n\n"
                break

    return StreamingResponse(
        generate(),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no',
        }
    )


@router.options('/model-configs/{config_id}/test-stream')
def options_sse_test_model_config(config_id: str):
    """处理SSE流式测试的OPTIONS请求"""
    from fastapi.responses import Response
    return Response(
        status_code=200,
        headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    )


@router.post('/model-configs/gpustack/models')
async def fetch_gpustack_models(request: Request):
    """获取GPUStack模型列表"""
    import requests

    data = await request.json()
    base_url = data.get('base_url')
    api_key = data.get('api_key')

    if not base_url or not api_key:
        raise HTTPException(status_code=400, detail='缺少必要参数：base_url 和 api_key')

    try:
        # 构建GPUStack API URL（用户已填入完整的base_url含/v1）
        models_url = base_url.rstrip('/') + '/models'

        # 发送请求到GPUStack
        response = requests.get(models_url, headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }, timeout=10)

        if response.status_code == 200:
            resp_data = response.json()
            models = resp_data.get('items', [])
            return {
                'success': True,
                'models': models,
                'message': f'成功获取到 {len(models)} 个模型'
            }
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f'GPUStack API错误: {response.status_code} - {response.text}'
            )

    except HTTPException:
        raise
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=408, detail='请求超时，请检查GPUStack服务器是否可访问')
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail='连接失败，请检查GPUStack服务器地址和网络连接')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'获取模型列表失败: {str(e)}')


@router.post('/model-configs/ollama/models')
async def fetch_ollama_models(request: Request):
    """获取Ollama模型列表"""
    import requests

    data = await request.json()
    base_url = data.get('base_url')

    if not base_url:
        raise HTTPException(status_code=400, detail='缺少必要参数：base_url')

    try:
        # 构建Ollama API URL
        # 即使用户填了 /v1，也要替换为 /api 来访问原生管理API（信息更丰富）
        normalized_url = base_url.rstrip('/')
        if normalized_url.endswith('/v1'):
            normalized_url = normalized_url[:-3]  # 去掉 /v1
        models_url = normalized_url + '/api/tags'

        # 发送请求到Ollama
        response = requests.get(models_url, timeout=10)

        if response.status_code == 200:
            resp_data = response.json()
            models = resp_data.get('models', [])
            return {
                'success': True,
                'models': models,
                'message': f'成功获取到 {len(models)} 个模型'
            }
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f'Ollama API错误: {response.status_code} - {response.text}'
            )

    except HTTPException:
        raise
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=408, detail='请求超时，请检查Ollama服务器是否可访问')
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail='连接失败，请检查Ollama服务器地址和网络连接')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'获取模型列表失败: {str(e)}')


@router.post('/model-configs/anthropic/models')
async def fetch_anthropic_models(request: Request):
    """获取Anthropic模型列表"""
    import requests

    data = await request.json()
    base_url = data.get('base_url')
    api_key = data.get('api_key')

    if not base_url or not api_key:
        raise HTTPException(status_code=400, detail='缺少必要参数：base_url 和 api_key')

    try:
        # 构建Anthropic API URL（用户已填入完整的base_url含/v1）
        models_url = base_url.rstrip('/') + '/models'

        # 发送请求到Anthropic API
        response = requests.get(models_url, headers={
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        }, timeout=10)

        if response.status_code == 200:
            resp_data = response.json()
            models = resp_data.get('data', [])
            return {
                'success': True,
                'models': models,
                'message': f'成功获取到 {len(models)} 个模型'
            }
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f'Anthropic API错误: {response.status_code} - {response.text}'
            )

    except HTTPException:
        raise
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=408, detail='请求超时，请检查Anthropic服务器是否可访问')
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail='连接失败，请检查Anthropic服务器地址和网络连接')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'获取模型列表失败: {str(e)}')


@router.post('/model-configs/google/models')
async def fetch_google_models(request: Request):
    """获取Google AI模型列表"""
    import requests

    data = await request.json()
    base_url = data.get('base_url')
    api_key = data.get('api_key')

    if not base_url or not api_key:
        raise HTTPException(status_code=400, detail='缺少必要参数：base_url 和 api_key')

    try:
        # 构建Google AI API URL
        models_url = base_url.rstrip('/') + '/models'

        # 发送请求到Google AI，API Key通过查询参数传递
        response = requests.get(models_url, params={
            'key': api_key
        }, headers={
            'Content-Type': 'application/json'
        }, timeout=10)

        if response.status_code == 200:
            resp_data = response.json()
            models = resp_data.get('models', [])
            return {
                'success': True,
                'models': models,
                'message': f'成功获取到 {len(models)} 个模型'
            }
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f'Google AI API错误: {response.status_code} - {response.text}'
            )

    except HTTPException:
        raise
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=408, detail='请求超时，请检查Google AI服务器是否可访问')
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail='连接失败，请检查Google AI服务器地址和网络连接')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'获取模型列表失败: {str(e)}')


@router.post('/model-configs/test-connection')
async def test_connection(request: Request):
    """测试模型服务连接"""
    import requests

    data = await request.json()
    base_url = data.get('base_url')
    provider = data.get('provider', '')
    api_key = data.get('api_key', '')

    if not base_url:
        raise HTTPException(status_code=400, detail='缺少必要参数：base_url')

    try:
        # 构建测试URL（用户已填入完整的base_url）
        if provider.lower() == 'google':
            test_url = base_url.rstrip('/') + '/models'
        elif provider.lower() in ['openai', 'anthropic', 'xai', 'ollama', 'gpustack', 'deepseek', 'aliyun', 'volcengine', 'azure']:
            test_url = base_url.rstrip('/') + '/models'
        else:
            test_url = base_url.rstrip('/') + '/models'

        # 准备请求头
        headers = {}

        # 为需要API密钥的提供商添加认证头
        if provider.lower() in ['xai', 'openai', 'anthropic', 'deepseek'] and api_key:
            if provider.lower() == 'anthropic':
                headers['x-api-key'] = api_key
                headers['anthropic-version'] = '2023-06-01'
            else:
                headers['Authorization'] = f'Bearer {api_key}'
        elif provider.lower() == 'google' and api_key:
            test_url += f'?key={api_key}'

        # 发送HEAD请求测试连接
        response = requests.head(test_url, headers=headers, timeout=10)

        if response.status_code in [200, 404, 405]:  # 404和405也表示服务可达
            return {
                'success': True,
                'message': '连接测试成功'
            }
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f'连接测试失败: HTTP {response.status_code}'
            )

    except HTTPException:
        raise
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=408, detail='连接超时，请检查服务器是否可访问')
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail='连接失败，请检查服务器地址和网络连接')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'连接测试失败: {str(e)}')


@router.post('/model-configs/{config_id}/test')
async def test_model_config(config_id: str, request: Request):
    """测试模型配置是否能正常连接"""
    from app.services.conversation.model_client import ModelClient

    config = ModelConfig.query.get(config_id)
    if not config:
        raise HTTPException(status_code=404, detail='Model configuration not found')

    # 检查URL是否配置
    if not config.base_url:
        raise HTTPException(status_code=400, detail='API URL not configured')

    data = await request.json()
    use_stream = data.get('stream', False)
    prompt = data.get('prompt', 'Hello, respond with a short greeting only.')
    system_prompt = data.get('system_prompt', 'You are a helpful assistant.')

    # 获取高级参数
    advanced_params = {}
    params_mapping = {
        'temperature': 'temperature',
        'top_p': 'top_p',
        'frequency_penalty': 'frequency_penalty',
        'presence_penalty': 'presence_penalty',
        'max_tokens': 'max_tokens',
        'stop': 'stop_sequences'
    }

    for front_param, back_param in params_mapping.items():
        if front_param in data:
            advanced_params[back_param] = data[front_param]

    logger.info(f"[API] 测试请求参数: prompt长度={len(prompt)}, 高级参数={advanced_params}")

    # 创建统一模型客户端实例
    model_client = ModelClient()

    # 使用统一模型客户端的test_model方法进行测试，传递高级参数
    result = model_client.test_model(
        config=config,
        prompt=prompt,
        use_stream=use_stream,
        system_prompt=system_prompt,
        **advanced_params
    )

    logger.debug(f"DEBUG - test_model_config - Raw result: {result}")

    # 构建响应对象
    response_obj = {
        'success': result.get('success', False),
        'message': result.get('message', ''),
    }

    # 如果有response字段，则包含它
    if 'response' in result:
        response_obj['response'] = result['response']
    # 否则，尝试从message提取response
    elif result.get('success', False) and '测试成功:' in result.get('message', ''):
        message = result.get('message', '')
        response_text = message.split('测试成功:', 1)[1].strip()
        # 移除末尾的省略号
        if response_text.endswith('...'):
            response_text = response_text[:-3]
        response_obj['response'] = response_text

    return response_obj


@router.post('/model-configs/xai/models')
async def fetch_xai_models(request: Request):
    """获取X.ai模型列表"""
    import requests

    data = await request.json()
    base_url = data.get('base_url')
    api_key = data.get('api_key')

    if not base_url or not api_key:
        raise HTTPException(status_code=400, detail='缺少必要参数：base_url 或 api_key')

    try:
        # 构建X.ai API URL（用户已填入完整的base_url含/v1）
        models_url = base_url.rstrip('/') + '/models'

        # 发送请求到X.ai API
        response = requests.get(models_url, headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }, timeout=10)

        if response.status_code == 200:
            resp_data = response.json()
            models = resp_data.get('data', [])
            return {
                'success': True,
                'models': models,
                'message': f'成功获取到 {len(models)} 个模型'
            }
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f'X.ai API错误: {response.status_code} - {response.text}'
            )

    except HTTPException:
        raise
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=408, detail='请求超时，请检查网络连接或API地址')
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail='连接失败，请检查API地址是否正确')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'请求失败: {str(e)}')
