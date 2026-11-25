# Article Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在文章管理列表显示、筛选和更新文章状态，支持草稿发布、已发布文章下架、已下架文章重新发布。

**Architecture:** 沿用现有 `URL → normalizeArticleParams → Query Key / Axios → MSW` 查询链路，Mock 在分页前筛选整组数据。列表复用现有 PATCH 和更新 mutation，刷新文章列表及详情缓存，不做乐观更新。

**Tech Stack:** React、TypeScript、Ant Design、React Router、TanStack Query、Axios、MSW、Vitest 和 Testing Library。

**Spec:** 本次状态规则来自已在对话中确认的设计，具体行为见下文；[现有文章管理设计](../specs/2026-11-17-article-admin-design.md)和[时间排序设计](../specs/2026-11-18-article-time-sorting-design.md)提供不变的约束。

## Global Constraints

- 唯一状态值：`draft`（灰色草稿）、`published`（绿色已发布）、`archived`（橙色已下架）。新建由 Mock 设为 `draft`；常规编辑不改变状态。
- 仅允许 `draft → published`、`published → archived`、`archived → published`。非法流转不写入任何字段，不改变 `updatedAt`。
- 筛选通过现有「查询」按钮提交，回到第 1 页，保留每页条数和排序；「重置」恢复所有默认条件。「全部状态」不出现在 URL 中。
- 先组合关键词、频道和状态筛选，再使用现有排序和分页。返回的 `total` 是分页前的命中数。
- 保留「详情、编辑、删除」；每行只增加一个与当前状态对应的操作。操作失败保留原状态并提示错误；操作成功后保留筛选条件，若当前页因此变空且不是第一页，退回上一页。
- 只改现有前端和内存 Mock；不接后端、不做持久化、不增加公开文章页或依赖。整页刷新仍恢复种子数据，但 URL 中的筛选条件保留。
- 执行时先观察新增测试失败，再实现并复验。格式化本次改动的文件并运行 `npm run format:check`；未另获授权不提交 Git。

## 文件边界

| 范围 | 文件与职责 |
| --- | --- |
| 数据契约 | `src/types/articles.ts` 定义状态和 PATCH、查询参数；`src/constants/articleStatuses.ts` 提供状态白名单、标签和允许的流转；`src/api/articleResponses.ts` 校验返回状态 |
| 查询与 Mock | `src/utils/articles/listParams.ts` 解析与序列化状态；`src/utils/articles/validation.ts` 校验 PATCH；`src/mocks/articles.handlers.ts` 过滤并校验业务流转；`src/mocks/data/articles.ts`、`src/test/fixtures.ts` 补齐数据 |
| 列表 | `src/pages/articles/ArticleListPage.tsx` 展示标签、筛选和流转按钮，复用现有空页修正 |
| 文档 | `README.md` 记录行为及真实后端所需的接口字段；不改历史设计快照 |

## Task 1: 数据契约、状态流转与筛选接口

**Files:** 修改上表「数据契约」「查询与 Mock」文件，新建 `src/constants/articleStatuses.ts`。更新 `src/api/articles.api.test.ts`、`src/mocks/articles.handlers.test.ts`、`src/utils/articles/listParams.test.ts`、`src/hooks/articles/articleKeys.test.ts`、`src/pages/articles/ArticleEditPage.test.tsx`。

**Interfaces:**

- Consumes: 现有 `getArticles(params, signal?)`、`getArticle(id, signal?)`、`createArticle(input)`、`updateArticle(id, input)`，以及 `articleKeys.list(params)`；不改函数签名和缓存键结构。
- Produces: 必填 `Article.status: ArticleStatus`；`ArticleListItem` 继续通过 `Omit<Article, 'content'>` 派生；`UpdateArticleInput.status?: ArticleStatus`；`ArticleListParams.status: ArticleStatus | null`。
- Produces: `isArticleStatus(value: unknown): value is ArticleStatus`、`ARTICLE_STATUS_LABELS`、`ARTICLE_STATUS_NEXT`。`CreateArticleInput`、`ArticleFormValues` 与 `FieldErrors` 不加状态字段。

- [x] **Step 1: 写接口、筛选参数和 Mock 的失败测试。** 在 `articles.api.test.ts` 中追加以下用例，沿用现有 helper 和 imports：

```ts
it('creates drafts and persists each allowed status transition', async () => {
  const created = await createArticle({ title: '状态测试', channelId: 1, content: '正文' });
  expect(created).toMatchObject({ status: 'draft' });

  for (const status of ['published', 'archived', 'published'] as const) {
    const updated = await updateArticle(created.id, { status });
    expect(updated).toMatchObject({ status, createdAt: created.createdAt });
    expect(await getArticle(created.id)).toMatchObject({ status });
  }

  const edited = await updateArticle(created.id, { title: '普通编辑' });
  expect(edited).toMatchObject({ status: 'published' });
});

it('rejects illegal transitions without changing the article', async () => {
  const created = await createArticle({ title: '不能跳过发布', channelId: 1, content: '正文' });
  await expect(updateArticle(created.id, { status: 'archived', title: '不能保存' })).rejects.toMatchObject({
    status: 409,
    code: 'INVALID_STATUS_TRANSITION',
  });
  await expect(getArticle(created.id)).resolves.toEqual(created);
});

it('rejects unknown statuses and client-supplied creation statuses', async () => {
  const input = { title: '标题', channelId: 1, content: '正文' };
  const created = await createArticle(input);
  const send = (method: string, path: string, body: unknown) =>
    fetch(`http://localhost:5173/api/admin/articles${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  expect((await send('PATCH', `/${created.id}`, { status: 'pending' })).status).toBe(422);
  expect((await send('POST', '', { ...input, status: 'published' })).status).toBe(422);
  await expect(getArticle(created.id)).resolves.toEqual(created);
});

it.each([{}, { status: 'pending' }])('rejects missing or unknown response status %#', async (override) => {
  const { id, title, channelId, createdAt, updatedAt } = makeArticle();
  const summary = { id, title, channelId, createdAt, updatedAt };
  server.use(http.get('*/api/admin/articles', () =>
    HttpResponse.json({ items: [{ ...summary, ...override }], total: 1 }),
  ));
  await expect(getArticles(DEFAULT_ARTICLE_PARAMS)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
```

在 `articles.handlers.test.ts` 验证组合筛选和真实 API 分页：

```ts
it('applies all filters before pagination and computes filtered totals', async () => {
  resetArticleStore([
    makeArticle({ id: 1, title: 'React 01', status: 'published' }),
    makeArticle({ id: 2, title: 'React 02', status: 'published' }),
    makeArticle({ id: 3, title: 'React 03', status: 'archived' }),
    makeArticle({ id: 4, title: 'React 04', status: 'published', channelId: 2 }),
    makeArticle({ id: 5, title: 'Vue 05', status: 'published' }),
  ]);
  const params = normalizeArticleParams(
    new URLSearchParams('status=published&keyword=React&channelId=1&pageSize=1&page=2'),
  );
  const list = await getArticles(params);
  expect(list.total).toBe(2);
  expect(list.items).toMatchObject([{ id: 1, status: 'published' }]);
});
```

在 `listParams.test.ts` 增加一组独立断言；在 `articleKeys.test.ts` 增加状态键差异断言：

```ts
it('round trips supported statuses and drops unsupported ones', () => {
  for (const status of ['draft', 'published', 'archived']) {
    const params = normalizeArticleParams(new URLSearchParams({ status }));
    expect(params.status).toBe(status);
    expect(serializeArticleParams(params).get('status')).toBe(status);
  }
  const invalid = normalizeArticleParams(new URLSearchParams('status=all'));
  expect(invalid.status).toBeNull();
  expect(serializeArticleParams(invalid).has('status')).toBe(false);
});

it('caches published results separately from all statuses', () => {
  const key = (search: string) => articleKeys.list(normalizeArticleParams(new URLSearchParams(search)));
  expect(key('status=published')).not.toEqual(key(''));
});
```

- [x] **Step 2: 运行并观察红灯。** `npm run test:run -- src/api/articles.api.test.ts src/mocks/articles.handlers.test.ts src/utils/articles/listParams.test.ts src/hooks/articles/articleKeys.test.ts`。预期：新建缺少状态、合法状态 PATCH 被拒绝、非法状态响应未被拦截，或筛选参数未生效。以 Vitest 的运行时断言确认失败；待实现后再运行 TypeScript 构建检查。

- [x] **Step 3: 实现状态类型、白名单与参数。** 在 `src/types/articles.ts` 中新增 `export type ArticleStatus = 'draft' | 'published' | 'archived'`；向 `Article` 和 `ArticleListParams` 分别加入 `status: ArticleStatus` 与 `status: ArticleStatus | null`；将 `UpdateArticleInput` 扩成 `Partial<CreateArticleInput> & { status?: ArticleStatus }`。新建 `constants/articleStatuses.ts`：

```ts
import type { ArticleStatus } from '../types/articles';

export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已下架',
};
export const ARTICLE_STATUS_NEXT: Record<ArticleStatus, ArticleStatus> = {
  draft: 'published',
  published: 'archived',
  archived: 'published',
};
export function isArticleStatus(value: unknown): value is ArticleStatus {
  return typeof value === 'string' && Object.hasOwn(ARTICLE_STATUS_LABELS, value);
}
```

在 `listParams.ts` 为默认对象加 `status: null`，解析时读取 `const status = search.get('status')` 并返回 `status: isArticleStatus(status) ? status : null`；序列化时仅在 `params.status !== null` 时执行 `search.set('status', params.status)`。在 `articleResponses.ts` 的 `isArticleSummary` 加入 `&& isArticleStatus(value.status)`，列表和详情复用这一校验，不把缺失值静默当作草稿。

- [x] **Step 4: 实现 Mock 写入与分页。** `validation.ts` 的 `allowed` 仅在 `mode === 'update'` 时扩入 `'status'`；初始化 `values` 之后、校验正文等字段之前加入：

```ts
if (mode === 'update' && Object.hasOwn(input, 'status')) {
  if (!isArticleStatus(input.status))
    return { ok: false, fieldErrors, formError: '无效的文章状态' };
  values.status = input.status;
}
```

Mock 列表的 filter 加 `&& (p.status === null || a.status === p.status)`，返回摘要时在解构和输出中加入 `status`。Mock POST 的 `article` 标注为 `Article` 并添加 `status: 'draft'`。Mock PATCH 在输入校验之后、`Object.assign` 之前加入：

```ts
if (result.values.status !== undefined && ARTICLE_STATUS_NEXT[article.status] !== result.values.status)
  return HttpResponse.json(
    { code: 'INVALID_STATUS_TRANSITION', message: '当前状态不支持此操作' },
    { status: 409 },
  );
```

保留 `Object.assign(article, result.values, { updatedAt: new Date().toISOString() })`，只有成功写入才走到该处。种子文章使用 `const statuses = ['draft', 'published', 'archived'] as const`，从 `statuses[Math.floor(index / 3) % statuses.length]` 取值，避免与已有频道取模绑定；`makeArticle` 默认 `status: 'draft'`，`...overrides` 仍置于最后。`listParams.test.ts` 的 `defaults` 补 `status: null`；`ArticleEditPage.test.tsx` 的手写 `listKey` 改为 `articleKeys.list(DEFAULT_ARTICLE_PARAMS)`，并导入 `DEFAULT_ARTICLE_PARAMS`，保留失效断言。

- [x] **Step 5: 复验数据层。** 重新执行 Step 2 的命令，并执行 `npm run test:run -- src/pages/articles/ArticleEditPage.test.tsx` 与 `npm run typecheck`。预期：筛选总数、顺序、状态响应与流转均符合断言，原有编辑缓存失效行为不变。

## Task 2: 列表筛选、状态操作与文档

**Files:** 修改 `src/pages/articles/ArticleListPage.tsx`、`src/pages/articles/ArticleListPage.test.tsx` 和 `README.md`。

**Interfaces:**

- Consumes: `ArticleListItem.status`、`ArticleListParams.status`、`ARTICLE_STATUS_LABELS`、`ARTICLE_STATUS_NEXT`、`useUpdateArticleMutation()`。
- Produces: 受 URL 控制的已提交状态筛选；三个中文状态标签及对应操作；写成功后沿用列表、详情缓存失效和现有空页修正。详情页面与新增/编辑表单不增加状态控件。

- [x] **Step 1: 写列表失败测试。** 在 `ArticleListPage.test.tsx` 复用 `renderApp`、`resetArticleStore`、`makeArticle`、`within`、`server` 和 `act`：

```tsx
it('applies status only on query, preserves it on navigation, and clears it on reset', async () => {
  resetArticleStore([
    makeArticle({ id: 1, title: '草稿文章' }),
    makeArticle({ id: 2, title: '发布文章', status: 'published' }),
    makeArticle({ id: 3, title: '下架文章', status: 'archived' }),
  ]);
  const { router, user } = renderApp('/admin/articles?page=2&pageSize=2');
  await screen.findByText('草稿文章');
  await user.click(screen.getByLabelText('状态'));
  await user.click(await screen.findByText('已发布'));
  const params = () => new URLSearchParams(router.state.location.search);
  expect(params().get('status')).toBeNull();
  expect(params().get('page')).toBe('2');

  await user.click(screen.getByLabelText('查询'));
  const row = (await screen.findByText('发布文章')).closest('tr')!;
  expect(params().get('status')).toBe('published');
  expect(params().get('page')).toBe('1');
  expect(params().get('pageSize')).toBe('2');
  expect(screen.queryByText('草稿文章')).not.toBeInTheDocument();
  await user.click(within(row).getByText('详情'));
  await screen.findByText('发布文章', { selector: 'h1' });
  await act(() => router.navigate(-1));
  const restored = (await screen.findByText('发布文章')).closest('tr')!;
  expect(within(restored).getByText('已发布')).toBeVisible();
  expect(params().get('status')).toBe('published');

  await user.click(screen.getByLabelText('重置'));
  expect(params().has('status')).toBe(false);
  expect(screen.getByText('全部状态')).toBeVisible();
});

it('moves back one page when archiving the last result in a published filter', async () => {
  resetArticleStore([
    makeArticle({ id: 1, title: '将下架的文章', status: 'published' }),
    makeArticle({ id: 2, title: '保留文章', status: 'published' }),
  ]);
  const { user, router } = renderApp('/admin/articles?status=published&page=2&pageSize=1');
  const row = (await screen.findByText('将下架的文章')).closest('tr')!;
  expect(within(row).getByText('已发布')).toBeVisible();
  await user.click(within(row).getByText('下架'));
  expect(await screen.findByText('保留文章')).toBeVisible();
  expect(Object.fromEntries(new URLSearchParams(router.state.location.search))).toMatchObject({
    status: 'published',
    page: '1',
    pageSize: '1',
  });
  expect(screen.queryByText('将下架的文章')).not.toBeInTheDocument();
});

it('shows only the current status action and keeps the original status on failure', async () => {
  resetArticleStore([makeArticle({ title: '待发布文章' })]);
  server.use(
    http.patch('*/api/admin/articles/1', () =>
      HttpResponse.json({ code: 'REQUEST_ERROR', message: '无法发布' }, { status: 500 }),
    ),
  );
  const { user } = renderApp('/admin/articles');
  const row = (await screen.findByText('待发布文章')).closest('tr')!;
  expect(within(row).queryByText(/^(下架|重新发布)$/)).not.toBeInTheDocument();
  const publish = within(row).getByText('发布').closest('button');
  await user.click(within(row).getByText('发布'));
  expect(await screen.findByText('无法发布')).toBeVisible();
  expect(within(row).getByText('草稿')).toBeVisible();
  expect(publish).toBeEnabled();
});

it('shows the new status and action after republishing', async () => {
  resetArticleStore([makeArticle({ title: '恢复文章', status: 'archived' })]);
  const { user } = renderApp('/admin/articles');
  const row = (await screen.findByText('恢复文章')).closest('tr')!;
  expect(within(row).getByText('已下架')).toBeVisible();
  await user.click(within(row).getByText('重新发布'));
  expect(await within(row).findByText('已发布')).toBeVisible();
  expect(within(row).getByText('下架')).toBeVisible();
  expect(within(row).queryByText('重新发布')).not.toBeInTheDocument();
});
```

- [x] **Step 2: 运行并观察红灯。** `npm run test:run -- src/pages/articles/ArticleListPage.test.tsx`。预期：缺少状态下拉、行标签或操作按钮，相关断言失败。

- [x] **Step 3: 实现筛选和状态列。** `Form.useForm` 的类型增加 `status?: ArticleStatus`。URL 同步时在 `setFieldsValue` 加 `status: params.status ?? undefined`、依赖数组加 `params.status`；`onFinish` 的参数增加 `status: values.status ?? null`，保留 `page: 1`；`resetParams` 的 `setFieldsValue` 加 `status: undefined`。在频道之后插入：

```tsx
<Form.Item label="状态" name="status">
  <Select
    allowClear
    virtual={false}
    options={Object.entries(ARTICLE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
    placeholder="全部状态"
    style={{ minWidth: 130 }}
  />
</Form.Item>
```

在频道之后增加表格列；将操作列宽度改为 `280`、横向滚动宽度改为 `1120`，保留原有排序、分页和链接。两个手写缓存行测试样本增加 `status: 'draft'`。

```tsx
const STATUS_TAG_COLORS = { draft: 'default', published: 'green', archived: 'orange' } as const;
const STATUS_ACTION_LABELS = { draft: '发布', published: '下架', archived: '重新发布' } as const;

const statusColumn = {
  title: '状态',
  dataIndex: 'status',
  width: 110,
  render: (status: ArticleStatus) => (
    <Tag color={STATUS_TAG_COLORS[status]}>{ARTICLE_STATUS_LABELS[status]}</Tag>
  ),
};
```

- [x] **Step 4: 实现状态操作。** 用 `const statusUpdate = useUpdateArticleMutation()`，把以下按钮加到现有行操作的 `Space` 内。写请求期间标示当前行加载、禁用所有状态按钮；刷新数据时暂时禁用状态按钮，避免按旧状态重复提交。成功后由已有 `repairEmptyPage` effect 在刷新完成后处理空页；失败不触发分页修正。不另建状态专用的 API 或 mutation hook，不重复调用 `refetch`。

```tsx
<Button
  type="link"
  loading={statusUpdate.isPending && statusUpdate.variables?.id === row.id}
  disabled={statusUpdate.isPending || query.isFetching}
  onClick={() => {
    const action = STATUS_ACTION_LABELS[row.status];
    statusUpdate.mutate(
      { id: row.id, input: { status: ARTICLE_STATUS_NEXT[row.status] } },
      {
        onSuccess: () => {
          if (params.status !== null) setRepairEmptyPage(true);
          void message.success(`${action}成功`);
        },
        onError: (error) => void message.error(error.message),
      },
    );
  }}
>
  {STATUS_ACTION_LABELS[row.status]}
</Button>
```

- [x] **Step 5: 更新文档。** 在 `README.md`「主要规则」增加：

  > 新建文章默认是草稿；列表可按草稿、已发布和已下架筛选。状态筛选点击「查询」后写入 URL，Mock 在排序和分页前应用筛选。发布、下架、重新发布只改变管理台中的 Mock 状态，普通编辑不会改变状态。

  在「数据与 Mock」补充：真实文章列表与详情响应需返回合法 `status`，GET 列表支持 `status` 筛选，PATCH 接受 `status` 并校验流转；本仓库不实现真实后端。

- [x] **Step 6: 格式化与验收。** 格式化本计划所涉及的实现和测试文件，再运行以下检查：

```bash
npm exec -- prettier --write -- README.md src/types/articles.ts \
  src/constants/articleStatuses.ts src/api/articleResponses.ts src/api/articles.api.test.ts \
  src/utils/articles/listParams.ts src/utils/articles/listParams.test.ts \
  src/utils/articles/validation.ts src/mocks/articles.handlers.ts src/mocks/articles.handlers.test.ts \
  src/mocks/data/articles.ts src/test/fixtures.ts src/hooks/articles/articleKeys.test.ts \
  src/pages/articles/ArticleEditPage.test.tsx src/pages/articles/ArticleListPage.tsx \
  src/pages/articles/ArticleListPage.test.tsx
npm run format:check
npm run test:run -- src/pages/articles/ArticleListPage.test.tsx
npm run test:run
npm run lint
npm run build
```

预期：新增断言与原有筛选、排序、编辑和删除回归均通过。若做浏览器验收，用本地 Mock 新建一篇文章，确认「草稿 → 已发布 → 已下架 → 已发布」；复查刷新恢复种子后，地址栏中的状态筛选仍生效。

## 自查

- Task 1 覆盖默认草稿、接口返回与校验、普通编辑保留状态、流转约束、合并筛选、分页前总数以及缓存键隔离。
- Task 2 覆盖 URL 提交与重置、返回列表、单行操作、失败提示、重新发布和空页回退。
- 已观察数据层与列表测试按预期失败；完成后 122 个 Vitest 测试通过，Prettier 检查、ESLint 与生产构建通过。未执行可选的浏览器验收，未提交 Git。
