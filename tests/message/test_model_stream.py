def test_backend_stream_processing():
    """
    测试后端流式处理逻辑，模拟真实的后端处理流程
    """
    import requests
    import json
    import logging
    from config import DEBUG_LLM_RESPONSE

    # 设置日志
    logging.basicConfig(level=logging.DEBUG)
    logger = logging.getLogger(__name__)

    logger.info(f"DEBUG_LLM_RESPONSE配置: {DEBUG_LLM_RESPONSE}")

    # 模拟后端的回调函数
    received_chunks = []
    def mock_callback(content):
        received_chunks.append(content)
        logger.info(f"[模拟回调] 收到内容: {repr(content)}")

    # Ollama API配置
    api_url = "http://localhost:11434/v1/chat/completions"

    # 测试消息
    test_messages = [
        {
            "role": "user",
            "content": "请简单介绍一下Python编程语言，并用<think>标签包围你的思考过程。"
        }
    ]

    # 请求数据
    data = {
        "model": "qwen3:32b",
        "messages": test_messages,
        "stream": True,
        "temperature": 0.7
    }

    headers = {
        "Content-Type": "application/json"
    }

    logger.info("开始测试后端流式处理逻辑...")
    logger.info(f"API URL: {api_url}")
    logger.info(f"模型: {data['model']}")

    try:
        # 发送流式请求
        response = requests.post(
            api_url,
            json=data,
            headers=headers,
            stream=True,
            timeout=30
        )

        logger.info(f"HTTP状态码: {response.status_code}")

        if response.status_code != 200:
            logger.error(f"请求失败: {response.text}")
            return

        # 模拟后端的handle_streaming_response函数处理逻辑
        full_content = ""
        buffer = ""
        has_reasoning = False
        chunk_count = 0

        logger.info("开始模拟后端流式处理...")

        for line in response.iter_lines():
            if not line:
                continue

            chunk_count += 1
            line_text = line.decode('utf-8')

            # 模拟DEBUG_LLM_RESPONSE的日志输出
            if DEBUG_LLM_RESPONSE:
                logger.debug(f"[LLM原始输出] {line_text}")

            if line_text.startswith('data: '):
                content = line_text[6:]  # 移除'data: '前缀

                # 处理[DONE]消息
                if content.strip() == '[DONE]':
                    if DEBUG_LLM_RESPONSE:
                        logger.debug("[LLM流式响应] 收到结束标志 [DONE]")
                    break

                # 解析JSON
                try:
                    chunk = json.loads(content)
                    if DEBUG_LLM_RESPONSE:
                        logger.debug(f"[LLM解析内容] {json.dumps(chunk, ensure_ascii=False)}")

                    # 检查delta的内容
                    if chunk.get('choices') and chunk['choices'][0].get('delta', {}).get('content'):
                        content_piece = chunk['choices'][0]['delta']['content']

                        # 检查是否是reasoning的结束
                        if has_reasoning and not chunk['choices'][0].get('delta', {}).get('reasoning_content'):
                            if DEBUG_LLM_RESPONSE:
                                logger.debug("[LLM流式响应] 检测到reasoning可能结束，添加</thinking>标签")

                            thinking_end_tag = "\n</thinking>\n"
                            buffer += thinking_end_tag
                            full_content += thinking_end_tag
                            mock_callback(thinking_end_tag)
                            has_reasoning = False

                        # 处理普通内容
                        buffer += content_piece
                        full_content += content_piece
                        mock_callback(content_piece)

                    # 检查是否有reasoning_content字段（Qwen3模型特有）
                    elif chunk.get('choices') and chunk['choices'][0].get('delta', {}).get('reasoning_content'):
                        reasoning_content = chunk['choices'][0]['delta']['reasoning_content']
                        content_value = chunk['choices'][0].get('delta', {}).get('content')

                        if DEBUG_LLM_RESPONSE:
                            logger.debug(f"[LLM流式响应] 检测到Qwen3 reasoning_content: {reasoning_content}")
                            logger.debug(f"[LLM流式响应] content值: {content_value}")

                        # 检查是否是reasoning的开始
                        if not has_reasoning and content_value is None and reasoning_content:
                            thinking_tag = "<thinking>\n"
                            buffer += thinking_tag
                            full_content += thinking_tag
                            mock_callback(thinking_tag + reasoning_content)
                            has_reasoning = True
                        else:
                            mock_callback(reasoning_content)

                        buffer += reasoning_content
                        full_content += reasoning_content

                except json.JSONDecodeError as e:
                    if DEBUG_LLM_RESPONSE:
                        logger.debug(f"[LLM流式响应] JSON解析错误: {e}, 原始内容: {content}")
                    continue

        # 如果有未关闭的reasoning标签，添加结束标签
        if has_reasoning:
            if DEBUG_LLM_RESPONSE:
                logger.debug("[LLM流式响应] 流式响应结束时添加reasoning结束标签</thinking>")

            thinking_end_tag = "\n</thinking>"
            full_content += thinking_end_tag
            mock_callback(thinking_end_tag)

        logger.info(f"后端流式处理完成，总共处理了 {chunk_count} 个数据包")
        logger.info(f"回调函数被调用了 {len(received_chunks)} 次")
        logger.info(f"完整内容长度: {len(full_content)}")

        # 检查完整内容中的特殊字符
        think_start_count = full_content.count('<think>')
        think_end_count = full_content.count('</think>')
        thinking_start_count = full_content.count('<thinking>')
        thinking_end_count = full_content.count('</thinking>')

        logger.info(f"完整内容中包含 {think_start_count} 个 <think> 标签")
        logger.info(f"完整内容中包含 {think_end_count} 个 </think> 标签")
        logger.info(f"完整内容中包含 {thinking_start_count} 个 <thinking> 标签")
        logger.info(f"完整内容中包含 {thinking_end_count} 个 </thinking> 标签")

        # 显示前200个字符作为示例
        preview = full_content[:200] + "..." if len(full_content) > 200 else full_content
        logger.info(f"内容预览: {repr(preview)}")

        # 显示回调接收到的内容
        logger.info("回调接收到的内容片段:")
        for i, chunk in enumerate(received_chunks[:10]):  # 只显示前10个
            logger.info(f"  [{i+1}] {repr(chunk)}")

        if len(received_chunks) > 10:
            logger.info(f"  ... 还有 {len(received_chunks) - 10} 个片段")

    except Exception as e:
        logger.error(f"测试过程中出错: {e}")
        import traceback
        logger.error(traceback.format_exc())

def test_backend_model_client():
    """
    测试后端ModelClient是否正确调用流式处理
    """
    import logging
    from config import DEBUG_LLM_RESPONSE
    from app.services.conversation.model_client import ModelClient

    # 设置日志
    logging.basicConfig(level=logging.DEBUG)
    logger = logging.getLogger(__name__)

    logger.info(f"DEBUG_LLM_RESPONSE配置: {DEBUG_LLM_RESPONSE}")

    # 模拟后端的回调函数
    received_chunks = []
    def mock_callback(content):
        received_chunks.append(content)
        logger.info(f"[ModelClient回调] 收到内容: {repr(content)}")

    # 测试消息
    test_messages = [
        {
            "role": "user",
            "content": "请简单介绍一下Python编程语言，并用<think>标签包围你的思考过程。"
        }
    ]

    logger.info("开始测试ModelClient流式处理...")

    try:
        # 创建ModelClient实例
        model_client = ModelClient()

        # 调用send_request方法，模拟真实的后端调用
        api_response = model_client.send_request(
            api_url="http://localhost:11434/v1/chat/completions",
            api_key="",  # Ollama不需要API密钥
            messages=test_messages,
            model="qwen3:32b",
            is_stream=True,
            callback=mock_callback,
            agent_info=None,
            temperature=0.7
        )

        logger.info(f"ModelClient返回结果: {repr(api_response)}")
        logger.info(f"回调函数被调用了 {len(received_chunks)} 次")

        # 显示回调接收到的内容
        logger.info("回调接收到的内容片段:")
        for i, chunk in enumerate(received_chunks[:10]):  # 只显示前10个
            logger.info(f"  [{i+1}] {repr(chunk)}")

        if len(received_chunks) > 10:
            logger.info(f"  ... 还有 {len(received_chunks) - 10} 个片段")

        # 检查是否有流式输出
        if len(received_chunks) == 0:
            logger.error("❌ 没有收到任何流式输出！这说明流式处理没有正常工作。")
        else:
            logger.info(f"✅ 收到了 {len(received_chunks)} 个流式数据包，流式处理正常工作。")

    except Exception as e:
        logger.error(f"测试过程中出错: {e}")
        import traceback
        logger.error(traceback.format_exc())

def test_debug_llm_response_setting():
    """
    测试DEBUG_LLM_RESPONSE配置是否正确加载
    """
    import logging
    from config import DEBUG_LLM_RESPONSE

    # 设置日志
    logging.basicConfig(level=logging.DEBUG)
    logger = logging.getLogger(__name__)

    logger.info("=== DEBUG_LLM_RESPONSE配置检查 ===")
    logger.info(f"DEBUG_LLM_RESPONSE值: {DEBUG_LLM_RESPONSE}")
    logger.info(f"DEBUG_LLM_RESPONSE类型: {type(DEBUG_LLM_RESPONSE)}")

    # 检查配置文件
    try:
        import configparser
        import os

        config_parser = configparser.ConfigParser()
        config_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), '..', 'config.conf')

        if os.path.exists(config_path):
            config_parser.read(config_path, encoding='utf-8')
            if 'BACKEND_CONFIG' in config_parser:
                debug_llm = config_parser['BACKEND_CONFIG'].get('DEBUG_LLM_RESPONSE', 'False')
                logger.info(f"配置文件中的DEBUG_LLM_RESPONSE: {debug_llm}")
            else:
                logger.warning("配置文件中没有BACKEND_CONFIG节")
        else:
            logger.warning(f"配置文件不存在: {config_path}")

    except Exception as e:
        logger.error(f"读取配置文件时出错: {e}")

    # 测试日志级别
    if DEBUG_LLM_RESPONSE:
        logger.info("✅ DEBUG_LLM_RESPONSE已启用，应该能看到详细的LLM流式日志")
    else:
        logger.warning("❌ DEBUG_LLM_RESPONSE未启用，不会看到LLM流式日志")

def test_stream_response_processing():
    """
    测试流式响应处理是否被正确调用
    """
    import logging
    import requests
    from config import DEBUG_LLM_RESPONSE

    # 设置日志
    logging.basicConfig(level=logging.DEBUG)
    logger = logging.getLogger(__name__)

    logger.info("=== 测试流式响应处理 ===")

    # 模拟回调函数
    received_chunks = []
    def mock_callback(content):
        received_chunks.append(content)
        logger.info(f"[回调] 收到内容: {repr(content)}")

    try:
        # 直接发送HTTP请求，模拟ModelClient的行为
        api_url = "http://localhost:11434/v1/chat/completions"

        payload = {
            "model": "qwen2.5:7b",
            "messages": [
                {
                    "role": "user",
                    "content": "请简单介绍一下Python编程语言，并用<think>标签包围你的思考过程。"
                }
            ],
            "stream": False,
            "temperature": 0.7
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": "Bear None"
        }

        logger.info(f"发送HTTP请求到: {api_url}")

        # 发送请求
        response = requests.post(
            api_url,
            json=payload,
            headers=headers,
            stream=True,
            timeout=30
        )

        logger.info(f"HTTP状态码: {response.status_code}")

        if response.status_code != 200:
            logger.error(f"请求失败: {response.text}")
            return

        # 检查响应是否真的是流式的
        logger.info(f"响应头: {dict(response.headers)}")

        # 现在调用handle_streaming_response
        logger.info("准备调用handle_streaming_response...")

        from app.services.conversation.stream_handler import handle_streaming_response

        # 准备API配置
        api_config = {
            "api_url": api_url,
            "api_key": "",
            "model": "qwen3:32b",
            "agent_info": None
        }

        # 调用流式处理函数
        result = handle_streaming_response(
            response,
            mock_callback,
            original_messages=payload["messages"],
            api_config=api_config
        )

        logger.info(f"handle_streaming_response返回结果长度: {len(result) if result else 0}")
        logger.info(f"回调函数被调用了 {len(received_chunks)} 次")

        if len(received_chunks) == 0:
            logger.error("❌ handle_streaming_response没有产生任何回调！")
        else:
            logger.info(f"✅ handle_streaming_response正常工作，产生了 {len(received_chunks)} 个回调")

    except Exception as e:
        logger.error(f"测试过程中出错: {e}")
        import traceback
        logger.error(traceback.format_exc())