# 2026-05-13 — public 分支首次 push 即泄露真实凭证

## 摘要

把 `public` 分支首次 push 到 `github.com/mesalogo/mesalogo` 时,**未做任何 secret-scan**,
随仓库一起公开的有:

1. `backend-deprecated/config.conf`
   - 真实 Google OAuth `CLIENT_ID` 和 `CLIENT_SECRET`
   - 真实 Microsoft OAuth `CLIENT_ID` 和 `CLIENT_SECRET`
   - 真实 MySQL `DATABASE_URI`(含凭证)
   - 生产域名 `mesalogo.digiman.live`
2. `abm-docker/docker-compose.galapagos.yml`
   - 47 字符真实 `PLAY_HTTP_SECRET_KEY` 硬编码在 compose 文件里
3. `desktop-app/publish-update-server.sh`
   - 内部更新服务器域名 `update-mesalogo.digiman.live`
4. `docs/feature-nextrpa/PLAN-vnc*.md`
   - 内部网段 `192.168.0.22 / 192.168.0.23`
5. `AGENTS.md`(本次修复时新加入,旋即修正)
   - 内部 git 服务器地址 `192.168.0.50:7022`

## 根因

1. **AGENTS.md 早就写了"`backend-deprecated/` 不要读、不要改"**,但**没说"必须从 public 分支删除"**。
   于是 Agent 把它当 normal tracked 文件随 push 一并送出。
2. 没有自动化的 secret-scan(`gitleaks` / `detect-secrets`)在 push 前拦截。
3. push 时没区分远端的"内部 vs 公开"语义,直接 `git push -u mesalogo public:main`,
   导致把所有 origin 历史里的内容一并复制到 GitHub。
4. AGENTS.md §7 写了"不自动 push",但 push 已经经用户授权;
   缺一道"push 到公开远端前的 secret-scan 强制门"。

## 行动项(本次已做)

- ✅ 删除 `backend-deprecated/`(本次 commit 一并 `git rm`);untracked 的本地数据保留。
- ✅ `abm-docker/docker-compose.galapagos.yml` 改为 `${PLAY_HTTP_SECRET_KEY:?...}`。
- ✅ `desktop-app/publish-update-server.sh` 改为 `${UPDATE_BASE_URL:-https://update.example.com}`。
- ✅ `docs/feature-external-platform/...` 的 `app.digiman.live` 改为 `{DIFY_HOST}` 占位。
- ✅ `docs/feature-nextrpa/PLAN-vnc*.md` 的 `192.168.0.22/23` 改为 RFC5737 文档专用网段 `192.0.2.22/23`。
- ✅ `AGENTS.md` §1.1 移除 `192.168.0.50:7022`,改为"详见 `git remote -v`"。
- ✅ `.gitignore` 加 `backend-deprecated/` 阻止未来重新跟踪。
- ✅ AGENTS.md §3 增加"推送到 public/mesalogo 前必须 secret-scan"红线(见本次提交)。
- ⚠️ **必须由人工完成**:
  - 在 Google Cloud Console 轮换 `56264159529-eqlkg216fatkbcm3bfflkrbpge0disfp` 客户端的 secret。
  - 在 Azure Portal 轮换 `2e2a62c9-7158-4d64-a231-1d4862d82b52` 应用的 secret。
  - 修改对应 MySQL 用户的密码,并 revoke 旧密码的访问。
  - 重新生成 Play HTTP Secret Key(`openssl rand -base64 36`)。

## 历史污染的处理

仅在 working tree 删除文件 + `force push` 仍然**不能彻底清除 GitHub 上的 git 历史**:
- 任何人 `git clone` 过期间窗口都拿到了完整内容;
- 即使 force push 后,GitHub 在一段时间内仍可通过旧 commit hash 访问。

因此正确的兜底是**轮换所有泄露的密钥**(见上)。这一步不可替代。

## 复发预防

1. AGENTS.md §3.1 新增条目:推送到 `public` / `mesalogo` 前必须跑 secret-scan。
2. TODO: 安装 `pre-commit` hook(gitleaks),并在 `make publish` 流程加 secret-scan 步骤。
3. TODO: 考虑用 git-filter-repo 把 `backend-deprecated/` 从 `public` 分支的全部历史移除,
   force push 之后再请 GitHub 清 cache(`POST /repos/{owner}/{repo}/dispatches` 触发 GC 不可用,
   只能 contact support 或等 90 天自然过期)。
