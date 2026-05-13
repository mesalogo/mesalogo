# 多租户架构设计方案（KISS版本 - 支持用户共享）

## 1. 术语定义

### 1.1 核心概念

- **超级管理员（Super Admin）**: 系统级管理员，管理整个系统
- **普通用户/租户（Regular User/Tenant）**: 每个普通用户就是一个独立的租户
- **只读用户（Viewer）**: 只能查看自己创建内容的用户

### 1.2 角色概念区分

**重要**: 系统中有两种"角色"概念，必须明确区分：

1. **用户角色（UserRole）** - 权限管理
   - 模型: `UserRole`
   - 表名: `user_roles`
   - 用途: 控制用户在系统中的权限
   - 示例: 超级管理员、普通用户、只读用户

2. **智能体角色（Role）** - 业务功能
   - 模型: `Role`
   - 表名: `roles`
   - 用途: 定义智能体的行为和能力
   - 示例: 产品经理、开发工程师、测试工程师

## 2. 多租户架构设计（KISS原则 + 用户共享）

### 2.1 核心设计理念

**使用两个字段实现多租户隔离和资源共享：**

1. `created_by` - 标识资源创建者
2. `is_shared` - 标识资源是否共享

### 2.2 资源分类

#### 2.2.1 租户资源（所有用户都可以创建）

除了模型配置和工具外，所有资源都是租户资源：

```python
# 需要添加 created_by 和 is_shared 字段的模型
- Role (智能体角色)
- Knowledge (知识库)
- Capability (能力) - 能力已经包含了工具的概念
- ActionSpace (行动空间)
- RuleSet (规则集)

# 已有所有权字段的模型
- ActionTask (已有 user_id 字段，需要添加 is_shared)
- Agent (通过 action_task_id 关联到 ActionTask.user_id)
```

#### 2.2.2 系统级资源（只有超级管理员可以管理）

```python
- ModelConfig (模型配置) - 不需要 created_by 和 is_shared
- Tool (工具) - 系统级工具，不需要 created_by 和 is_shared
```

### 2.3 资源类型（三种）

#### 2.3.1 私有资源
- `created_by = user_id, is_shared = False`
- 只有创建者和超级管理员可以查看和编辑
- 默认创建模式

#### 2.3.2 用户共享资源
- `created_by = user_id, is_shared = True`
- 所有用户可以查看和使用
- 只有创建者和超级管理员可以编辑
- 用户创建时勾选"共享"

#### 2.3.3 系统资源
- `created_by = NULL, is_shared = True`
- 所有用户可以查看和使用
- 只有超级管理员可以编辑
- 超级管理员创建时默认为系统资源

### 2.4 数据库模型扩展

#### 2.4.1 添加所有权和共享字段

```python
# 智能体角色
class Role(BaseMixin, db.Model):
    __tablename__ = 'roles'
    # ... 现有字段 ...
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    is_shared = Column(Boolean, default=False)
    # created_by = NULL, is_shared = True → 系统资源
    # created_by = user_id, is_shared = True → 用户共享资源
    # created_by = user_id, is_shared = False → 私有资源

    # 关联关系
    creator = relationship("User", foreign_keys=[created_by])

# 知识库
class Knowledge(BaseMixin, db.Model):
    __tablename__ = 'knowledges'
    # ... 现有字段 ...
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    is_shared = Column(Boolean, default=False)

    creator = relationship("User", foreign_keys=[created_by])

# 能力（能力已经包含了工具的概念）
class Capability(BaseMixin, db.Model):
    __tablename__ = 'capabilities'
    # ... 现有字段 ...
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    is_shared = Column(Boolean, default=False)

    creator = relationship("User", foreign_keys=[created_by])

# 行动空间
class ActionSpace(BaseMixin, db.Model):
    __tablename__ = 'action_spaces'
    # ... 现有字段 ...
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    is_shared = Column(Boolean, default=False)

    creator = relationship("User", foreign_keys=[created_by])

# 规则集
class RuleSet(BaseMixin, db.Model):
    __tablename__ = 'rule_sets'
    # ... 现有字段 ...
    created_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    is_shared = Column(Boolean, default=False)

    creator = relationship("User", foreign_keys=[created_by])
```

#### 2.4.2 ActionTask 已有 user_id，添加 is_shared

```python
class ActionTask(BaseMixin, db.Model):
    __tablename__ = 'action_tasks'
    # ... 现有字段 ...
    user_id = Column(String(36), ForeignKey('users.id'))  # 已存在，表示任务所有者
    is_shared = Column(Boolean, default=False)  # 新增：是否共享
```

#### 2.4.3 Agent 通过 ActionTask 关联用户

```python
class Agent(BaseMixin, db.Model):
    __tablename__ = 'agents'
    # ... 现有字段 ...
    action_task_id = Column(String(36), ForeignKey('action_tasks.id'))  # 已存在
    # 通过 action_task.user_id 确定所有者
    # 通过 action_task.is_shared 确定是否共享
```

## 3. 权限控制规则

### 3.1 资源可见性规则

| 资源类型 | created_by | is_shared | 超级管理员 | 创建者 | 其他租户 |
|---------|-----------|----------|-----------|--------|---------|
| 系统资源 | NULL | True | ✅ 可查看可编辑 | - | ✅ 可查看可使用 |
| 用户共享资源 | user_id | True | ✅ 可查看可编辑 | ✅ 可查看可编辑 | ✅ 可查看可使用 |
| 私有资源 | user_id | False | ✅ 可查看可编辑 | ✅ 可查看可编辑 | ❌ 不可见 |

**说明**：
- **系统资源**：超级管理员创建，`created_by = NULL, is_shared = True`，所有用户可见可使用
- **用户共享资源**：用户创建并勾选共享，`created_by = user_id, is_shared = True`，所有用户可见可使用，只有创建者可编辑
- **私有资源**：用户创建，`created_by = user_id, is_shared = False`，只有创建者可见可编辑

### 3.2 用户角色权限

#### 3.2.1 超级管理员（super_admin）
- ✅ 可以查看和管理所有资源（系统资源 + 所有租户的资源）
- ✅ 可以创建系统资源（created_by = NULL, is_shared = True）
- ✅ 可以创建私有资源（created_by = admin_id, is_shared = False）
- ✅ 可以管理用户和用户角色
- ✅ 可以访问系统设置
- ✅ 可以管理模型配置
- ❌ 不能修改自己的用户角色（防止误操作）

#### 3.2.2 普通用户/租户（regular_user）
- ✅ 可以创建资源，默认为私有（created_by = 自己的ID, is_shared = False）
- ✅ 可以勾选"共享"，让其他用户可见（is_shared = True）
- ✅ 可以查看和使用：
  - 自己创建的所有资源
  - 系统资源（created_by = NULL, is_shared = True）
  - 其他用户共享的资源（is_shared = True）
- ✅ 可以编辑和删除自己创建的资源
- ❌ 不能编辑系统资源和其他用户的资源
- ❌ 不能查看其他用户的私有资源（is_shared = False）
- ❌ 不能访问系统设置（除了"关于系统"）
- ❌ 不能管理用户
- ❌ 不能管理模型配置

#### 3.2.3 只读用户（viewer）
- ✅ 可以查看：
  - 自己创建的资源
  - 系统资源
  - 其他用户共享的资源
- ❌ 不能创建任何资源
- ❌ 不能修改任何资源
- ❌ 不能共享资源

## 4. 实现计划

### 4.1 数据库迁移（第1天）

#### 任务 4.1.1: 修改模型定义
- [ ] 为 Role 模型添加 `created_by` 和 `is_shared` 字段
- [ ] 为 Knowledge 模型添加 `created_by` 和 `is_shared` 字段
- [ ] 为 Capability 模型添加 `created_by` 和 `is_shared` 字段
- [ ] 为 ActionSpace 模型添加 `created_by` 和 `is_shared` 字段
- [ ] 为 RuleSet 模型添加 `created_by` 和 `is_shared` 字段
- [ ] 为 ActionTask 模型添加 `is_shared` 字段（已有 user_id）

#### 任务 4.1.2: 创建数据库迁移脚本
- [ ] 生成 Alembic 迁移脚本
- [ ] 验证迁移脚本的正确性

#### 任务 4.1.3: 数据迁移
- [ ] 将系统预定义的资源设置为：`created_by = NULL, is_shared = True`
- [ ] 将现有用户创建的资源设置为：`created_by = admin_id, is_shared = False`
- [ ] 验证数据完整性

### 4.2 后端权限服务扩展（第2天）

#### 任务 4.2.1: 扩展权限检查方法

```python
# 在 UserPermissionService 中添加

@staticmethod
def can_view_resource(current_user: User, resource) -> bool:
    """检查是否可以查看资源"""
    # 超级管理员可以查看所有资源
    if current_user.is_admin:
        return True

    # 共享资源所有人可见
    if hasattr(resource, 'is_shared') and resource.is_shared:
        return True

    # 自己创建的资源可见
    if hasattr(resource, 'created_by') and resource.created_by == current_user.id:
        return True

    # ActionTask 使用 user_id
    if hasattr(resource, 'user_id') and resource.user_id == current_user.id:
        return True

    return False

@staticmethod
def can_edit_resource(current_user: User, resource) -> bool:
    """检查是否可以编辑资源"""
    # 超级管理员可以编辑所有资源
    if current_user.is_admin:
        return True

    # 只能编辑自己创建的资源
    if hasattr(resource, 'created_by') and resource.created_by == current_user.id:
        return True

    # ActionTask 使用 user_id
    if hasattr(resource, 'user_id') and resource.user_id == current_user.id:
        return True

    return False

@staticmethod
def can_delete_resource(current_user: User, resource) -> bool:
    """检查是否可以删除资源"""
    # 删除权限与编辑权限相同
    return UserPermissionService.can_edit_resource(current_user, resource)

@staticmethod
def can_share_resource(current_user: User, resource) -> bool:
    """检查是否可以共享资源"""
    # 只有创建者和超级管理员可以共享资源
    return UserPermissionService.can_edit_resource(current_user, resource)

@staticmethod
def filter_viewable_resources(query, model_class, current_user: User):
    """过滤用户可见的资源"""
    if current_user.is_admin:
        # 超级管理员可以看到所有资源
        return query

    # 普通用户可以看到：
    # 1. 共享资源（is_shared = True）
    # 2. 自己创建的资源（created_by = current_user.id）
    from sqlalchemy import or_

    filters = []

    # 共享资源
    if hasattr(model_class, 'is_shared'):
        filters.append(model_class.is_shared == True)

    # 自己创建的资源
    if hasattr(model_class, 'created_by'):
        filters.append(model_class.created_by == current_user.id)

    # ActionTask 使用 user_id
    if hasattr(model_class, 'user_id'):
        filters.append(model_class.user_id == current_user.id)

    if filters:
        return query.filter(or_(*filters))

    return query
```

### 4.3 后端API修改（第3-4天）

#### 任务 4.3.1: 修改智能体角色API
```python
# GET /api/roles - 添加资源过滤
@roles_bp.route('/roles', methods=['GET'])
@login_required
def get_roles():
    current_user = get_current_user_from_token()
    query = Role.query
    # 过滤用户可见的资源
    query = UserPermissionService.filter_viewable_resources(query, Role, current_user)
    roles = query.all()
    return jsonify([role.to_dict() for role in roles])

# POST /api/roles - 设置 created_by 和 is_shared
@roles_bp.route('/roles', methods=['POST'])
@login_required
def create_role():
    current_user = get_current_user_from_token()
    data = request.get_json()

    # 设置创建者和共享状态
    if current_user.is_admin:
        # 超级管理员可以选择创建系统资源或私有资源
        created_by = data.get('created_by', None)  # None = 系统资源
        is_shared = data.get('is_shared', True if created_by is None else False)
    else:
        # 普通用户创建的资源
        created_by = current_user.id
        is_shared = data.get('is_shared', False)  # 默认私有，可勾选共享

    role = Role(
        name=data['name'],
        created_by=created_by,
        is_shared=is_shared,
        # ... 其他字段
    )
    db.session.add(role)
    db.session.commit()
    return jsonify(role.to_dict()), 201

# PUT /api/roles/{id} - 检查编辑权限
@roles_bp.route('/roles/<string:role_id>', methods=['PUT'])
@login_required
def update_role(role_id):
    current_user = get_current_user_from_token()
    role = Role.query.get(role_id)

    if not role:
        return jsonify({'error': '角色不存在'}), 404

    # 检查编辑权限
    if not UserPermissionService.can_edit_resource(current_user, role):
        return jsonify({'error': '无权限编辑此资源'}), 403

    # 更新资源
    data = request.get_json()

    # 只有创建者可以修改 is_shared 状态
    if 'is_shared' in data and UserPermissionService.can_share_resource(current_user, role):
        role.is_shared = data['is_shared']

    # ... 更新其他字段

    db.session.commit()
    return jsonify(role.to_dict())

# DELETE /api/roles/{id} - 检查删除权限
@roles_bp.route('/roles/<string:role_id>', methods=['DELETE'])
@login_required
def delete_role(role_id):
    current_user = get_current_user_from_token()
    role = Role.query.get(role_id)

    if not role:
        return jsonify({'error': '角色不存在'}), 404

    # 检查删除权限
    if not UserPermissionService.can_delete_resource(current_user, role):
        return jsonify({'error': '无权限删除此资源'}), 403

    db.session.delete(role)
    db.session.commit()
    return jsonify({'message': '删除成功'})
```

#### 任务 4.3.2: 修改知识库API
- [ ] GET /api/knowledges - 添加资源过滤（同上）
- [ ] POST /api/knowledges - 设置 created_by（同上）
- [ ] PUT /api/knowledges/{id} - 检查编辑权限（同上）
- [ ] DELETE /api/knowledges/{id} - 检查删除权限（同上）

#### 任务 4.3.3: 修改能力API
- [ ] GET /api/capabilities - 添加资源过滤（同上）
- [ ] POST /api/capabilities - 设置 created_by（同上）
- [ ] PUT /api/capabilities/{id} - 检查编辑权限（同上）
- [ ] DELETE /api/capabilities/{id} - 检查删除权限（同上）

#### 任务 4.3.4: 修改行动空间API
- [ ] GET /api/action-spaces - 添加资源过滤（同上）
- [ ] POST /api/action-spaces - 设置 created_by（同上）
- [ ] PUT /api/action-spaces/{id} - 检查编辑权限（同上）
- [ ] DELETE /api/action-spaces/{id} - 检查删除权限（同上）

#### 任务 4.3.5: 修改规则集API
- [ ] GET /api/rule-sets - 添加资源过滤（同上）
- [ ] POST /api/rule-sets - 设置 created_by（同上）
- [ ] PUT /api/rule-sets/{id} - 检查编辑权限（同上）
- [ ] DELETE /api/rule-sets/{id} - 检查删除权限（同上）

### 4.4 前端UI调整（第5-6天）

#### 任务 4.4.1: 资源列表显示
- [ ] 添加"来源"列，显示：
  - "系统" - created_by = NULL
  - "共享" - created_by = user_id, is_shared = True
  - "我的" - created_by = 当前用户ID
  - 超级管理员可以看到创建者用户名
- [ ] 添加资源筛选：
  - "全部"
  - "系统资源"（created_by = NULL）
  - "共享资源"（is_shared = True）
  - "我的资源"（created_by = 当前用户ID）

#### 任务 4.4.2: 资源创建/编辑
- [ ] 普通用户创建时：
  - 自动设置 `created_by = current_user.id`
  - 显示"共享"复选框，默认不勾选
  - 勾选后 `is_shared = True`，其他用户可见
- [ ] 超级管理员创建时：
  - 可以选择创建系统资源（created_by = NULL, is_shared = True）
  - 可以选择创建私有资源（created_by = admin_id, is_shared = False）
  - 默认创建系统资源
- [ ] 资源编辑：
  - 创建者可以修改 `is_shared` 状态
  - 显示当前共享状态
  - 非创建者不能编辑（显示只读提示）

#### 任务 4.4.3: 资源权限提示
- [ ] 在资源详情页显示：
  - 创建者信息
  - 共享状态（私有/共享/系统）
  - 编辑权限提示
- [ ] 在资源列表显示标签：
  - 🌐 系统资源
  - 👥 共享资源
  - 🔒 私有资源
- [ ] 非创建者查看时显示锁定图标

## 5. 使用场景示例

### 5.1 超级管理员创建系统资源

**场景**：超级管理员创建通用的智能体角色供所有租户使用

1. 超级管理员登录系统
2. 进入"智能体角色管理"
3. 创建新角色"产品经理"
4. 选择"创建为系统资源"（默认选中）
5. 系统设置 `created_by = NULL, is_shared = True`
6. 所有租户都可以看到并使用这个角色

**数据库**：
```sql
INSERT INTO roles (id, name, description, created_by, is_shared)
VALUES ('uuid-1', '产品经理', '负责产品规划', NULL, TRUE);
-- created_by = NULL, is_shared = TRUE 表示系统资源
```

### 5.2 租户创建私有资源

**场景**：租户创建自己的定制资源（默认私有）

1. 租户A登录系统
2. 创建智能体角色"我的定制角色"
3. 不勾选"共享"复选框
4. 系统设置 `created_by = 租户A的ID, is_shared = False`
5. 只有租户A可以看到和使用这个角色

**数据库**：
```sql
INSERT INTO roles (id, name, description, created_by, is_shared)
VALUES ('uuid-2', '我的定制角色', '私有角色', 'tenant_a_id', FALSE);
-- created_by = tenant_a_id, is_shared = FALSE 表示私有资源
```

### 5.3 租户创建并共享资源

**场景**：租户创建资源并共享给其他用户

1. 租户B登录系统
2. 创建智能体角色"通用测试工程师"
3. 勾选"共享给其他用户"复选框
4. 系统设置 `created_by = 租户B的ID, is_shared = True`
5. 所有用户都可以看到和使用这个角色
6. 但只有租户B可以编辑这个角色

**数据库**：
```sql
INSERT INTO roles (id, name, description, created_by, is_shared)
VALUES ('uuid-3', '通用测试工程师', '共享角色', 'tenant_b_id', TRUE);
-- created_by = tenant_b_id, is_shared = TRUE 表示用户共享资源
```

### 5.4 租户查看可用资源

**场景**：租户A查看可用的智能体角色

1. 租户A登录系统
2. 进入"智能体角色管理"
3. 可以看到：
   - 系统资源：产品经理（created_by = NULL, is_shared = True）
   - 自己的私有资源：我的定制角色（created_by = 租户A, is_shared = False）
   - 其他用户共享的资源：通用测试工程师（created_by = 租户B, is_shared = True）
4. 不能看到：
   - 其他用户的私有资源

**查询**：
```sql
-- 租户A查看可用的角色
SELECT * FROM roles
WHERE is_shared = TRUE OR created_by = 'tenant_a_id';
```

### 5.5 权限检查示例

**场景**：租户A尝试查看和编辑不同类型的资源

```python
# 1. 租户A查看系统资源
role_system = Role.query.filter_by(created_by=None, is_shared=True).first()
can_view = UserPermissionService.can_view_resource(tenant_a, role_system)
# 结果: True（共享资源，所有人可见）
can_edit = UserPermissionService.can_edit_resource(tenant_a, role_system)
# 结果: False（只有超级管理员可以编辑系统资源）

# 2. 租户A查看和编辑自己的私有资源
role_own = Role.query.filter_by(created_by=tenant_a.id, is_shared=False).first()
can_view = UserPermissionService.can_view_resource(tenant_a, role_own)
# 结果: True（自己的资源可见）
can_edit = UserPermissionService.can_edit_resource(tenant_a, role_own)
# 结果: True（可以编辑自己的资源）

# 3. 租户A查看租户B共享的资源
role_shared = Role.query.filter_by(created_by=tenant_b.id, is_shared=True).first()
can_view = UserPermissionService.can_view_resource(tenant_a, role_shared)
# 结果: True（共享资源，所有人可见）
can_edit = UserPermissionService.can_edit_resource(tenant_a, role_shared)
# 结果: False（不能编辑其他租户的资源）

# 4. 租户A尝试查看租户B的私有资源
role_private = Role.query.filter_by(created_by=tenant_b.id, is_shared=False).first()
can_view = UserPermissionService.can_view_resource(tenant_a, role_private)
# 结果: False（不能查看其他租户的私有资源）
```

## 6. 安全考虑

### 6.1 数据隔离
- ✅ 所有API必须使用 `filter_viewable_resources()` 过滤资源
- ✅ 防止通过ID直接访问其他租户的私有资源
- ✅ 编辑/删除操作必须检查 `can_edit_resource()` 和 `can_delete_resource()`

### 6.2 权限验证
- ✅ 前后端都要验证权限
- ✅ 敏感操作需要二次确认
- ✅ 记录资源访问日志（可选）

### 6.3 系统资源保护
- ✅ 系统资源（created_by = NULL）不能被普通用户修改
- ✅ 只有超级管理员可以修改系统资源
- ✅ 删除系统资源前检查使用情况（防止删除正在使用的资源）

### 6.4 数据一致性
- ✅ `created_by` 字段必须是有效的用户ID或NULL
- ✅ 外键约束确保数据完整性
- ✅ 删除用户时处理其创建的资源（转移给管理员或删除）

## 7. 设计总结

### 7.1 核心设计

| 方面 | 实现方式 |
|-----|---------|
| 数据库字段 | created_by + is_shared |
| 资源类型 | 3种（系统/用户共享/私有） |
| 判断逻辑 | is_shared 判断 + created_by 判断 |
| 用户体验 | 简单的"共享"复选框 |
| 代码复杂度 | 低 |

### 7.2 优势

1. ✅ **实现简单**：只需添加两个字段
2. ✅ **逻辑清晰**：
   - `created_by = NULL, is_shared = True` → 系统资源
   - `created_by = user_id, is_shared = True` → 用户共享资源
   - `created_by = user_id, is_shared = False` → 私有资源
3. ✅ **用户友好**：一个"共享"复选框即可控制
4. ✅ **易于维护**：数据结构简单，没有复杂的一致性问题
5. ✅ **性能好**：查询条件简单，索引友好
6. ✅ **灵活性高**：用户可以自由选择是否共享资源

### 7.3 与纯KISS版本的对比

| 方面 | 纯KISS版本 | 当前版本 |
|-----|-----------|---------|
| 字段数量 | 1个（created_by） | 2个（created_by + is_shared） |
| 资源类型 | 2种 | 3种 |
| 用户共享 | ❌ 不支持 | ✅ 支持 |
| 复杂度 | 极低 | 低 |

**结论**：当前版本在保持简单的同时，增加了用户共享功能，满足实际需求。

### 7.4 未来扩展（如果需要）

如果未来需要更复杂的共享模型，可以考虑：

1. **细粒度共享**：添加 `shared_with` JSON字段，指定共享给哪些用户
2. **资源权限**：添加 `permissions` JSON字段，控制查看/使用/编辑权限
3. **组织和团队**：添加 `organization_id` 字段，支持组织内共享
4. **资源市场**：添加 `is_marketplace` 字段，发布到资源市场

但现在，**当前版本已经足够满足需求**。

