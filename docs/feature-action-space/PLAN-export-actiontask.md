# 行动任务导出功能 - 简化实现计划

## 功能目标
点击导出按钮 → 弹出选项Modal → 下载ZIP文件

## 导出内容
1. **智能体列表** (Excel)
2. **会话数据** (Excel) - 全部会话或当前会话
3. **工作空间文件** (可选) - 直接复制文件夹

## 文件结构
```
20250911-actiontask-任务名.zip
├── data.xlsx (2个Sheet: 智能体、会话消息)
└── workspace/ (可选)
```

## 实现步骤

### 1. 后端API (1个接口)
```python
# backend/app/api/routes/action_tasks.py
@action_task_bp.route('/action-tasks/<string:task_id>/export', methods=['POST'])
def export_action_task(task_id):
    # 1. 获取数据
    # 2. 生成Excel
    # 3. 打包ZIP
    # 4. 返回文件
```

### 2. 前端Modal (1个组件)
```jsx
// frontend/src/pages/actiontask/components/ExportModal.js
const ExportModal = ({ visible, onCancel, task }) => {
  // 3个选项: 智能体、会话范围、是否包含工作空间
  // 1个按钮: 开始导出
}
```

### 3. 集成到详情页
在 `ActionTaskDetail.js` 添加导出按钮

## Excel结构 (简化)
- **Sheet1 智能体**: ID、名称、角色、状态
- **Sheet2 消息**: 时间、发送者、内容

## 技术栈
- 后端: `openpyxl` + `zipfile`
- 前端: `antd Modal` + `file-saver`

## 开发顺序
1. 后端导出接口 (核心逻辑)
2. 前端Modal组件 (用户界面)
3. 集成测试
