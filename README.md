# 重庆为明国际教学资源规划与智能排课平台

这是依据《重庆为明国际教务排课系统总体开发思路》启动的第一阶段可运行版本，重点验证“基础数据 → 周课表 → 人工调整 → 后端冲突校验 → 锁定与快照”的完整链路。

## 已实现

- 教务工作台：基础数据完整度、排课进度、硬约束问题中心
- 基础数据：教师、学生、教室、教学班分类查看
- 周课表：离散时间槽、单节/连堂展示、课程体系颜色区分
- 人工调整：拖放课次，后端进行教师、学生、教室、容量权威校验
- 锁定：锁定课次后禁止移动
- 版本：保存当前排课结果为数据库快照
- 持久化：使用 Node.js 内置 SQLite，首次启动自动创建示例数据
- 自动化验证：约束检查单元测试和 TypeScript 生产构建

## 启动

需要 Node.js 22.5 或更高版本（使用了内置 `node:sqlite`）。

```powershell
npm install
npm run dev
```

浏览器访问 <http://localhost:5173>，后端健康检查为 <http://localhost:3100/api/health>。

生产前端构建：

```powershell
npm run build
npm test
```

## 目录

- `src/`：React + TypeScript 管理端
- `server/`：模块化 API、SQLite 存储和约束校验
- `data/scheduler.db`：本地运行后生成的数据库（不纳入版本控制）
- `dist/`：生产构建结果

## 当前边界

这是第一阶段纵向切片，不是完整生产版。Excel 导入、完整 CRUD、ConcurrentBlock、自动求解器、撤销/重做、权限、Excel/PDF 导出尚未接入。后端领域边界已将排课分配和约束校验独立，后续可迁移到 Spring Boot + PostgreSQL，并接入独立 Timefold 求解进程。

## 下一阶段建议顺序

1. 完成教师、学生、教室、课程、教学班、时间槽的 CRUD 与 Excel 事务化导入。
2. 增加 Enrollment、SessionRequirement、SessionPattern 与 ConcurrentBlock 数据模型。
3. 增加课表版本复制、对比、恢复、撤销/重做与审计日志。
4. 接入可行初稿生成器，再升级为 Timefold 独立求解进程。
5. 增加教师、学生、教室多视图及 Excel/PDF 导出。
