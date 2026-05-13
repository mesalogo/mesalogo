# 步骤4: 后端打包

## 📦 使用 PyInstaller 打包 Flask 应用

### 4.1 安装 PyInstaller

```bash
cd backend
pip install pyinstaller
```

### 4.2 创建打包脚本

创建 `backend/build.py`:

```python
#!/usr/bin/env python3
"""
Flask 后端打包脚本
使用 PyInstaller 将 Flask 应用打包为独立可执行文件
"""
import os
import sys
import shutil
import platform
from pathlib import Path

def clean_build():
    """清理之前的构建"""
    dirs_to_clean = ['build', 'dist', '__pycache__']
    for dir_name in dirs_to_clean:
        if os.path.exists(dir_name):
            print(f"清理 {dir_name}...")
            shutil.rmtree(dir_name)
    
    # 删除 .spec 文件
    for spec_file in Path('.').glob('*.spec'):
        print(f"删除 {spec_file}...")
        spec_file.unlink()

def build_backend():
    """打包后端"""
    print("开始打包 Flask 后端...")
    
    # PyInstaller 参数
    args = [
        'pyinstaller',
        '--name=run_app',
        '--onefile',  # 打包成单个文件
        '--clean',
        '--noconfirm',
        
        # 隐藏控制台窗口（Windows）
        '--noconsole' if platform.system() == 'Windows' else '',
        
        # 添加数据文件
        '--add-data=app:app',
        '--add-data=config.py:.',
        '--add-data=config.conf:.',
        
        # 隐藏导入
        '--hidden-import=flask',
        '--hidden-import=flask_cors',
        '--hidden-import=flask_sqlalchemy',
        '--hidden-import=sqlalchemy',
        '--hidden-import=PIL',
        '--hidden-import=jwt',
        '--hidden-import=passlib',
        '--hidden-import=bcrypt',
        '--hidden-import=mcp',
        '--hidden-import=httpx',
        '--hidden-import=nest_asyncio',
        '--hidden-import=tiktoken_ext.openai_public',
        '--hidden-import=tiktoken_ext',
        
        # 收集子模块
        '--collect-submodules=app',
        '--collect-submodules=mcp',
        '--collect-submodules=flask',
        '--collect-submodules=sqlalchemy',
        
        # 收集数据（模型文件等）
        '--collect-data=sentence_transformers',
        '--collect-data=tiktoken_ext',
        
        # 排除不需要的模块（减小体积）
        '--exclude-module=matplotlib',
        '--exclude-module=numpy.distutils',
        '--exclude-module=tkinter',
        
        # 入口文件
        'run_app.py'
    ]
    
    # 过滤空参数
    args = [arg for arg in args if arg]
    
    # 执行打包
    cmd = ' '.join(args)
    print(f"执行命令: {cmd}")
    
    result = os.system(cmd)
    
    if result == 0:
        print("\n✅ 打包成功！")
        print(f"可执行文件位于: {os.path.abspath('dist')}")
        
        # 显示文件大小
        exe_name = 'run_app.exe' if platform.system() == 'Windows' else 'run_app'
        exe_path = os.path.join('dist', exe_name)
        if os.path.exists(exe_path):
            size_mb = os.path.getsize(exe_path) / (1024 * 1024)
            print(f"文件大小: {size_mb:.2f} MB")
    else:
        print("\n❌ 打包失败！")
        sys.exit(1)

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='打包 Flask 后端')
    parser.add_argument('--clean', action='store_true', help='清理之前的构建')
    args = parser.parse_args()
    
    if args.clean:
        clean_build()
    
    build_backend()
```

### 4.3 创建 .spec 配置文件（可选，更精细控制）

创建 `backend/run_app.spec`:

```python
# -*- mode: python ; coding: utf-8 -*-

import sys
from pathlib import Path

block_cipher = None

# 分析入口点
a = Analysis(
    ['run_app.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('app', 'app'),
        ('config.py', '.'),
        ('config.conf', '.'),
    ],
    hiddenimports=[
        'flask',
        'flask_cors',
        'flask_sqlalchemy',
        'sqlalchemy',
        'PIL',
        'jwt',
        'passlib',
        'bcrypt',
        'mcp',
        'httpx',
        'nest_asyncio',
        'tiktoken_ext.openai_public',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'numpy.distutils',
        'tkinter',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# 打包资源
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# 生成可执行文件
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='run_app',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False if sys.platform == 'win32' else True,  # Windows 隐藏控制台
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
```

### 4.4 执行打包

```bash
cd backend

# 方式1: 使用脚本
python build.py --clean

# 方式2: 直接使用 PyInstaller
pyinstaller run_app.spec

# 方式3: 使用简化命令
pyinstaller --onefile --clean run_app.py
```

---

## ⚠️ 常见问题

### 问题1: 找不到模块

**解决方案**: 在 `hiddenimports` 中添加缺失的模块

```python
hiddenimports=[
    'your_missing_module',
]
```

### 问题2: 数据库文件路径错误

**解决方案**: 修改 `backend/config.py`，使用运行时路径：

```python
import sys

# 获取应用目录
if getattr(sys, 'frozen', False):
    # 打包后的环境
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # 开发环境
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# 数据库路径
SQLALCHEMY_DATABASE_URI = f'sqlite:///{os.path.join(BASE_DIR, "app.db")}'
```

### 问题3: 打包体积过大

**解决方案**: 排除不必要的依赖

```bash
# 检查依赖树
pip install pipdeptree
pipdeptree

# 移除不必要的包
pip uninstall matplotlib numpy pandas
```

### 问题4: PaddleOCR/MinerU 等大型库

**方案A**: 排除这些库，改为可选依赖

```python
# 在代码中动态导入
try:
    from mineru import parse_document
    MINERU_AVAILABLE = True
except ImportError:
    MINERU_AVAILABLE = False
    print("Warning: MinerU not available")
```

**方案B**: 单独打包这些服务，通过 HTTP 调用

---

## 🧪 测试打包后的应用

```bash
# 运行可执行文件
./dist/run_app  # Linux/macOS
dist\run_app.exe  # Windows

# 测试 API
curl http://localhost:8080/health
```

---

## 📊 优化建议

### 减小体积

1. **使用虚拟环境**: 只安装必要的包
2. **UPX 压缩**: PyInstaller 自带（需安装 UPX）
3. **排除测试代码**: 不打包 `tests/` 目录
4. **移除开发依赖**: 生产环境不需要 pytest 等

### 提高性能

1. **预编译**: 使用 `--optimize=2` 优化字节码
2. **缓存**: 保留 `.pyc` 文件
3. **懒加载**: 延迟导入大型模块

---

## 🎯 下一步

继续 [05-build-and-release.md](./05-build-and-release.md) 完成整体打包和发布。
