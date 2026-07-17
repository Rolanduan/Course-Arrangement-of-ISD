# 排课系统云端部署指南

本文档说明如何将重庆为明国际教学资源规划与智能排课平台部署到 Netlify 并使用云端数据库实现数据永久存储。

## 部署架构

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Netlify   │──────│  Cloud RDS   │──────│   数据持久化 │
│   (前端)    │      │  PostgreSQL/ │      │   多用户协作 │
│             │      │     MySQL    │      │             │
└─────────────┘      └──────────────┘      └─────────────┘
```

## 前置要求

1. **云数据库**（选择其一）:
   - 阿里云 RDS PostgreSQL/MySQL
   - 腾讯云 PostgreSQL/MySQL
   - Azure Database for PostgreSQL/MySQL
   - AWS RDS

2. **Netlify 账户**: [注册 Netlify](https://app.netlify.com/signup)

## 步骤 1: 准备云数据库

### 阿里云 RDS PostgreSQL 示例

1. 登录阿里云控制台，创建 RDS PostgreSQL 实例
2. 创建数据库 `scheduler`
3. 创建用户并授权
4. 获取连接字符串，格式如：
   ```
   postgresql://scheduler_user:password@rm-xxxxx.rds.aliyuncs.com:5432/scheduler
   ```

### 腾讯云 PostgreSQL 示例

1. 登录腾讯云控制台，创建 PostgreSQL 实例
2. 获取外网地址和端口
3. 连接字符串格式：
   ```
   postgresql://scheduler_user:password@xxx.tencentpg.com:5432/scheduler
   ```

## 步骤 2: 部署到 Netlify

### 方法 A: 通过 Git 仓库部署（推荐）

1. **将代码推送到 Git 仓库**（GitHub/GitLab/Bitbucket）

   ```bash
   git init
   git add .
   git commit -m "准备云端部署"
   git push origin main
   ```

2. **在 Netlify 导入项目**
   - 登录 [Netlify](https://app.netlify.com)
   - 点击 "New site from Git"
   - 选择您的 Git 仓库
   - 配置构建设置：
     - Build command: `npm run build`
     - Publish directory: `dist`

3. **配置环境变量**
   在 Netlify 站点设置中添加以下环境变量：
   ```
   DB_TYPE=postgresql
   DATABASE_URL=postgresql://user:password@host:port/dbname
   ```

4. **部署**
   - Netlify 会自动部署
   - 部署完成后获得 URL: `https://xxx.netlify.app`

### 方法 B: 通过 Netlify CLI 手动部署

1. **安装 Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **登录 Netlify**
   ```bash
   netlify login
   ```

3. **初始化项目**
   ```bash
   cd "D:\BaiduSyncdisk\为明相关\2. 国际部\【排课系统】\【可用版本】"
   netlify init
   ```

4. **设置环境变量**
   在 Netlify 控制台的 Site settings > Environment variables 中添加：
   - `DB_TYPE=postgresql`
   - `DATABASE_URL=your_connection_string`

5. **部署**
   ```bash
   npm run deploy
   ```

## 步骤 3: 验证部署

1. **访问您的站点**，例如 `https://xxx.netlify.app`

2. **测试基本功能**:
   - 查看课表数据是否正常加载
   - 创建新的教师/学生/教室
   - 进行排课操作
   - 刷新页面，确认数据已保存

3. **测试多用户协作**:
   - 在不同浏览器中打开站点
   - 同时进行操作，验证实时更新

## 数据库迁移说明

如果需要从本地 SQLite 数据迁移到云端数据库：

1. **导出本地数据**
   ```bash
   # 使用 SQLite 工具导出
   sqlite3 data/scheduler.db .dump > backup.sql
   ```

2. **在云端数据库中执行建表语句**
   参考 `server/db-cloud.ts` 中的 schema

3. **导入数据**（需要手动转换格式）

## 环境变量参考

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `DB_TYPE` | 是 | `postgresql` 或 `mysql` |
| `DATABASE_URL` | PostgreSQL | 连接字符串 |
| `MYSQL_HOST` | MySQL | 数据库主机 |
| `MYSQL_PORT` | MySQL | 端口（默认 3306） |
| `MYSQL_USER` | MySQL | 用户名 |
| `MYSQL_PASSWORD` | MySQL | 密码 |
| `MYSQL_DATABASE` | MySQL | 数据库名 |

## 本地开发（使用云端数据库）

如需在本地开发时直接连接云端数据库：

```bash
# Windows PowerShell
$env:DB_TYPE="postgresql"
$env:DATABASE_URL="postgresql://user:password@host:port/dbname"
npm run dev

# Linux/Mac
DB_TYPE=postgresql DATABASE_URL="..." npm run dev
```

## 故障排除

### 1. API 请求失败
- 检查环境变量是否正确设置
- 确认数据库可从 Netlify 访问
- 查看 Netlify 函数日志

### 2. 数据未保存
- 验证数据库连接字符串
- 检查数据库用户权限
- 确认表已正确创建

### 3. CORS 错误
- Netlify Functions 自动处理 CORS
- 如仍遇问题，检查 netlify.toml 配置

## 成本估算

- **Netlify**: 免费层支持 100GB 带宽/月，125k 函数调用/月
- **阿里云 RDS**: 最小实例约 ¥100/月
- **腾讯云 PostgreSQL**: 最小实例约 ¥200/月

小规模使用（2-10人）可在免费额度内运行。

## 下一步

部署完成后，您可以考虑：
1. 配置自定义域名
2. 启用 HTTPS（Netlify 自动提供）
3. 设置自动备份
4. 配置 CI/CD 流程
5. 添加用户认证
