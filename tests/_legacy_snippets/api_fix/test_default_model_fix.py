#!/usr/bin/env python3
"""
测试默认模型选择修复的脚本
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.models import ModelConfig, db

def test_default_model_selection():
    """测试默认模型选择逻辑"""
    app = create_app()
    
    with app.app_context():
        print("=== 测试默认模型选择修复 ===\n")
        
        # 1. 检查当前的模型配置
        print("1. 当前模型配置:")
        all_models = ModelConfig.query.all()
        for model in all_models:
            print(f"   - {model.name} (ID: {model.id})")
            print(f"     Provider: {model.provider}, Model: {model.model_id}")
            print(f"     is_default: {getattr(model, 'is_default', False)}")
            print(f"     is_default_text: {getattr(model, 'is_default_text', False)}")
            print(f"     is_default_embedding: {getattr(model, 'is_default_embedding', False)}")
            print(f"     modalities: {getattr(model, 'modalities', [])}")
            print()
        
        # 2. 测试默认文本生成模型选择
        print("2. 测试默认文本生成模型选择:")
        text_model = ModelConfig.query.filter_by(is_default_text=True).first()
        if text_model:
            print(f"   找到默认文本生成模型: {text_model.name}")
        else:
            print("   未找到默认文本生成模型，尝试查找支持文本输出的模型...")
            text_models = ModelConfig.query.filter(
                ModelConfig.modalities.contains('text_output')
            ).all()
            if text_models:
                text_model = text_models[0]
                print(f"   使用第一个支持文本输出的模型: {text_model.name}")
            else:
                text_model = ModelConfig.query.first()
                if text_model:
                    print(f"   使用第一个可用模型: {text_model.name}")
                else:
                    print("   未找到任何可用模型!")
        
        # 3. 测试默认嵌入模型选择
        print("\n3. 测试默认嵌入模型选择:")
        embedding_model = ModelConfig.query.filter_by(is_default_embedding=True).first()
        if embedding_model:
            print(f"   找到默认嵌入模型: {embedding_model.name}")
        else:
            print("   未找到默认嵌入模型，尝试查找支持向量输出的模型...")
            embedding_models = ModelConfig.query.filter(
                ModelConfig.modalities.contains('vector_output')
            ).all()
            if embedding_models:
                print(f"   使用第一个嵌入模型: {embedding_models[0].name}")
            else:
                print("   未找到支持向量输出的模型!")
        
        # 4. 测试图谱增强服务的模型选择
        print("\n4. 测试图谱增强服务的模型选择:")
        try:
            from app.services.graph_enhancement_service import GraphEnhancementService
            service = GraphEnhancementService()
            
            # 测试获取默认文本生成模型函数
            text_func = service._get_default_text_model_func()
            print(f"   文本生成模型函数: {text_func}")
            
            # 测试获取默认嵌入模型函数
            embedding_func = service._get_default_embedding_func()
            print(f"   嵌入模型函数: {embedding_func}")
            
        except Exception as e:
            print(f"   图谱增强服务测试失败: {e}")
        
        # 5. 测试监督规则检查器的模型选择
        print("\n5. 测试监督规则检查器的模型选择:")
        try:
            from app.services.supervisor_rule_checker import SupervisorRuleChecker
            checker = SupervisorRuleChecker()
            
            model_config = checker._get_model_config()
            if model_config:
                print(f"   监督规则检查器使用模型: {model_config.get('model_id')}")
            else:
                print("   监督规则检查器未找到可用模型")
                
        except Exception as e:
            print(f"   监督规则检查器测试失败: {e}")
        
        print("\n=== 测试完成 ===")

if __name__ == "__main__":
    test_default_model_selection()
