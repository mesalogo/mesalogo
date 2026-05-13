#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
迁移脚本：为 subscription_plans 表添加 is_public 字段
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from sqlalchemy import text

def migrate():
    app = create_app()
    with app.app_context():
        # 检查字段是否已存在
        result = db.session.execute(text(
            "SELECT COUNT(*) FROM pragma_table_info('subscription_plans') WHERE name='is_public'"
        ))
        exists = result.scalar() > 0
        
        if exists:
            print("[INFO] is_public 字段已存在，跳过迁移")
            return
        
        # 添加 is_public 字段，默认为 True
        print("[INFO] 添加 is_public 字段...")
        db.session.execute(text(
            "ALTER TABLE subscription_plans ADD COLUMN is_public BOOLEAN DEFAULT 1"
        ))
        db.session.commit()
        print("[OK] is_public 字段添加成功")

if __name__ == '__main__':
    migrate()
