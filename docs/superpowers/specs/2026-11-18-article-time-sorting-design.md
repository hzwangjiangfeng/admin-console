# 文章时间排序增量设计

## 意图与范围

在已有文章后台中新增 `updatedAt`（更新时间），使 `createdAt` 和 `updatedAt` 都支持 `asc`、`desc` 单字段排序。用户已明确将字段名修正为 `updatedAt`，不使用 `updateAt`。沿用现有分页、筛选、Query 缓存及 Native 执行方式，不重做应用。

依据：现有实现、2026-11-17 设计快照，以及最新桌面 React.md 中的列表规则。最新桌面文档已经明确：切换排序字段或方向时回到第 1 页；本次实现遵循这一规则，不延续旧代码保留当前页的行为。

## Approaches

- **沿用接口排序，扩展已有白名单与表格列（采用）**：URL、请求、Query Key、Mock 对同一排序条件达成一致，先对全部筛选结果排序，再分页。
- **前端仅排序当前页（不采用）**：会使跨页顺序错误，与现有服务端分页架构冲突。

## 行为

- Article 与 ArticleListItem 都包含只读 `updatedAt: string`，格式与 createdAt 相同，为 ISO 8601 UTC。
- 新增成功时两时间字段取同一个服务端时间；已有种子文章初始 updatedAt 等于 createdAt。
- 有效 PATCH 成功时更新 updatedAt，createdAt 不变；失败请求不能改变任何时间字段。
- 新增/编辑请求体仍只有 title、channelId、content；不允许客户端覆盖 createdAt 或 updatedAt。
- URL 允许 `sortBy=createdAt|updatedAt` 和 `sortOrder=asc|desc`；缺省或非法时仍使用 createdAt、desc；不增加 updateAt 别名。
- 列表增加“更新时间”列，两时间列表头都可以切换升序/降序。一次只激活一个排序字段，受 URL 控制，不出现两个同时高亮的排序列。
- 改变排序字段或方向回到第 1 页，保留 pageSize、已生效 keyword/channelId；不提交尚未查询的表单草稿。
- 时间相同时按 id 同方向排序；默认列表保持 createdAt desc、id desc。
- 新增“重置”按钮：清空尚未提交的关键词与频道输入，跳转无查询参数的默认列表，恢复 page=1、pageSize=10、空关键词、无频道、createdAt desc；即使 URL 已是默认地址，也必须清空表单草稿。重置不主动使缓存失效，按统一缓存策略取数。
- 不在详情页或表单中增加可编辑时间字段；不增加组合排序、真实后端或数据迁移。

## 约束与文档

- 保持缓存新鲜/回收时间、增删改缓存处理及已修复的迟到写请求会话保护不变。
- 保留列表 setSearch 的 flushSync 行为，防止快速后退时筛选表单落后于 URL。
- 同步 README 和桌面 React.md 的排序说明；保留旧设计与旧实施计划作为历史快照，不修改它们的既有字段约定或哈希说明。
- 当前没有 Git 初始化/提交授权；不初始化、提交或推送。

## 验收

- 不同创建/更新时间的固定数据能验证两字段 × 两方向的四种结果，以及同时间的 id 次级排序。
- POST 时间相等、PATCH 仅更新时间、失败写入不更新时间；列表与详情均返回 updatedAt。
- URL 规范化、请求序列化、Query Key 能区分两个字段，非法字段仍回退默认。
- 表头操作同步 URL/排序标记、回第 1 页且保留其他条件；直接链接和前进后退恢复排序。
- 原有全量测试、类型检查、Lint、构建和浏览器流程保持通过。
