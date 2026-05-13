#!/usr/bin/env python3
"""
数据库迁移脚本：为 stripe_config 表添加 webhook_url 字段

运行方式：
cd backend && conda run -n abm python scripts/migrate_add_webhook_url.py
"""

import os
import sys

# 添加项目路径
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
sys.path.insert(0, backend_dir)

from app import create_app
from app.extensions import db
from sqlalchemy import text

def migrate():
    app = create_app()
    
    with app.app_context():
        # 检查 stripe_config 表是否存在
        result = db.session.execute(text("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='stripe_config'
        """))
        if not result.fetchone():
            print("stripe_config 表不存在，跳过迁移")
            return
        
        # 检查 webhook_url 列是否已存在
        result = db.session.execute(text("PRAGMA table_info(stripe_config)"))
        columns = [row[1] for row in result.fetchall()]
        
        if 'webhook_url' in columns:
            print("webhook_url 列已存在，跳过迁移")
            return
        
        # 添加 webhook_url 列
        print("正在添加 webhook_url 列...")
        db.session.execute(text("""
            ALTER TABLE stripe_config ADD COLUMN webhook_url VARCHAR(500)
        """))
        db.session.commit()
        print("✅ webhook_url 列添加成功")

if __name__ == '__main__':
    migrate()
