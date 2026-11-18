# Article Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从空目录构建文章管理后台，在 MSW 模拟接口下实现可测试的列表、详情、新增、编辑、删除，以及设计文档中约定的导航、缓存和错误处理行为。

**Architecture:** URL 是已生效列表条件的唯一来源，Ant Design Form 管理输入草稿，TanStack Query 管理服务端数据。页面编排交互与导航，Query hooks 调用独立 API 层，Axios 发出真实 HTTP 请求，由开发环境的 MSW 拦截。共用 ArticleForm 仅接收初始值与提交接口，不订阅文章查询数据。

**Tech Stack:** React、TypeScript、Vite、React Router、Ant Design、CSS Modules、Axios、TanStack Query v5、MSW v2；测试使用 Vitest、Testing Library、Playwright Chromium；包管理使用 npm。

**Spec:** [已确认方案的项目内快照](../specs/2026-11-17-article-admin-design.md)。来源为桌面的 React.md，编写计划时两份文件 SHA-256 一致：`d09ec319edef18db3acbbe962d464861903d194ebef6ca8b3119a8d898125141`。执行者先读方案，再读本计划；后续需求变化需同步更新项目内方案与计划。

## Global Constraints

- 当前工作目录为 `/Users/wangjiangfeng/react`，只有系统文件及本轮新增的文档；没有应用、依赖或 Git 仓库。不要覆盖或删除已有 `docs/` 和系统文件，不在本次规划阶段安装依赖。
- 本机已检查：Node `v24.6.0`、npm `11.5.1`。执行阶段安装互相兼容的稳定依赖并提交锁文件；后续复现使用 `npm ci`。方案没有指定其他版本下限。
- 只构建前端与 MSW，不实现架构示意中的真实后端、Redis、数据库，不添加登录、权限、富文本编辑器、自动保存或多人冲突处理，不引入 Zustand。
- 默认列表：第 1 页、每页 10 条、无关键词和频道筛选、`sortBy=createdAt`、`sortOrder=desc`；规范化对象中的空关键词为 `''`，无频道为 `null`。
- `staleTime = 60 * 1000`，`gcTime = 5 * 60 * 1000`；保留默认的旧数据挂载、窗口重新可见及网络恢复刷新行为，不设置轮询。测试可以关闭重试，但不得以测试配置改变生产缓存规则。
- Query Key 固定为 `['articles']`、`['articles', 'list']`、`['articles', 'list', params]`、`['articles', 'detail']`、`['articles', 'detail', id]`。文章 ID 使用正安全整数数字。
- 新增和编辑共用 ArticleForm。编辑时新鲜缓存直接初始化；旧缓存或无缓存等待请求成功；本次编辑初始化后，查询更新、变旧和后台请求不重建表单、不覆盖草稿。
- 详情返回、新增取消、编辑取消使用记录的完整列表 URL；没有有效来源时回到 `/admin/articles`，数据按统一缓存规则恢复。浏览器后退保持浏览器历史行为。
- 新增成功回默认列表，主动刷新并提示“新增成功”，提供“查看文章”；编辑成功回原列表或默认列表并刷新；删除成功保留条件，空页且有前页时回退一页。
- 新增使所有列表失效；编辑使所有列表与对应详情失效；删除使所有列表失效并移除对应详情。写入成功后的查询失败不得变成写入失败，不得引导重复写入。
- GET/PATCH 成功 `200`，POST 成功 `201`，DELETE 成功 `204` 无响应体；成功数据不增加外层包装。列表 `{ items, total }` 不含正文；详情与写入成功返回完整 Article。
- 标题去首尾空白后 1–100 字符；正文 1–20,000 字符且非纯空白，保留原换行；频道必须为固定枚举。PATCH 至少一个可编辑字段，不接受只读字段或 `null` 清空必填项。
- 错误结构为 `{ code, message, fieldErrors? }`；`400/BAD_REQUEST`、`404/ARTICLE_NOT_FOUND`、`422/VALIDATION_ERROR`、`500/INTERNAL_ERROR`；网络错误允许无响应体。
- 目前没有 Git 初始化、提交或推送授权。每个任务末尾检查变更并记录验收；未获授权时跳过提交，不执行 `git init`、`git commit` 或推送。若后续获得提交授权，提交信息末尾使用 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`。

## Review Focus

1. 非法数字、未知频道、等价 URL 与非法文章 ID：规范化后不产生重复缓存，非法文章 ID 不发请求。归属 Task 2、Task 5。
2. 伪造、站外或非列表返回地址：页面按钮只返回有效的站内文章列表，否则使用默认列表，不进行站外跳转。归属 Task 4、Task 5。
3. 旧缓存存在但刷新失败：编辑器不得用旧缓存开放输入；重试成功后才初始化。归属 Task 7。
4. 切换文章或离开页面时，旧请求晚到，以及编辑中后台刷新：不能串入其他文章或覆盖当前草稿。归属 Task 7。
5. 写入接口成功、随后列表/详情刷新失败：保留正确成功反馈，只重试查询；删除不重新打开确认框。归属 Task 6、Task 7、Task 8。

---

## 实施决定与文件边界

以下是为执行本计划补齐的具体选择，不增加业务范围：频道示例为 `1=技术、2=产品、3=随笔`；正文先用纯文本 TextArea 并按文本展示；创建和编辑页面保持分离。返回地址使用 React Router `location.state.from`，不增加全局列表状态；成功导航使用 `replace`，取消/返回跳转到显式地址，不使用 `navigate(-1)`。固定枚举和示例文案均集中定义，后续可以替换。

所有生产文件都在执行阶段创建；当前仅有方案和计划文档。

| 边界 | 文件与职责 |
| --- | --- |
| 工具链 | `package.json`、`package-lock.json`、`index.html`、`vite.config.ts`、`tsconfig.json`、`tsconfig.app.json`、`tsconfig.node.json`、`eslint.config.js`、`.gitignore`、`.env.example`、`.env.development`；Vite/TS/测试及 Mock 开关 |
| 启动与布局 | `src/main.tsx`、`src/App.tsx`、`src/app/AppProviders.tsx`、`src/router/index.tsx`、`src/layouts/AdminLayout.tsx`、`src/layouts/AdminLayout.module.css`、`src/styles.css`、`src/vite-env.d.ts` |
| 类型与规则 | `src/types/articles.ts`、`src/constants/channels.ts`、`src/utils/articles/listParams.ts`、`src/utils/articles/validation.ts`、`src/utils/articles/navigation.ts`；类型、参数、输入和返回地址的纯逻辑 |
| 请求与缓存 | `src/lib/http.ts`、`src/lib/apiError.ts`、`src/lib/queryClient.ts`、`src/api/articles.api.ts`、`src/hooks/articles/articleKeys.ts`、`src/hooks/articles/useArticleQueries.ts`、`src/hooks/articles/useArticleMutations.ts` |
| Mock | `src/mocks/data/articles.ts`、`src/mocks/articles.handlers.ts`、`src/mocks/handlers.ts`、`src/mocks/browser.ts`、`public/mockServiceWorker.js`；内存数据、HTTP 契约、开发启动 |
| 页面 | `src/pages/articles/ArticleListPage.tsx`、`ArticleDetailPage.tsx`、`ArticleCreatePage.tsx`、`ArticleEditPage.tsx`、`ArticlePages.module.css`；业务编排与导航 |
| 表单与编辑会话 | `src/components/articles/ArticleForm.tsx`、`src/hooks/articles/useArticleEditor.ts`；输入草稿与一次性初始化快照 |
| 测试基础 | `src/test/setup.ts`、`src/test/server.ts`、`src/test/renderApp.tsx`、`src/test/fixtures.ts`；MSW 生命周期、浏览器 API 兼容、独立 QueryClient、路由与测试数据 |
| 验收 | 下列任务列出的 `*.test.ts(x)`、`e2e/articles.spec.ts`、`playwright.config.ts`、`README.md` |

依赖顺序：Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8。列表阶段拆出规则与请求层，保证可以分别测试和验收；不在前置任务里创建全部空页面。

## Task 1: 建立可启动、可测试的应用骨架

**Files:**
- Create: 工具链、启动与布局组中的全部文件。
- Create: `src/lib/queryClient.ts`、`src/test/setup.ts`、`src/test/renderApp.tsx`。
- Test: `src/app/App.test.tsx`、`src/lib/queryClient.test.ts`。

**Interfaces:**
- Consumes: 项目内方案；无现有应用接口。
- Produces: `createAppQueryClient(config?: QueryClientConfig): QueryClient`，默认新鲜/回收时间严格为 60,000/300,000 ms。
- Produces: `AppProviders({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }): ReactElement`，统一配置 QueryClientProvider、Ant Design ConfigProvider 中文语言包与 Ant Design App 消息上下文。
- Produces: `routes: RouteObject[]` 与 `createAppRouter(): ReturnType<typeof createBrowserRouter>`；`/` 重定向文章列表，后台 Layout 使用 Outlet，未匹配地址显示页面不存在及列表入口。Task 1 仅实现列表占位页，其他页面随对应任务加入。
- Produces: `renderApp(entry: string, options?: { client?: QueryClient; entries?: InitialEntry[]; initialIndex?: number })`，返回 Testing Library 结果及 `user`、`router`、`queryClient`；每次创建隔离的 MemoryRouter 和测试 QueryClient。

- [x] **Step 1: 建立运行测试所需的工具链。** 在当前目录手动建立 Vite React TS 配置与 package.json，保留 docs，不使用覆盖整个目录的脚手架命令。安装运行依赖 `react react-dom react-router-dom antd axios @tanstack/react-query@5`；开发依赖 `vite @vitejs/plugin-react typescript @types/node @types/react @types/react-dom eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh globals vitest jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event msw@2 @playwright/test`。保存 package-lock；脚本固定为 `dev`、`build`（`tsc -b && vite build`）、`typecheck`（`tsc -b`）、`lint`、`test`（`vitest`）、`test:run`（`vitest run`）、`test:e2e`（`playwright test`）。
- [x] **Step 2: 编写骨架与缓存默认值的失败测试。** jsdom URL 设置为 `http://localhost:5173`；补齐 matchMedia、ResizeObserver 等 Ant Design 必需测试兼容，不 mock Form/Table 本身。断言示例：

```tsx
it('renders the admin shell at the list route', async () => {
  renderApp('/admin/articles');
  expect(await screen.findByRole('heading', { name: '文章列表' })).toBeVisible();
  expect(screen.getByRole('navigation', { name: '后台导航' })).toBeVisible();
});
it('preserves the agreed cache defaults', () => {
  const options = createAppQueryClient().getDefaultOptions().queries;
  expect(options?.staleTime).toBe(60_000);
  expect(options?.gcTime).toBe(300_000);
  expect(options?.refetchInterval).toBeUndefined();
});
```

- [x] **Step 3: 运行失败测试。** Run: `npm run test:run -- src/app/App.test.tsx src/lib/queryClient.test.ts`。Expected: 因未实现应用/工厂而失败，不以环境加载失败代替业务断言失败；先修复测试环境，再确认红灯。
- [x] **Step 4: 实现上述接口和基础布局。** 保留 TanStack 默认的挂载/可见性/重连行为；main 在 StrictMode 下创建并挂载应用；测试辅助关闭 retry，生产不随意关闭。加入根路径和未知路由测试，断言前者定位 `/admin/articles`，后者显示“页面不存在”。
- [x] **Step 5: 验证骨架。** Run: 上述定向测试、`npm run typecheck`、`npm run lint`、`npm run build`。Expected: 全部退出码 0；构建产出 dist，仍保留 docs。
- [x] **Step 6: 记录验收及提交状态。** 检查本任务文件清单；未获 Git 授权时记录“未提交”，不要创建提交。

## Task 2: 固定类型、频道、参数规范化、校验与 Query Key

**Files:**
- Create: `src/types/articles.ts`、`src/constants/channels.ts`、`src/utils/articles/listParams.ts`、`src/utils/articles/validation.ts`、`src/hooks/articles/articleKeys.ts`。
- Test: `src/utils/articles/listParams.test.ts`、`src/utils/articles/validation.test.ts`、`src/hooks/articles/articleKeys.test.ts`。

**Interfaces:**
- Consumes: 方案中的 Article、请求和错误结构。
- Produces: `Article`、`ArticleListItem = Omit<Article, 'content'>`、`ArticleListResponse`、`CreateArticleInput`、`UpdateArticleInput = Partial<CreateArticleInput>`、`ArticleFormValues = CreateArticleInput`、`ApiErrorResponse`；`fieldErrors?: Partial<Record<keyof ArticleFormValues, string[]>>`。
- Produces: `ArticleListParams = { page: number; pageSize: number; keyword: string; channelId: number | null; sortBy: 'createdAt'; sortOrder: 'asc' | 'desc' }`，以及 `DEFAULT_ARTICLE_PARAMS`。
- Produces: `CHANNELS`、`CHANNEL_OPTIONS`、`isChannelId(value: number): boolean`、`getChannelName(id: number): string`；未知展示 ID 返回“未知频道”，不导致页面崩溃。
- Produces: `normalizeArticleParams(search: URLSearchParams): ArticleListParams`、`serializeArticleParams(params: ArticleListParams): URLSearchParams`、`parseArticleId(raw: string | undefined): number | null`。
- Produces: `ValidationResult<T> = { ok: true; values: T } | { ok: false; fieldErrors: NonNullable<ApiErrorResponse['fieldErrors']>; formError?: string }`；`validateArticleInput(value: unknown, mode: 'create'): ValidationResult<CreateArticleInput>` 与 `validateArticleInput(value: unknown, mode: 'update'): ValidationResult<UpdateArticleInput>` 两个重载，只有 `ok: true` 分支才能写入。共享 `ARTICLE_FIELD_LIMITS = { title: 100, content: 20000 }`。
- Produces: `articleKeys.all`、`lists()`、`list(params: ArticleListParams)`、`details()`、`detail(id: number)`，返回方案定义的 readonly tuple。

- [x] **Step 1: 编写参数、Key 和输入边界的失败测试。** 包括 page/pageSize 缺省、空值、`abc`、`-1`、`1.5`、超安全整数、尾随字符；未知频道；关键词 trim；未知参数忽略；无筛选序列化省略 keyword/channelId；非法 ID 不返回可用数字。断言示例：

```ts
it('canonicalizes defaults and rejects malformed numbers', () => {
  expect(normalizeArticleParams(new URLSearchParams('page=-1&pageSize=abc')))
    .toEqual(DEFAULT_ARTICLE_PARAMS);
  expect(parseArticleId('12abc')).toBeNull();
  expect(parseArticleId('0')).toBeNull();
  expect(parseArticleId('3')).toBe(3);
});
it('uses one key for equivalent URLs', () => {
  const explicit = 'page=1&pageSize=10&sortBy=createdAt&sortOrder=desc';
  expect(articleKeys.list(normalizeArticleParams(new URLSearchParams(explicit))))
    .toEqual(articleKeys.list(normalizeArticleParams(new URLSearchParams())));
  expect(articleKeys.detail(3)).toEqual(['articles', 'detail', 3]);
});
```

- [x] **Step 2: 运行失败测试。** Run: `npm run test:run -- src/utils/articles/listParams.test.ts src/utils/articles/validation.test.ts src/hooks/articles/articleKeys.test.ts`。Expected: 目标函数缺失或目标断言失败。
- [x] **Step 3: 实现上述纯逻辑。** 数字必须完整解析并检查 `Number.isSafeInteger`，不使用宽松 parseInt；文章 ID/频道 ID 接受十进制整数字符串，非法值不穿透。关键词去首尾空白；sortBy 白名单当前只有 createdAt；serializer 稳定输出并省略空筛选。校验覆盖标题 100/101、正文 20,000/20,001、纯空白、无效频道、空 PATCH、null、只读/未知字段；POST 要求三个字段，PATCH 仅验证已提供字段并至少一个合法可编辑字段。长度统一采用 JS 字符串 length，与当前前端/Mock 一致；正文不能因 trim 而丢失换行。
- [x] **Step 4: 补齐并运行边界断言。** 用参数化测试断言上述长度临界值；`'  标题  '` 规范化为 `'标题'`；正文 `'第一行\n第二行'` 原样保留；无效对象返回 fieldErrors 或 formError，不抛出未处理异常。Run: Step 2 命令及 `npm run typecheck`。Expected: 全部通过。
- [x] **Step 5: 记录验收及提交状态。** 检查签名与全局默认值一致；Git 仍遵守授权约束。

## Task 3: 实现 HTTP、MSW 与可复用 Query/Mutation 链路

**Files:**
- Create: `src/lib/http.ts`、`src/lib/apiError.ts`、`src/api/articles.api.ts`、`src/hooks/articles/useArticleQueries.ts`、`src/hooks/articles/useArticleMutations.ts`。
- Create: Mock 组全部文件及 `src/test/server.ts`、`src/test/fixtures.ts`。
- Modify: `src/main.tsx`、`src/test/setup.ts`、`.env.example`、`.env.development`、`package.json`。
- Test: `src/api/articles.api.test.ts`、`src/mocks/articles.handlers.test.ts`、`src/hooks/articles/useArticleMutations.test.tsx`、`src/hooks/articles/useArticleQueries.test.tsx`。

**Interfaces:**
- Consumes: Task 1 QueryClient、Task 2 全部类型/规则/Key。
- Produces: `http: AxiosInstance`（baseURL `/api`，timeout 10,000 ms）；`ApiError extends Error`，含 `status: number | null`、`code: string`、可选 fieldErrors；`toApiError(error: unknown): ApiError`。
- Produces: `getArticles(params: ArticleListParams, signal?: AbortSignal): Promise<ArticleListResponse>`、`getArticle(id: number, signal?: AbortSignal): Promise<Article>`、`createArticle(input: CreateArticleInput): Promise<Article>`、`updateArticle(id: number, input: UpdateArticleInput): Promise<Article>`、`deleteArticle(id: number): Promise<void>`。
- Produces: `articleDetailOptions(id: number): FetchQueryOptions<Article, ApiError, Article, ReturnType<typeof articleKeys.detail>>`，queryKey/queryFn/staleTime 共享，供 useQuery 和编辑初始化 fetchQuery 共用。
- Produces: `useArticleListQuery(params: ArticleListParams): UseQueryResult<ArticleListResponse, ApiError>`、`useArticleDetailQuery(id: number): UseQueryResult<Article, ApiError>`。
- Produces: `useCreateArticleMutation(): UseMutationResult<Article, ApiError, CreateArticleInput>`、`useUpdateArticleMutation(): UseMutationResult<Article, ApiError, { id: number; input: UpdateArticleInput }>`、`useDeleteArticleMutation(): UseMutationResult<void, ApiError, number>`。
- Produces: `handlers`、`worker`；`resetArticleStore(seed?: Article[]): void` 重置 Mock 内存数据；`makeArticle(overrides?: Partial<Article>): Article` 供测试构造数据。

- [x] **Step 1: 编写契约与缓存行为的失败测试。** Testing Library renderHook 用隔离 QueryClient；HTTP 请求使用真正 Axios + MSW，不 mock API 函数。断言：列表 items 无 content、total 为筛选后数量、分页超范围返回空集合和真实 total；按 createdAt/id 稳定排序；POST 201 返回正整数 id/UTC createdAt；PATCH 200 只改指定字段并保留 createdAt；DELETE 204 无体；400/404/422/500 和无响应体网络错误按契约转换。Mutation 断言示例（`client` 是用例内新建的 QueryClient，`wrapper` 是使用该 client 包裹 AppProviders 的本地 React 组件）：

```tsx
it('invalidates every list but not another article detail after update', async () => {
  const listA = articleKeys.list(DEFAULT_ARTICLE_PARAMS);
  const listB = articleKeys.list({ ...DEFAULT_ARTICLE_PARAMS, page: 2 });
  client.setQueryData(listA, { items: [], total: 0 });
  client.setQueryData(listB, { items: [], total: 0 });
  client.setQueryData(articleKeys.detail(1), makeArticle({ id: 1 }));
  client.setQueryData(articleKeys.detail(2), makeArticle({ id: 2 }));
  const { result } = renderHook(() => useUpdateArticleMutation(), { wrapper });
  await act(() => result.current.mutateAsync({ id: 1, input: { title: '新标题' } }));
  expect(client.getQueryState(listA)?.isInvalidated).toBe(true);
  expect(client.getQueryState(listB)?.isInvalidated).toBe(true);
  expect(client.getQueryState(articleKeys.detail(1))?.isInvalidated).toBe(true);
  expect(client.getQueryState(articleKeys.detail(2))?.isInvalidated).toBe(false);
});
```

- [x] **Step 2: 运行失败测试。** Run: `npm run test:run -- src/api/articles.api.test.ts src/mocks/articles.handlers.test.ts src/hooks/articles/useArticleMutations.test.tsx src/hooks/articles/useArticleQueries.test.tsx`。Expected: 目标模块缺失或契约断言失败。
- [x] **Step 3: 实现 API 和 Mock。** API 路径相对 baseURL 使用 `/admin/articles`；读取 Axios data，读操作传递 signal；错误统一转换但不在 http 拦截器统一弹消息，避免页面重复提示。Mock 初始提供 35 篇跨三个频道的确定性数据，支持内存 CRUD、共享校验、状态码、筛选/排序/分页；刷新浏览器后恢复种子数据，README 说明不持久化。测试每例 reset handlers/store，禁止跨测试共享修改结果。
- [x] **Step 4: 实现 Query hooks 和 Mutation 缓存副作用。** 写入的 mutationFn 只等待写入 HTTP；成功回调触发 Key 工厂约定的失效/移除，不把后续 refetch 的异常传播为 mutation 失败，不用乐观插入列表。页面负责成功反馈与导航，Query hooks 负责查询错误；保留已有数据时也能显示刷新失败和重试。测试新增仅失效所有列表、编辑仅额外失效本篇详情、删除移除本篇而不影响其他详情；失败写入不执行成功副作用。
- [x] **Step 5: 接入开发 Mock 与测试生命周期。** 执行 `npx msw init public --save` 生成 worker；`.env.development` 设置 `VITE_ENABLE_MOCK=true`。main 仅在 `import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK === 'true'` 时动态导入 browser 并等待 worker.start 后挂载，生产不启用 Mock；测试用 setupServer，不注册浏览器 worker。测试未处理的 `/api/` 请求应失败，静态资源不误报。
- [x] **Step 6: 验证请求链路与缓存时间。** Step 2 命令须全部通过；补充测试“60 秒内重新订阅不增加请求、旧缓存重新订阅先返回已有数据再刷新、无人订阅 300 秒后清理”，使用可控时间并恢复真实计时器。运行 `npm run typecheck`、`npm run build`，退出码 0。
- [x] **Step 7: 记录验收及提交状态。** 确认未引入真实后端或额外状态库。

## Task 4: 完成文章列表、筛选同步和安全返回地址

**Files:**
- Create: `src/pages/articles/ArticleListPage.tsx`、`src/pages/articles/ArticlePages.module.css`、`src/utils/articles/navigation.ts`。
- Modify: `src/router/index.tsx`；将 Task 1 列表占位替换为真实页面。
- Test: `src/pages/articles/ArticleListPage.test.tsx`、`src/utils/articles/navigation.test.ts`。

**Interfaces:**
- Consumes: Task 2 参数/枚举/Key，Task 3 `useArticleListQuery`。
- Produces: `ArticleListPage(): ReactElement`；受 URL 控制的 Table/Pagination 和独立 Form 输入草稿。
- Produces: `getArticleListReturnTo(state: unknown): string`，仅接受 state.from 中路径精确为 `/admin/articles` 的站内地址及其查询字符串，否则 `/admin/articles`；拒绝绝对 URL、`//host`、非列表路径，不使用任意字符串重定向。
- Produces: `createArticleListState(location: { pathname: string; search: string }): { from: string }`，记录完整列表地址；供详情、新增、编辑入口共用。

- [x] **Step 1: 编写列表和返回地址失败测试。** 断言初始 URL 同时驱动输入框、频道、分页和排序；只输入不请求；查询回第一页并保留 pageSize/排序；分页或排序不提交草稿；浏览器前进后退同步数据与表单，缺失筛选清空旧字段；重复查询同一有效参数不产生不同 Key。导航入口携带完整 from。返回地址纯函数覆盖有效列表、缺失/错误 state、站外地址、协议相对地址和 `/admin/articles/3/edit`。

```tsx
it('restores both submitted filters and the input when navigating back', async () => {
  const { user, router } = renderApp('/admin/articles?keyword=react');
  const input = await screen.findByRole('textbox', { name: '标题关键词' });
  await user.clear(input);
  await user.type(input, 'vue');
  await user.click(screen.getByRole('button', { name: '查询' }));
  await waitFor(() => expect(router.state.location.search).toContain('keyword=vue'));
  await act(() => router.navigate(-1));
  await waitFor(() => expect(input).toHaveValue('react'));
});
```

- [x] **Step 2: 运行失败测试。** Run: `npm run test:run -- src/pages/articles/ArticleListPage.test.tsx src/utils/articles/navigation.test.ts`。Expected: 缺失列表能力/返回地址函数的断言失败。
- [x] **Step 3: 实现列表交互。** Form 使用可访问 label；URL 变化时 setFieldsValue 仅同步筛选字段并显式清空缺失值，避免循环写 URL；Table rowKey 为 id、排序当前只提供创建时间；受控 page/pageSize/排序均来自规范化参数。切换每页数量回第 1 页；提供 10/20/50 的常用 UI 选项，但解析仍遵循正安全整数规则，不能因 URL 中其他有效 pageSize 擅自改成不同查询。已有数据后台刷新不卸载表格；首次错误、无匹配数据、后台刷新失败分别呈现，查询重试不重提写入。删除按钮在 Task 8 接入。
- [x] **Step 4: 验证列表与参数边界。** Step 2 全通过；补充断言 `keyword=不存在` 显示空状态、后端 500 有重试入口、旧缓存刷新失败保留内容并显示警告；有效 from 包含 page/pageSize/keyword/channelId/sort。Run: 定向测试及 `npm run typecheck`。
- [x] **Step 5: 记录验收及提交状态。** 至此列表应已通过 MSW 独立工作，不依赖其余业务页占位实现。

## Task 5: 实现详情与返回列表

**Files:**
- Create: `src/pages/articles/ArticleDetailPage.tsx`。
- Modify: `src/router/index.tsx`、`src/pages/articles/ArticleListPage.tsx`。
- Test: `src/pages/articles/ArticleDetailPage.test.tsx`。

**Interfaces:**
- Consumes: `parseArticleId`、`useArticleDetailQuery`、`getArticleListReturnTo`、`createArticleListState`、频道名称映射。
- Produces: `ArticleDetailPage(): ReactElement`，可访问标题/正文/频道/创建时间及“返回列表”按钮；按普通详情缓存策略展示。

- [x] **Step 1: 编写详情失败测试。** 包含完整展示、不解析正文 HTML、有效来源返回原完整列表、无来源默认列表、伪造来源兜底、非法 ID 不请求、404 提示、首次失败重试和旧缓存刷新失败提示。详情路由参数验证与有效详情 hooks 放在清晰组件边界内，不违反 Hooks 调用顺序。

```tsx
it('does not query an invalid article ID', async () => {
  const request = vi.fn();
  server.use(http.get('*/api/admin/articles/:id', () => {
    request();
    return HttpResponse.json(makeArticle());
  }));
  renderApp('/admin/articles/not-a-number');
  expect(await screen.findByText('无效的文章地址')).toBeVisible();
  expect(request).not.toHaveBeenCalled();
});
```

- [x] **Step 2: 运行失败测试。** Run: `npm run test:run -- src/pages/articles/ArticleDetailPage.test.tsx`。Expected: 详情页面或对应行为缺失。
- [x] **Step 3: 实现详情页和路由。** 通过页面内按钮显式 navigate 到安全返回地址；不拦截浏览器后退。保留旧缓存展示与背景错误状态；404 不继续展示为有效文章。正文用文本节点与保留换行的 CSS，不使用 dangerouslySetInnerHTML。
- [x] **Step 4: 验证。** 定向测试与 `npm run typecheck` 全部通过；测试实际点击列表“详情”后再返回，列表完整 URL 与筛选值保持。
- [x] **Step 5: 记录验收及提交状态。**

## Task 6: 共用表单与新增成功反馈

**Files:**
- Create: `src/components/articles/ArticleForm.tsx`、`src/pages/articles/ArticleCreatePage.tsx`。
- Modify: `src/router/index.tsx`、`src/pages/articles/ArticleListPage.tsx`。
- Test: `src/components/articles/ArticleForm.test.tsx`、`src/pages/articles/ArticleCreatePage.test.tsx`。

**Interfaces:**
- Consumes: Task 2 共享规则与枚举、Task 3 create mutation、Task 4 安全返回地址。
- Produces: `ArticleFormProps = { initialValues: Partial<ArticleFormValues>; isSubmitting: boolean; fieldErrors?: ApiErrorResponse['fieldErrors']; onSubmit(values: ArticleFormValues): Promise<void>; onCancel(): void }`；`ArticleForm(props: ArticleFormProps): ReactElement`。不根据后续 initialValues prop 变化回填输入，不订阅 useQuery。
- Produces: `ArticleCreatePage(): ReactElement`；新增成功后默认列表上的跨路由成功通知与“查看文章”按钮，按钮使用返回 id，不寻找列表行。

- [x] **Step 1: 编写表单/新增失败测试。** 测试标题/正文/频道必填、长度边界、正文换行保留、422 字段错误、网络错误无响应体保留输入、pending 不重复请求、取消返回原列表/无来源默认；成功恢复默认参数且刷新列表；通知在导航后仍存在，点击“查看文章”去返回 id 的详情。

```tsx
it('keeps creation successful when the destination list fails to refresh', async () => {
  let posts = 0;
  server.use(
    http.post('*/api/admin/articles', () => {
      posts += 1;
      return HttpResponse.json(makeArticle({ id: 99 }), { status: 201 });
    }),
    http.get('*/api/admin/articles', () => HttpResponse.json(
      { code: 'INTERNAL_ERROR', message: '列表暂时不可用' }, { status: 500 }
    ))
  );
  const { user, router } = renderApp('/admin/articles/new');
  await fillValidArticleForm(user);
  await user.click(screen.getByRole('button', { name: '提交' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/admin/articles'));
  expect(await screen.findByText('新增成功')).toBeVisible();
  expect(screen.getByRole('button', { name: '查看文章' })).toBeVisible();
  expect(posts).toBe(1);
  expect(screen.queryByText('新增失败')).not.toBeInTheDocument();
});
```

测试内局部定义 `fillValidArticleForm(user): Promise<void>`，用真实 label 输入标题、选择频道、输入正文；不要凭空导入尚未定义的辅助函数。

- [x] **Step 2: 运行失败测试。** Run: `npm run test:run -- src/components/articles/ArticleForm.test.tsx src/pages/articles/ArticleCreatePage.test.tsx`。Expected: 目标页面/表单和交互断言失败。
- [x] **Step 3: 实现表单与新增页面。** Form 管输入/校验，mutation.isPending 管网络状态；fieldErrors 映射到匹配字段，整体错误另行提示，不 resetFields。新增页直接传空默认值挂载。成功通知通过根 Ant Design App 上下文保留，提供捕获 navigate 的按钮，避免跨路由后通知失效；成功导航 replace 到默认列表并保留其成功结果。查看文章时 from 为当前默认列表地址，不自动跳详情，不把新记录强塞列表。
- [x] **Step 4: 验证成功与失败边界。** 定向测试全通过；为上例点击列表“重试”再断言 posts 仍为 1；用不同分页/筛选的预置缓存验证所有列表变旧。Run: 定向测试及 `npm run typecheck`。
- [x] **Step 5: 记录验收及提交状态。**

## Task 7: 编辑会话、旧缓存等待与草稿保护

**Files:**
- Create: `src/hooks/articles/useArticleEditor.ts`、`src/pages/articles/ArticleEditPage.tsx`。
- Modify: `src/router/index.tsx`、`src/pages/articles/ArticleListPage.tsx`。
- Test: `src/hooks/articles/useArticleEditor.test.tsx`、`src/pages/articles/ArticleEditPage.test.tsx`。

**Interfaces:**
- Consumes: Task 3 `articleDetailOptions`、`useArticleDetailQuery`、`useUpdateArticleMutation`，Task 6 ArticleForm，安全返回地址与 ID 解析。
- Produces: `useArticleEditor(id: number): { initialValues: ArticleFormValues | null; isInitializing: boolean; initializationError: ApiError | null; retryInitialization(): void }`，每个编辑会话只保存一次成功初始化快照。
- Produces: `ArticleEditPage(): ReactElement`；验证路由 ID 后创建以文章 ID 为 key 的编辑会话。切换 ID 重建会话，不能以 dataUpdatedAt 或 isFetching 为 key/卸载条件。

- [x] **Step 1: 编写编辑初始化失败测试。** 控制 MSW 响应与 QueryClient 缓存时间：新鲜缓存不重复请求即可编辑；旧缓存请求未完成时不出现可编辑表单；失败时即使有旧缓存也无编辑器、提供重试；无缓存等待成功；后台刷新后输入保持；切换 ID 时旧请求晚到不填入新表单；离开页面后晚到响应不产生旧会话副作用。关键断言：

```tsx
it('waits for a stale detail refresh and preserves the draft afterwards', async () => {
  client.setQueryData(articleKeys.detail(1), makeArticle({ id: 1, title: '旧标题' }),
    { updatedAt: Date.now() - 61_000 });
  const { user } = renderApp('/admin/articles/1/edit', { client });
  expect(screen.queryByRole('textbox', { name: '标题' })).not.toBeInTheDocument();
  releaseInitialDetail(makeArticle({ id: 1, title: '最新标题' }));
  const title = await screen.findByRole('textbox', { name: '标题' });
  expect(title).toHaveValue('最新标题');
  await user.clear(title);
  await user.type(title, '尚未保存的草稿');
  server.use(http.get('*/api/admin/articles/1', () =>
    HttpResponse.json(makeArticle({ id: 1, title: '其他人修改后的标题' }))));
  await act(() => client.invalidateQueries({ queryKey: articleKeys.detail(1), exact: true }));
  expect(title).toHaveValue('尚未保存的草稿');
});
```

`releaseInitialDetail(article): void` 是该测试内声明的受控 Promise resolver；注册一次初始 handler 后再渲染，不使用真实 sleep 猜测响应时序。

- [x] **Step 2: 运行失败测试。** Run: `npm run test:run -- src/hooks/articles/useArticleEditor.test.tsx src/pages/articles/ArticleEditPage.test.tsx`。Expected: 初始化等待/草稿保护的目标断言失败。
- [x] **Step 3: 实现一次性初始化算法。** 会话订阅详情查询以维持正常缓存行为，同时在会话进入/显式初始化重试时调用 `queryClient.fetchQuery(articleDetailOptions(id))`：新鲜缓存直接 resolve，旧/无缓存等待查询。成功后复制三个可编辑字段到本会话快照，再挂载 Form；失败保留初始化错误，不从 query.data 偷渡旧缓存。effect 清理和会话标识忽略过期结果；同一初始化进行中的查询应复用 Query 的同 Key 请求。快照就绪后不再跟随 query.data/isStale/isFetching 改写或卸载表单。
- [x] **Step 4: 实现保存与取消。** 保存传 `{ id, input }`；只有 PATCH 成功才提示“保存成功”、失效缓存并 replace 回安全列表地址；422/网络错误保留草稿。后续查询失败不进入保存失败分支。取消显式返回来源或默认列表，按普通缓存策略恢复。
- [x] **Step 5: 验证跨场景编辑。** 补充保存成功但列表 GET 500 的测试：显示保存成功/列表刷新错误，重试列表后 PATCH 计数仍 1；补充旧缓存初始化失败后重试成功、编辑到 ID 2 后 ID 1 晚到的断言。Run: 两个定向测试、共用表单测试及 `npm run typecheck`，全部通过。
- [x] **Step 6: 记录验收及提交状态。** 确认没有持续 setFieldsValue/resetFields 或由 isFetching 触发卸载的代码路径。

## Task 8: 删除、分页修正与浏览器整体验收

**Files:**
- Modify: `src/pages/articles/ArticleListPage.tsx`、`src/pages/articles/ArticleListPage.test.tsx`。
- Create: `playwright.config.ts`、`e2e/articles.spec.ts`、`README.md`。
- Modify: `package.json`（仅在需要补齐已有验收脚本时）。

**Interfaces:**
- Consumes: delete mutation、所有现有页面/路由、规范化参数、Query Key 与 Mock。
- Produces: 基于 `deleteId: number | null` 的删除交互、空页回退、可复现的端到端验收和启动说明。

- [x] **Step 1: 编写删除失败测试。** 覆盖取消不请求、确认中禁用重复提交、DELETE 失败保留弹窗、DELETE 成功关闭清空并移除对应详情缓存、刷新失败不重开/不重删；保留 pageSize/筛选/排序；刷新确认当前页为空且 page>1 时回退一页，page=1 不出现 0。不能依据占位数据或失败查询误判空页。

```tsx
it('closes confirmation after deletion even when refresh fails', async () => {
  // 在测试内先让列表 GET 成功，打开目标文章的删除确认框；再将后续 GET 改为 500。
  await user.click(screen.getByRole('button', { name: '确认删除' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByText('删除成功')).toBeVisible();
  expect(deleteRequests).toBe(1);
  await user.click(screen.getByRole('button', { name: '重试' }));
  expect(deleteRequests).toBe(1);
});
```

- [x] **Step 2: 运行失败测试。** Run: `npm run test:run -- src/pages/articles/ArticleListPage.test.tsx`。Expected: 删除/分页回退行为缺失。
- [x] **Step 3: 实现删除与分页修正。** 请求使用确认时捕获的目标 ID；成功先关闭并清空 deleteId，再处理缓存和反馈。写入失败与刷新失败分开；刷新成功的真实空结果才触发页码回退，使用 replace 修正分页历史并保留其他条件，不自动反复刷新失败查询。空页回退后重新查询；若并发变化使更前页也为空，可逐页修正，至少停在第一页，不形成无限导航。
- [x] **Step 4: 编写 Playwright 跨页面验收场景。** 配置仅 Chromium，webServer 使用 `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`，开发 MSW 开启，每个场景新 browser context。场景断言：①筛选/分页→详情→返回保留 URL，浏览器后退同步表单；②新建→默认列表→成功通知→查看正确详情；③编辑保存→原列表出现新值；④删除→记录消失，最后一页空则回退；⑤直达编辑与详情无来源时回默认列表。执行阶段安装 Chromium：`npx playwright install chromium`。功能红灯已由各任务的单元/集成测试取得；此处是完成后增加的浏览器回归验收，不人为破坏实现制造失败证据。
- [x] **Step 5: 编写 README。** 记录 Node/npm 检查值、`npm ci`、开发/构建/测试命令、Mock 开关、浏览器刷新重置 Mock 数据、生产需要真实 `/api` 服务及 SPA 路由回退、不实现后端或持久化；说明方案/计划位置。记录与本地实际验证一致的结果，不宣称已接真实后端。
- [x] **Step 6: 全量验收。** Run: `npm run test:run`、`npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:e2e -- --project=chromium`。Expected: 全部退出码 0，无未处理请求/Promise 错误；不能用跳过失败用例作为完成。浏览器安装或环境受阻时明确记录阻塞和未验证项，不把它描述为通过。
- [x] **Step 7: 记录最终变更与提交状态。** 汇总已完成任务、验收命令/输出及剩余阻塞；Git 操作仍以用户授权为准。实施结束后的代码审查按用户选择的执行方式进行，不在本次写计划阶段启动代理。

## 执行检查与交付边界

- 每个任务先写目标失败测试，再最小实现，再运行定向测试；工具链安装属于 Task 1 的必要前置，不以不存在的测试命令冒充业务红灯。
- 当前应用不存在，本次没有运行应用测试或构建；文中所有 Expected 都是未来执行的验收标准，不是已经取得的结果。
- 已按方案逐项映射：分层与路由 Task 1；类型/枚举/规范化/Key Task 2；缓存/HTTP/Mock/契约 Task 3；列表及安全来源 Task 4；详情 Task 5；新增 Task 6；编辑 Task 7；删除/浏览器流程 Task 8。
- 本计划不把账号权限、富文本、上传、持久化、并发版本控制作为隐含任务；如果用户新增这些需求，应先修改设计而不是顺手实现。
- 任务末尾的提交检查不构成自动提交授权；执行前先让用户审阅本计划并选择 Native 或 Subagent-driven，不提前安装依赖或创建产品代码。
