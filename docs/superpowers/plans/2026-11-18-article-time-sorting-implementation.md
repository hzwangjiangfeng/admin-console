# Article Time Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有文章后台新增 updatedAt，并为创建时间和更新时间提供完整的升降序接口与表格排序。

**Architecture:** 扩展现有时间字段及 sortBy 白名单，沿用 URL → 规范化参数 → Query Key/API → MSW 先排序后分页的链路。两列表头由同一份 URL 参数控制，不添加第二套局部排序状态。

**Tech Stack:** 现有 React、TypeScript、Ant Design、React Router、Axios、TanStack Query、MSW、Vitest、Testing Library 和 Playwright；不安装新依赖。

**Spec:** [时间排序增量设计](../specs/2026-11-18-article-time-sorting-design.md)，补充而不重写 [原始设计](../specs/2026-11-17-article-admin-design.md)。

## Global Constraints

- 字段名严格为 `updatedAt`；`createdAt`、`updatedAt` 均为服务端生成的只读 ISO 8601 UTC 字符串。
- POST 同时初始化两个时间，成功 PATCH 仅刷新 updatedAt；客户端不能写入两个时间字段。
- sortBy 允许 `createdAt|updatedAt`，sortOrder 允许 `asc|desc`；默认仍为 createdAt desc，同时间以 id 同方向排序。
- 切换排序字段或方向将 page 重置为 1，保留 pageSize 与 URL 中已生效的筛选，不提交草稿。
- Query Key 形状及 60,000 ms staleTime、300,000 ms gcTime 不变；保留 flushSync 导航和写请求会话保护。
- 保留旧方案/计划快照；只更新本次设计、README、桌面 React.md 与相关代码/测试。没有 Git 授权，不初始化、提交或推送。
- 沿用 Native。每个任务先观察目标失败测试，再最小实现与全量复验；任务完成后做一次独立增量审查。

## Review Focus

1. 两字段时间顺序不一致时，四种排序不能都偷偷使用 createdAt；Task 1 的固定顺序断言覆盖。
2. 时间相同记录须以 id 同方向排序，且先排序后分页；Task 1 的相同更新时间夹具覆盖。
3. 无效 PATCH 或客户端时间字段不能改变更新时间/创建时间；Task 1 的只读字段与失败写入覆盖。
4. 从非第一页切换时间字段时，URL、页码、筛选及激活排序列必须同步；Task 2 覆盖。
5. 直接 URL、快速后退及不同 sortBy 的缓存必须保持一致；Task 1 的规范化/Key 和 Task 2 的浏览器回退覆盖。

---

## 文件边界

- 类型与参数：`src/types/articles.ts`、`src/utils/articles/listParams.ts`；扩展时间和排序字段，既有 serializer/Key 不增加第二套实现。
- Mock 与夹具：`src/mocks/data/articles.ts`、`src/mocks/articles.handlers.ts`、`src/test/fixtures.ts`；生成时间、列表返回字段、按指定字段排序。
- 列表：`src/pages/articles/ArticleListPage.tsx`；增加更新时间列、单列受控排序及排序回第一页。
- 测试：`src/utils/articles/listParams.test.ts`、`src/hooks/articles/articleKeys.test.ts`、`src/utils/articles/validation.test.ts`、`src/api/articles.api.test.ts`、`src/mocks/articles.handlers.test.ts`、`src/pages/articles/ArticleListPage.test.tsx`、新建 `e2e/article-sorting.spec.ts`。
- 文档：`README.md`、`/Users/wangjiangfeng/Desktop/React.md`；不覆盖用户对原文档的其他修改。

## Task 1: 更新时间契约、规范化与接口排序

**Files:** 修改上面类型/参数/Mock/夹具组，以及对应纯逻辑、Key、校验、API、handler 测试。

**Interfaces:**
- Consumes: 现有 Article、CreateArticleInput、UpdateArticleInput、normalizeArticleParams、articleKeys、getArticles、createArticle、updateArticle、resetArticleStore。
- Produces: `Article.updatedAt: string`；`ArticleSortField = 'createdAt' | 'updatedAt'`；`ArticleListParams.sortBy: ArticleSortField`。ArticleListItem 继续由 Omit<Article, 'content'> 派生，自动包含 updatedAt。
- 不改变既有 API 函数签名、成功状态码、响应包装或校验函数签名；现有只读字段校验扩展测试即可。

- [x] **Step 1: 写失败测试。** 参数测试确认 sortBy=updatedAt 对 asc/desc 都能保留、序列化后能还原，updateAt/其他未知值回退 createdAt；Key 测试确认两个 sortBy 使用不同列表 Key。固定三篇记录：id 1 创建 1 月 1 日/更新 1 月 3 日；id 2 创建 1 月 2 日/更新 1 月 2 日；id 3 创建 1 月 3 日/更新 1 月 3 日。断言矩阵：

```ts
const cases = [
  ['createdAt', 'asc', [1, 2, 3]],
  ['createdAt', 'desc', [3, 2, 1]],
  ['updatedAt', 'asc', [2, 1, 3]],
  ['updatedAt', 'desc', [3, 1, 2]],
] as const;
```

用真实 getArticles + MSW 验证各行，再以 pageSize=1、page=2 验证分页取该顺序的第 2 项。补 POST createdAt===updatedAt、列表与详情携带 updatedAt、成功 PATCH 保持 createdAt 并刷新 updatedAt、422 PATCH 不改变时间、提交 updatedAt 或 createdAt 返回校验错误。测试先允许通过对象结构断言暴露字段缺失，不用类型错误替代运行时失败。
- [x] **Step 2: 运行并确认红灯。** Run: `npm run test:run -- src/utils/articles/listParams.test.ts src/hooks/articles/articleKeys.test.ts src/utils/articles/validation.test.ts src/api/articles.api.test.ts src/mocks/articles.handlers.test.ts`。Expected: updatedAt 参数被错误回退、字段缺失或排序矩阵断言失败。
- [x] **Step 3: 最小实现。** 扩展类型与 normalize 白名单；种子初始两时间相等；测试 makeArticle 默认 updatedAt 与其 createdAt 一致，允许显式覆盖。POST 使用一个 now 同时赋值；PATCH 校验通过后再赋新 updatedAt；比较 `a[p.sortBy]` 与 `b[p.sortBy]`，然后按 id 同向比较；列表摘要返回两个时间字段。
- [x] **Step 4: 全量验证。** Run: `npm run test:run && npm run typecheck`。Expected: 全部通过。补齐现有缓存列表字面量的 updatedAt，不能为绕过类型错误将生产字段改成可选。
- [x] **Step 5: 记录 Task 1 完成与证据。** 本计划使用独立 `.superpowers/sdd/2026-11-18-article-time-sorting-implementation/progress.md`；不重跑旧计划任务、不执行 Git 提交。

## Task 2: 表格双时间排序、导航恢复和文档

**Files:** 修改 ArticleListPage、ArticleListPage.test.tsx、README 与桌面 React.md；新建 `e2e/article-sorting.spec.ts`。

**Interfaces:**
- Consumes: Task 1 的 ArticleSortField、列表 updatedAt 与规范化参数；现有 changeParams 继续用 flushSync。
- Produces: 创建时间和更新时间两个 sorter 列。仅 `params.sortBy` 匹配的列显示对应 sortOrder；inactive 列不显示排序标记。切换任一字段/方向均更新 URL，并设置 page=1。

- [x] **Step 1: 写列表失败测试。** 增补用户在执行中明确要求的“重置”按钮测试：复杂 URL 和未提交草稿都恢复全部默认条件；URL 已默认时也能清空草稿；默认列表新鲜缓存可复用，不主动失效。 从 page=2、pageSize=5、keyword=React、channelId=1 开始点击“更新时间”：断言 page=1、sortBy=updatedAt、sortOrder=asc，其他条件保留，创建时间不再激活；再点一次为 desc，再点创建时间切回 createdAt。直接加载 updatedAt/desc URL 时更新时间标记为 descending，创建时间不激活。
- [x] **Step 2: 运行并确认红灯。** Run: `npm run test:run -- src/pages/articles/ArticleListPage.test.tsx`。Expected: 缺少更新时间列或 URL/页码断言失败。
- [x] **Step 3: 最小实现 UI。** 两列分别以 URL 字段是否匹配控制 sortOrder；采用升/降循环避免未定义的无排序状态。Table onChange 从有效 sorter.field 选择字段，不硬编码 createdAt；重置 page=1，保留已生效条件。新增重置按钮，同时显式清空 Form 草稿与 URL 查询参数，恢复全部默认参数，不主动 invalidate；与 URL 是否已经默认为空无关。适当增加横向滚动宽度容纳新增时间列，不改详情页或表单。
- [x] **Step 4: 编写真实浏览器回归。** 新测试文件覆盖两个字段表头的 asc/desc、URL 直达恢复，以及非第一页切换字段后回第一页且筛选保留；浏览器后退恢复原字段、方向及页码。沿用已安装 Chrome 的 `PLAYWRIGHT_CHANNEL=chrome` 环境替代，不改变全局缓存行为。
- [x] **Step 5: 同步文档。** README 写明两时间字段与默认排序；桌面 React.md 仅扩展排序白名单并补充 updatedAt 的只读生命周期，保留其“排序回第一页”等最新规则和用户其他编辑。保留原始设计快照，不更改旧哈希说明。
- [x] **Step 6: 全量验收。** Run: `npm run test:run && npm run typecheck && npm run lint && npm run build`，以及 `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --project=chromium`。Expected: 所有原有和新测试通过；已知包体积警告不作为本次拆包任务。若本地预览占用 5173，仅停止本会话启动的服务，验收后恢复预览。
- [x] **Step 7: 记录完成并进行一次独立增量审查。** 审查仅针对本次双字段排序、时间维护和回归，不把旧计划的已知 deferred minors 并入实现。Important/Critical 按 TDD 修复并复验，Minor 记录。没有 Git 授权则保留日志和代码，不提交或清理不可恢复记录。

## 自查与交付

两任务覆盖数据、URL/Key、排序/分页、UI、文档与端到端链路；不引入新依赖，不重做共用表单，不混淆 Article.updatedAt 与 TanStack Query 的缓存 dataUpdatedAt。计划中的 Expected 是执行时的验收要求，本轮尚未修改应用代码或运行新增测试。

执行方式沿用用户指定的 Native；本计划审阅确认后开始，不再询问执行方式。
