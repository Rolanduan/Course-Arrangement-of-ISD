# 排课系统快速部署指南

## ✅ 已完成的准备工作

- ✅ 数据库抽象层已创建（支持 PostgreSQL/MySQL）
- ✅ Netlify Functions 配置完成
- ✅ 环境变量模板已创建
- ✅ 项目构建成功
- ✅ 所有依赖已安装

## 🚀 下一步：部署到 Netlify

### 步骤 1: 准备云数据库

**选择阿里云 RDS PostgreSQL**（推荐）：

1. 登录 [阿里云控制台](https://rdsnext.console.aliyun.com/)
2. 创建 **PostgreSQL** 实例
   - 版本：PostgreSQL 14 或更高
   - 规格：最小配置即可（2核 2GB 足够 2-10 人使用）
   - 网络：选择 **专有网络**，确保可公网访问
3. 创建数据库 `scheduler`
4. 创建白账号并授权
5. 获取**连接字符串**，格式如下：
   ```
   postgresql://账号名:密码@实例连接地址:端口/数据库名
   ```

### 步骤 2: 部署到 Netlify

#### 方法 A: 通过 GitHub 部署（推荐）

1. **推送代码到 GitHub**：
   ```bash
   cd "D:\BaiduSyncdisk\为明相关\2. 国际部\【排课系统】\【可用版本】"

   git init
   git add .
   git commit -m "准备云端部署"

   # 创建 GitHub 仓库后
   git remote add origin https://github.com/你的用户名/排课系统.git
   git push -u origin main
   ```

2. **在 Netlify 导入项目**：
   - 访问 [Netlify](https://app.netlify.com)
   - 点击 "New site from Git"
   - 选择 GitHub，授权后选择刚创建的仓库
   - 配置构建设置：
     - **Branch**: `main`
     - **Build command**: `npm run build`
     - **Publish directory**: `dist`

3. **配置环境变量**：
   在 Site settings → Environment variables → Add a variable 中添加：
   ```
   DB_TYPE=postgresql
   DATABASE_URL=postgresql://用户名:密码@主机:端口/数据库名
   ```

4. **点击 Deploy**

#### 方法 B: 使用 Netlify CLI

1. **安装 Netlify CLI**：
   ```bash
   npm install -g netlify-cli
   ```

2. **登录并部署**：
   ```bash
   cd "D:\BaiduSyncdisk\为明相关\2. 国际部\【排课系统】\【可用版本】"

   netlify login
   netlify init
   netlify env:set DB_TYPE postgresql
   netlify env:set DATABASE_URL "你的连接字符串"
   netlify deploy --prod
   ```

### 步骤 3: 验证部署

1. **访问您的站点**：`https://xxx.netlify.app`
2. **测试功能**：
   - 检查数据是否正常加载
   - 创建新的教师/学生
   - 进行排课操作
   - 刷新页面，确认数据已保存

## 📋 重要提醒

1. **数据库连接字符串格式**：
   ```
   postgresql://用户名:密码@主机:端口/数据库名
   ```
   示例：
   ```
   postgresql://scheduler:MyPassword123@rm-xxxxx.rds.aliyuncs.com:5432/scheduler
   ```

2. **确保数据库可公网访问**：
   - 添加安全组规则，允许 Netlify 的 IP 范围
   - 或使用 0.0.0.0/0（仅用于测试）

3. **环境变量在 Netlify 中的配置**：
   - 不要在代码中硬编码密码
   - 使用 Netlify 的环境变量功能

## 🔄 从本地 SQLite 迁移数据

如果您有本地数据需要迁移：

1. **导出本地数据**：
   ```bash
   sqlite3 data/scheduler.db .dump > backup.sql
   ```

2. **手动转换数据格式**（需要根据实际情况调整）

3. **导入到云端数据库**

## 💰 成本参考

| 服务 | 免费层/最小配置 | 价格 |
|------|-----------------|------|
| Netlify | 100GB 带宽/月 | 免费 |
| 阿里云 RDS | 2核 2GB PostgreSQL | 约 ¥100/月 |
| 腾讯云 PostgreSQL | 最小实例 | 约 ¥200/月 |

**小规模使用（2-10人）成本：约 ¥100/月**

## 🆘 需要帮助？

- [Netlify 部署文档](https://docs.netlify.com/)
- [阿里云 RDS 文档](https://help.aliyun.com/product/27330.html)
- 详细部署指南：参阅 [DEPLOYMENT.md](./DEPLOYMENT.md)
