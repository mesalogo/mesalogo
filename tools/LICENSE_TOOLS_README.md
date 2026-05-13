# License 工具使用说明

本目录包含用于生成和验证系统许可证的工具。

## 工具列表

1. `license_generator.py` - 许可证生成工具
2. `license_validator.py` - 许可证验证工具

## 许可证类型

系统支持以下三种许可证类型：

1. **标准版 (standard)**
   - 基本智能体功能
   - 基本角色功能
   - 基本行动空间功能
   - 最多10个智能体
   - 最多5个行动空间
   - 最多20个角色

2. **专业版 (professional)**
   - 包含标准版所有功能
   - 高级智能体功能
   - 高级角色功能
   - 知识库功能
   - 最多50个智能体
   - 最多20个行动空间
   - 最多100个角色

3. **旗舰版 (enterprise)**
   - 包含专业版所有功能
   - 自定义工具功能
   - 高级分析功能
   - 无限记忆功能
   - 最多999个智能体
   - 最多999个行动空间
   - 最多999个角色

## 使用方法

### 生成许可证

```bash
python license_generator.py --customer "公司名称" --type enterprise --days 365 --output data/licenses/customer_name_enterprise.json --secret "license-key-for-development-only"
```

参数说明：
- `--customer` - 客户名称（必填）
- `--type` - 许可证类型，可选值：standard, professional, enterprise（默认：standard）
- `--days` - 许可证有效期天数，不指定则永久有效
- `--output` - 输出文件路径（建议保存到 data/licenses 目录）
- `--secret` - 用于签名的密钥，**必须与客户系统中的密钥相同**

### 关于系统密钥

每个系统都有一个唯一的密钥，用于验证许可证的有效性。客户需要将其系统密钥提供给厂商，厂商使用这个密钥生成许可证。

默认的系统密钥是：`license-key-for-development-only`

在生产环境中，建议客户更改系统密钥，并将新密钥提供给厂商。

### License文件存储位置

生成的license文件建议统一存放在项目的 `data/licenses` 目录下，便于管理。例如：

```
data/licenses/
  ├── company1_enterprise.json
  ├── company2_professional.json
  └── company3_standard.json
```

### 验证许可证

```bash
python license_validator.py --file license.json --secret "YOUR_SECRET_KEY"
```

或者直接验证许可证密钥：

```bash
python license_validator.py --key "LICENSE_KEY" --secret "YOUR_SECRET_KEY" --customer "公司名称" --type enterprise
```

参数说明：
- `--file` - 许可证文件路径
- `--key` - 许可证密钥
- `--secret` - 用于验证的密钥（必填）
- `--customer` - 客户名称（可选，用于额外验证）
- `--type` - 许可证类型（可选，用于额外验证）

## 注意事项

1. 生成许可证时会输出一个密钥，请妥善保存此密钥，它用于验证许可证的有效性。
2. 许可证文件包含加密的许可证数据，只有使用正确的密钥才能解密和验证。
3. 许可证密钥是一个32字符的字符串，可以直接提供给客户用于激活系统。
4. 建议为每个客户生成唯一的许可证，并记录对应的客户信息和许可证类型。

## 集成到系统

要将许可证功能集成到系统中，需要：

1. 在系统中添加许可证验证逻辑，使用`LicenseValidator`类验证许可证。
2. 在系统启动时检查许可证的有效性。
3. 根据许可证类型限制系统功能。
4. 在前端显示许可证信息。

### 示例代码

```python
from tools.license_validator import LicenseValidator

# 初始化验证器
validator = LicenseValidator(secret_key)

# 验证许可证文件
valid, license_data = validator.validate_license_file('path/to/license.json')
if valid:
    print("许可证有效")
    # 根据license_data中的信息设置系统功能限制
else:
    print("许可证无效或已过期")
    # 限制系统功能或显示激活页面
```
