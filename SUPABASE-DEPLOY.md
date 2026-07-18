# Supabase Edge Functions 部署指南

## 第 1 步：在 Supabase 创建表结构

1. 访问 [Supabase 项目](https://supabase.com/dashboard/project/vxsetefeaquvxbwarmis)
2. 进入 **SQL Editor**
3. 点击 **New Query**
4. 复制 `supabase/setup.sql` 的内容并粘贴
5. 点击 **Run** 执行 SQL

## 第 2 步：获取 Supabase 凭据

1. 进入 **Settings** → **API**
2. 复制以下信息：
   - **Project URL** (supabaseUrl)
   - **service_role** 密钥 (supabaseServiceKey)

## 第 3 步：部署 Supabase Edge Function

### 方法 A: 使用 Supabase CLI（推荐）

1. **安装 Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **登录 Supabase**
   ```bash
   supabase login
   ```

3. **链接项目**
   ```bash
   cd "D:\BaiduSyncdisk\为明相关\2. 国际部\【排课系统】\【可用版本】"
   supabase link --project-ref vxsetefeaquvxbwarmis
   ```

4. **部署 Function**
   ```bash
   supabase functions deploy api
   ```

### 方法 B: 通过 Supabase 控制台手动部署

1. 访问 [Supabase Edge Functions](https://supabase.com/dashboard/project/vxsetefeaquvxbwarmis/functions)
2. 点击 **New Function**
3. Function 名称：`api`
4. 复制 `supabase/functions/api.ts` 的内容并粘贴
5. 点击 **Deploy**

## 第 4 步：配置环境变量

在 Supabase Functions 设置中添加环境变量（如果需要）：
- `SUPABASE_URL` = 你的 Project URL
- `SUPABASE_SERVICE_ROLE_KEY` = 你的 service_role 密钥

## 第 5 步：更新前端 API URL

1. 打开 `src/App.tsx` 或 API 配置文件
2. 将 API URL 改为：
   ```
   https://vxsetefeaquvxbwarmis.supabase.co/functions/v1/api
   ```

3. 重新构建并部署前端：
   ```bash
   npm run build
   # 然后重新部署到 Netlify
   ```

## 验证部署

1. **测试 API**：
   ```
   curl https://vxsetefeaquvxbwarmis.supabase.co/functions/v1/api/bootstrap
   ```

2. **访问前端**：
   ```
   https://weiming-scheduler.netlify.app
   ```

3. **测试功能**：
   - 创建教师/学生/教室
   - 进行排课操作
   - 刷新页面，确认数据已保存

## 完整架构

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Netlify       │      │  Supabase Edge   │      │   Supabase      │
│   (前端)        │──────│  Functions       │──────│   PostgreSQL    │
│                 │      │  (后端 API)       │      │   (数据库)      │
└─────────────────┘      └──────────────────┘      └─────────────────┘
```

**所有数据永久存储在 Supabase PostgreSQL 数据库中！**
