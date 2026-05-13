@echo off
setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set FRONTEND_DIR=%SCRIPT_DIR%..\frontend
set DESKTOP_DIR=%SCRIPT_DIR%

echo === ABM-LLM Desktop App Build Script (Electron) for Windows ===

:: 1. 构建前端
echo [1/5] Building frontend...
cd /d "%FRONTEND_DIR%"
call pnpm build
if errorlevel 1 (
    echo Frontend build failed!
    exit /b 1
)

:: 2. 复制前端构建产物到 desktop-app/dist
echo [2/5] Copying frontend build to desktop-app/dist...
if exist "%DESKTOP_DIR%dist" rmdir /s /q "%DESKTOP_DIR%dist"
xcopy /E /I /Q "%FRONTEND_DIR%\build" "%DESKTOP_DIR%dist"

:: 3. 确保路径为绝对路径（适配 Electron 本地 HTTP 服务器 + SPA 路由）
echo [3/5] Patching paths for Electron...

:: 在 index.html 头部添加 base 标签（使用绝对路径，避免 SPA 路由问题）
powershell -Command "(Get-Content '%DESKTOP_DIR%dist\index.html') -replace '<head>', '<head><base href=\"/\">' | Set-Content '%DESKTOP_DIR%dist\index.html'"
echo   Patched index.html with base href

:: 4. 安装依赖（如果需要）
echo [4/5] Checking dependencies...
cd /d "%DESKTOP_DIR%"
if not exist "node_modules" (
    call npm install
)

:: 5. 构建 Electron 应用
echo [5/5] Building Electron application for Windows...
call npm run build:win

echo === Build complete! ===
echo Output: %DESKTOP_DIR%release\

endlocal
