#!/usr/bin/env python3
"""
测试Dify适配器用户标识符处理
"""

import sys
import os
import unittest

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class TestDifyUserIdentifier(unittest.TestCase):
    """测试Dify适配器用户标识符处理"""

    def setUp(self):
        """设置测试环境"""
        # 基础配置模板
        self.base_config = {
            'source': 'external',
            'settings': {
                'external_config': {
                    'platform': 'dify',
                    'api_config': {
                        'api_key': 'app-REPLACE_ME',
                        'base_url': 'https://app.example.com/v1',
                        'model': 'test-model'
                    },
                    'external_id': 'app-REPLACE_ME'
                }
            }
        }

    def test_normal_user_identifier(self):
        """测试正常的用户标识符配置"""
        from app.services.conversation.adapters.dify_adapter import DifyAdapter
        
        config = self.base_config.copy()
        config['settings']['external_config']['platform_specific'] = {
            'user_identifier': 'test_user_123'
        }
        
        adapter = DifyAdapter(config)
        
        # 测试format_request方法
        messages = [{"role": "user", "content": "测试消息"}]
        request_data = adapter.format_request(messages, "test-model", is_stream=True)
        
        self.assertEqual(request_data['user'], 'test_user_123')

    def test_empty_platform_specific(self):
        """测试platform_specific为空的情况"""
        from app.services.conversation.adapters.dify_adapter import DifyAdapter
        
        config = self.base_config.copy()
        config['settings']['external_config']['platform_specific'] = {}
        
        adapter = DifyAdapter(config)
        
        # 测试format_request方法
        messages = [{"role": "user", "content": "测试消息"}]
        request_data = adapter.format_request(messages, "test-model", is_stream=True)
        
        self.assertEqual(request_data['user'], 'abm_user')

    def test_missing_platform_specific(self):
        """测试platform_specific不存在的情况"""
        from app.services.conversation.adapters.dify_adapter import DifyAdapter
        
        config = self.base_config.copy()
        # 不设置platform_specific
        
        adapter = DifyAdapter(config)
        
        # 测试format_request方法
        messages = [{"role": "user", "content": "测试消息"}]
        request_data = adapter.format_request(messages, "test-model", is_stream=True)
        
        self.assertEqual(request_data['user'], 'abm_user')

    def test_empty_user_identifier(self):
        """测试user_identifier为空字符串的情况"""
        from app.services.conversation.adapters.dify_adapter import DifyAdapter
        
        config = self.base_config.copy()
        config['settings']['external_config']['platform_specific'] = {
            'user_identifier': ''
        }
        
        adapter = DifyAdapter(config)
        
        # 测试format_request方法
        messages = [{"role": "user", "content": "测试消息"}]
        request_data = adapter.format_request(messages, "test-model", is_stream=True)
        
        self.assertEqual(request_data['user'], 'abm_user')

    def test_stop_streaming_user_identifier(self):
        """测试停止流式响应时的用户标识符处理"""
        from app.services.conversation.adapters.dify_adapter import DifyAdapter
        from unittest.mock import patch, Mock
        
        config = self.base_config.copy()
        config['settings']['external_config']['platform_specific'] = {}
        
        adapter = DifyAdapter(config)
        adapter._current_task_id = "test-task-123"
        
        # 模拟成功的停止API响应
        with patch('requests.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.text = '{"result": "success"}'
            mock_post.return_value = mock_response
            
            # 调用停止方法
            result = adapter.stop_streaming()
            
            # 验证结果
            self.assertTrue(result)
            
            # 验证API调用
            mock_post.assert_called_once()
            call_args = mock_post.call_args
            
            # 验证请求体包含正确的user参数
            json_data = call_args[1]['json']
            self.assertIn('user', json_data)
            self.assertEqual(json_data['user'], 'abm_user')

if __name__ == '__main__':
    unittest.main()
