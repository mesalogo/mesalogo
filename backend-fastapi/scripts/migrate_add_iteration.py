#!/usr/bin/env python3
"""
迁移脚本：为 parallel_experiments 表添加 current_iteration 字段
并将 cloned_action_task_ids 从列表格式转换为字典格式

运行方式：
cd backend && python scripts/migrate_add_iteration.py
"""

import os
import sys
import sqlite3
import json

# 获取数据库路径
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
db_path = os.path.join(backend_dir, 'data', 'app.db')

def migrate():
    if not os.path.exists(db_path):
        print(f"数据库文件不存在: {db_path}")
        sys.exit(1)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 检查 current_iteration 字段是否已存在
        cursor.execute("PRAGMA table_info(parallel_experiments)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'current_iteration' not in columns:
            print("添加 current_iteration 字段...")
            cursor.execute("ALTER TABLE parallel_experiments ADD COLUMN current_iteration INTEGER DEFAULT 0")
            print("current_iteration 字段添加成功")
        else:
            print("current_iteration 字段已存在，跳过")
        
        # 转换 cloned_action_task_ids 格式：从列表转为字典
        print("检查并转换 cloned_action_task_ids 格式...")
        cursor.execute("SELECT id, cloned_action_task_ids, current_iteration, status FROM parallel_experiments")
        rows = cursor.fetchall()
        
        updated_count = 0
        for row in rows:
            exp_id, task_ids_json, current_iter, status = row
            if not task_ids_json:
                continue
            
            try:
                task_ids = json.loads(task_ids_json)
            except json.JSONDecodeError:
                continue
            
            # 如果是列表格式，转换为字典格式
            if isinstance(task_ids, list) and len(task_ids) > 0:
                # 将现有任务ID放到第1轮
                new_format = {"1": task_ids}
                new_iteration = 1
                
                cursor.execute(
                    "UPDATE parallel_experiments SET cloned_action_task_ids = ?, current_iteration = ? WHERE id = ?",
                    (json.dumps(new_format), new_iteration, exp_id)
                )
                updated_count += 1
                print(f"  转换实验 {exp_id}: {len(task_ids)} 个任务 -> 第1轮")
        
        if updated_count > 0:
            print(f"共转换 {updated_count} 个实验的数据格式")
        else:
            print("没有需要转换的数据")
        
        # 同样转换 results_summary 格式
        print("检查并转换 results_summary 格式...")
        cursor.execute("SELECT id, results_summary, current_iteration FROM parallel_experiments WHERE results_summary IS NOT NULL")
        rows = cursor.fetchall()
        
        updated_count = 0
        for row in rows:
            exp_id, summary_json, current_iter = row
            if not summary_json:
                continue
            
            try:
                summary = json.loads(summary_json)
            except json.JSONDecodeError:
                continue
            
            # 如果不是按轮次存储的格式（没有数字键），转换为新格式
            if isinstance(summary, dict) and 'best_run' in summary:
                iteration = current_iter or 1
                new_format = {str(iteration): summary}
                
                cursor.execute(
                    "UPDATE parallel_experiments SET results_summary = ? WHERE id = ?",
                    (json.dumps(new_format), exp_id)
                )
                updated_count += 1
                print(f"  转换实验 {exp_id} 的 results_summary -> 第{iteration}轮")
        
        if updated_count > 0:
            print(f"共转换 {updated_count} 个实验的 results_summary")
        else:
            print("没有需要转换的 results_summary")
        
        conn.commit()
        print("\n迁移完成!")
        
    except Exception as e:
        conn.rollback()
        print(f"迁移失败: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
