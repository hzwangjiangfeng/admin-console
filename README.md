# admin-console

基于 React、TypeScript 和 Vite 的管理后台，当前提供文章管理模块。项目使用 Ant Design、React Router、TanStack Query、Axios 和 MSW。

## 环境与启动

本地搭建时使用 Node 24.6.0、npm 11.5.1；项目要求 Node 24 或更高版本。

```bash
npm ci
npm run dev
```

打开终端中 Vite 提供的地址，访问 `/admin/articles`。页面提供分页、筛选、排序、详情、新增、编辑和删除。频道固定为技术、产品、随笔；正文当前按纯文本输入和展示。

## 数据与 Mock

- `.env.development` 的 `VITE_ENABLE_MOCK=true` 开启开发环境 MSW，启动时先等待 worker 就绪，再挂载应用。
- Mock 提供 35 篇种子文章，拦截真正的 Axios HTTP 请求，并在浏览器内存中处理增删改查。
- **整页刷新会恢复种子数据，不提供数据持久化。** 关闭页面后也不保证保留查询缓存。
- 设置 `VITE_ENABLE_MOCK=false` 可关闭 Mock；须另行提供真实 `/api/admin/articles` 服务。
- 真实接口在列表摘要和详情响应中均须返回 `status`（`draft`、`published` 或 `archived`）。列表 GET 支持按 `status` 筛选，文章 PATCH 接受 `status` 并校验流转；本仓库不实现真实后端。
- 生产构建默认不会启动 MSW；设置 `VITE_DEMO_MODE=true` 可部署无后端的演示版。正式使用需要关闭演示模式并提供真实 `/api` 服务或反向代理。
- 本项目不包含后端、数据库、Redis、账号权限、富文本解析或自动保存。

### Mock 请求异常排查

- 若 Chrome 已有 `mockServiceWorker.js` 控制器，但 API 仍返回 HTML，请检查 **Application → Service Workers → Bypass for network** 是否开启，并确认开发 Mock 已启动。控制器存在不等于当前请求被拦截。
- Mock 开启时，未被拦截而到达 Vite 的 `/api` 请求返回明确的 `503 / MOCK_NOT_INTERCEPTED` JSON 错误，不再回退到前端 HTML。
- API 层在进入 Query 缓存前校验文章/列表响应；HTML 或错误结构会报 `INVALID_RESPONSE`，不会被当成成功的空列表。此类配置/契约错误不自动重试；界面提供明确的查询重试入口，写请求不会因此重复提交。
- 修正浏览器设置或启动配置后点击“重试”；若此前已经缓存了 HTML，先刷新一次页面，清掉旧的内存缓存。正常的新鲜缓存仍可复用，查询或重置不一定产生新网络请求。

## 主要规则

- 默认第 1 页，每页 10 条，无筛选，按创建时间与 ID 倒序。
- 创建时间 `createdAt`、更新时间 `updatedAt` 均支持升序/降序；时间相同时按 ID 同方向排序。两列表头按 URL 显示单一激活排序。
- 新增时两个服务端时间相等，编辑成功仅刷新 `updatedAt`，客户端不能覆盖时间字段。
- 切换排序字段或方向回到第 1 页，保留每页数量和已生效的筛选条件。
- “重置”清空筛选草稿和 URL 参数，恢复全部默认条件；默认地址下也可清空草稿，不强制失效缓存。
- URL 保存已提交的查询条件；筛选草稿由 Form 管理。
- 新建文章默认是草稿；列表可按草稿、已发布和已下架筛选。点击「查询」后将状态写入 URL，服务端在排序和分页前应用筛选；「全部状态」不写入 URL。
- 列表可发布草稿、下架已发布文章，或重新发布已下架文章。当前仅改变管理台的 Mock 状态；详情和编辑页只读展示状态，普通编辑不会改变状态。
- 草稿和已下架文章可以删除。已发布文章须先下架；Mock 拒绝直接删除已发布文章的请求并返回 `409`。
- 查询新鲜时间 1 分钟，无组件使用后缓存保留 5 分钟。
- 编辑器先准备好数据再初始化，旧缓存须刷新成功；初始化后的草稿不跟随后台数据回填。
- 新增成功返回默认列表，通过“查看文章”直接进入刚新增的详情。
- 编辑、删除与新增均区分写入失败和后续查询刷新失败；查询重试不会重复提交写入。
- 返回按钮使用经过校验的列表来源地址，无来源时返回默认列表；不篡改浏览器后退行为。

## 代码格式化

```bash
npm run format        # 批量格式化
npm run format:check  # 检查格式
```

`npm ci` 会启用 Git 提交钩子。提交前会自动格式化暂存的文件，并暂存格式化后的内容。

在 VS Code 安装工作区推荐的 Prettier 扩展后，支持的文件会在保存时自动格式化。

## 测试与构建

```bash
npm run test:run
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e -- --project=chromium
```

单元及集成测试使用独立 QueryClient、MemoryRouter、真实 Ant Design 组件与 Node MSW。jsdom 测试关闭组件动画以避免依赖 CSS 过渡时钟；浏览器测试使用实际动画和开发应用。Playwright 自行启动 5173 端口的开发服务器，运行前确保该端口未被其他服务占用。

若浏览器下载受限而本机已安装 Google Chrome，可使用 `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --project=chromium`。本次浏览器验收采用了该方式，使用系统 Chrome 157；Playwright 默认仍使用其配套 Chromium。

生产文件生成在 `dist/`；`npm run build` 本身不启动生产服务器，也不表示已经对接真实后端。

## 文档

- [设计方案](docs/superpowers/specs/2026-11-17-article-admin-design.md)
- [实施计划](docs/superpowers/plans/2026-11-17-article-admin-implementation.md)
- [双时间排序与重置增量设计](docs/superpowers/specs/2026-11-18-article-time-sorting-design.md)
- [增量实施计划](docs/superpowers/plans/2026-11-18-article-time-sorting-implementation.md)

本项目使用本地 Git 进行版本管理；远程仓库和推送需单独配置与授权。已版本化的 `.env.development` 只保存公共 Mock 开关，密钥或个人配置应放入已忽略的 `.env.local`，不要写入源码或提交。

## 部署到 Vercel（MSW 演示版）

1. 在 Vercel 导入此 GitHub 仓库，Framework Preset 选择 **Vite**，Root Directory 保持仓库根目录。
2. Node.js 选择 **24.x**，构建命令为 `npm run build`，输出目录为 `dist`。
3. 添加环境变量 `VITE_DEMO_MODE=true`，选中需要的 Production 和 Preview 环境，然后部署。修改环境变量后须重新部署。
4. 打开 `/admin/articles`，验证列表、新增、编辑、删除及详情页刷新。

仓库的 `vercel.json` 已配置 `/admin/*` 路由回退；API 路径不会被重写为 HTML。MSW 在浏览器启动时就绪后再挂载应用，`public/mockServiceWorker.js` 随静态资源发布。

演示模式无需后端或数据库。每个页面的 Mock 数据相互独立，刷新会恢复示例文章。需要允许浏览器 Service Worker，且不要启用其 Bypass for network。

正式对接后端时移除 `VITE_DEMO_MODE` 或设为 `false`，并配置 `/api` 代理。所有 `VITE_` 变量都会进入浏览器代码，不能用于保存密钥。

### GitHub 自动部署

Vercel 项目 `wjf2/article-admin` 已关联 `hzwangjiangfeng/admin-console`，生产分支为 `main`。推送或合并到 `main` 后，Vercel 自动构建并更新生产站点；其他分支用于预览部署。Production 和 Preview 环境已配置 `VITE_DEMO_MODE=true`。

- 线上入口：https://admin-console-wjf.vercel.app/admin/articles
- 部署记录：https://vercel.com/wjf2/article-admin/deployments

如果自动部署停止，请检查 Vercel 项目的 Git 关联，以及 GitHub 中 Vercel App 对本仓库的访问权限。
