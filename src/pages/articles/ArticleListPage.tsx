import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { Alert, App, Button, Card, Form, Input, Modal, Select, Space, Table, Tag } from 'antd';
import type { TableProps } from 'antd';
import ArticleStatusTag from '../../components/articles/ArticleStatusTag';
import { ARTICLE_STATUS_LABELS, ARTICLE_STATUS_NEXT } from '../../constants/articleStatuses';
import { CHANNEL_OPTIONS, getChannelName } from '../../constants/channels';
import {
  useDeleteArticleMutation,
  useUpdateArticleMutation,
} from '../../hooks/articles/useArticleMutations';
import { useArticleListQuery } from '../../hooks/articles/useArticleQueries';
import { normalizeArticleParams, serializeArticleParams } from '../../utils/articles/listParams';
import { createArticleListState } from '../../utils/articles/navigation';
import type { ArticleListItem, ArticleListParams, ArticleStatus } from '../../types/articles';
import styles from './ArticlePages.module.css';

const STATUS_OPTIONS = Object.entries(ARTICLE_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const STATUS_ACTION_LABELS = { draft: '发布', published: '下架', archived: '重新发布' } as const;

export default function ArticleListPage() {
  /* 列表查询：按 URL 中的筛选、排序和分页条件加载文章 */
  // 获取 URL 查询参数
  const [search, setSearch] = useSearchParams();
  // 标准化查询参数
  const params = useMemo(() => normalizeArticleParams(search), [search]);
  // 获取文章列表数据
  const query = useArticleListQuery(params);

  /* 页面导航：记录当前列表地址，供用户返回时恢复原来的列表 */
  // 因为 useSearchParams 拿不到当前路径，所以要用 useLocation 来获取完整的 URL 信息
  const location = useLocation();
  // 把列表地址包装成 { from: 列表地址 }，供 Link 跳转时传给目标页，方便用户返回原来的列表
  const from = createArticleListState(location);

  /* URL -> 筛选表单 */
  // 创建筛选表单实例
  const [form] = Form.useForm<{ keyword: string; channelId?: number; status?: ArticleStatus }>();
  // 依赖完整的查询串，URL 的其他查询参数（翻页或排序）发生变化时，也强制重新同步表单，用列表当前的筛选条件覆盖尚未提交的输入。比如：
  // 1. 当前列表按 React 筛选，输入框里显示 React
  // 2. 你把输入框改成 Vue，但还没点“查询”
  // 3. 你点击第 2 页。URL 从 ?keyword=React&page=1 变成 ?keyword=React&page=2，只变了页码
  // 4. 这时表单会被强制同步，输入框又变回 React，覆盖了你未提交的 Vue
  const searchString = search.toString();
  // 当 URL 查询参数发生变化时，将最新的查询条件同步到 Ant Design 表单中，保证表单显示的内容与 URL 保持一致
  useEffect(() => {
    form.setFieldsValue({
      keyword: params.keyword,
      channelId: params.channelId ?? undefined,
      status: params.status ?? undefined,
    });
  }, [form, params.keyword, params.channelId, params.status, searchString]);

  /* 筛选表单 -> URL */
  // 查询：更新文章列表的部分查询参数，并同步到 URL，驱动当前组件按新条件重新渲染
  function changeParams(patch: Partial<ArticleListParams>) {
    setSearch(serializeArticleParams({ ...params, ...patch }), { flushSync: true });
  }
  // 重置：清空尚未提交的筛选输入，URL 查询参数全部恢复默认值，驱动当前组件按新条件重新渲染
  function resetParams() {
    form.setFieldsValue({ keyword: '', channelId: undefined, status: undefined });
    setSearch(new URLSearchParams(), { flushSync: true });
  }

  /* 删除文章 */
  // 控制弹窗展示，null 表示不显示弹窗，非 null 表示打开弹窗并记录删除目标
  const [deleteId, setDeleteId] = useState<number | null>(null);
  // 删除文章的异步操作
  const deletion = useDeleteArticleMutation();
  // 检查当前页是否为空，如果为空且不是第一页，则自动跳转到前一页。false 表示不需要检查，true 表示需要检查
  const [repairEmptyPage, setRepairEmptyPage] = useState(false);
  // Ant Design 的 App.useApp() 提供了全局的 message，在 src/app/AppProviders.tsx 中已配置
  const { message } = App.useApp();

  // 删除确认操作
  async function confirmDelete() {
    if (deleteId === null || deletion.isPending) return;
    try {
      await deletion.mutateAsync(deleteId);
    } catch {
      return;
    }
    // 关闭删除确认弹窗
    setDeleteId(null);
    // 标记需要检查
    setRepairEmptyPage(true);
    // 显示成功提示，void 明确表示不等待消息关闭（省略其实也是一样的效果）
    void message.success('删除成功');
  }
  // 当 repairEmptyPage 为 true 时，检查当前页是否为空，如果为空且不是第一页，则自动跳转到前一页
  useEffect(() => {
    if (!repairEmptyPage || query.isFetching || query.isError || !query.data) return;
    // 当前页为空且不是第一页时，自动返回上一页；否则结束分页修正
    if (query.data.items.length === 0 && params.page > 1)
      setSearch(serializeArticleParams({ ...params, page: params.page - 1 }), { replace: true });
    else setRepairEmptyPage(false);
  }, [repairEmptyPage, query.isFetching, query.isError, query.data, params, setSearch]);

  /* 更新状态 */
  // 更新状态的异步操作
  const statusUpdate = useUpdateArticleMutation();
  // 更新状态操作
  function changeArticleStatus(row: ArticleListItem) {
    // 根据状态流转表提交目标状态，不修改标题、正文等其他字段
    statusUpdate.mutate(
      { id: row.id, input: { status: ARTICLE_STATUS_NEXT[row.status] } },
      {
        onSuccess: () => {
          // 状态变更可能让文章不再符合当前筛选；等列表刷新后再检查是否需要退回上一页
          if (params.status !== null) setRepairEmptyPage(true);
          // 显示成功提示，void 明确表示不等待消息关闭（省略其实也是一样的效果）
          void message.success(`${STATUS_ACTION_LABELS[row.status]}成功`);
        },
        // 请求失败时不更改列表里的状态，只提示失败原因
        onError: (error) => void message.error(error.message),
      },
    );
  }

  /* 定义表格列 */
  const columns: TableProps<ArticleListItem>['columns'] = [
    {
      title: '文章标题',
      dataIndex: 'title',
      render: (title: string, row) => (
        <Link to={`/admin/articles/${row.id}`} state={from} className={styles.titleLink}>
          {title}
        </Link>
      ),
    },
    {
      title: '所属频道',
      dataIndex: 'channelId',
      width: 130,
      render: (id: number) => <Tag color="blue">{getChannelName(id)}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status: ArticleStatus) => <ArticleStatusTag status={status} />,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 210,
      sorter: true,
      sortOrder:
        params.sortBy === 'createdAt' ? (params.sortOrder === 'desc' ? 'descend' : 'ascend') : null,
      render: (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false }),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 210,
      sorter: true,
      sortOrder:
        params.sortBy === 'updatedAt' ? (params.sortOrder === 'desc' ? 'descend' : 'ascend') : null,
      render: (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false }),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, row) => (
        <Space>
          <Link to={`/admin/articles/${row.id}`} state={from}>
            详情
          </Link>
          <Link to={`/admin/articles/${row.id}/edit`} state={from}>
            编辑
          </Link>
          <Button
            type="link"
            className={styles.statusAction}
            loading={statusUpdate.isPending && statusUpdate.variables?.id === row.id}
            disabled={statusUpdate.isPending || query.isFetching}
            onClick={() => changeArticleStatus(row)}
          >
            {STATUS_ACTION_LABELS[row.status]}
          </Button>
          <span title={row.status === 'published' ? '请先下架再删除' : undefined}>
            <Button
              type="link"
              danger
              disabled={row.status === 'published'}
              aria-description={row.status === 'published' ? '请先下架再删除' : undefined}
              aria-label={`删除《${row.title}》`}
              onClick={() => {
                deletion.reset(); // 关掉上一次的错误提示
                setDeleteId(row.id);
              }}
            >
              删除
            </Button>
          </span>
        </Space>
      ),
    },
  ];

  /* 渲染组件数据 */
  return (
    <section>
      {/* 页面头部：标题、简介和新增文章入口 */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.eyebrow}>CONTENT MANAGEMENT</div>
          <h1>文章列表</h1>
          <p className={styles.subtitle}>整理想法，发布内容，让每一篇文章都易于找到。</p>
        </div>
        <Link to="/admin/articles/new" state={from}>
          <Button type="primary" size="large">
            新增文章
          </Button>
        </Link>
      </div>

      {/* 筛选表单：按关键词和频道查询，或重置条件 */}
      <Card className={styles.panel}>
        <Form
          form={form}
          layout="inline"
          onFinish={(values) =>
            changeParams({
              keyword: (values.keyword ?? '').trim(),
              channelId: values.channelId ?? null,
              status: values.status ?? null,
              page: 1,
            })
          }
          className={styles.filters}
        >
          <Form.Item label="标题关键词" name="keyword">
            <Input placeholder="搜索文章标题" allowClear />
          </Form.Item>
          <Form.Item label="所属频道" name="channelId">
            <Select
              options={CHANNEL_OPTIONS}
              placeholder="全部频道"
              allowClear
              style={{ minWidth: 150 }}
            />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Select
              allowClear
              virtual={false}
              options={STATUS_OPTIONS}
              placeholder="全部状态"
              style={{ minWidth: 130 }}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" aria-label="查询">
                查询
              </Button>
              <Button htmlType="button" aria-label="重置" onClick={resetParams}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 查询错误提示：显示失败原因和重试按钮 */}
      {query.isError && (
        <Alert
          className={styles.notice}
          type="error"
          showIcon
          title={query.error.message}
          action={
            <Button aria-label="重试" onClick={() => void query.refetch()}>
              重试
            </Button>
          }
        />
      )}

      {/* 结果表格：展示文章、加载状态、排序和分页 */}
      <Card className={styles.panel}>
        <div className={styles.tableHeading}>
          <h2>全部文章</h2>
          <span className={styles.muted}>
            {query.isFetching && query.data ? '正在后台更新…' : '文章内容与发布记录'}
          </span>
        </div>
        <Table<ArticleListItem>
          rowKey="id"
          columns={columns}
          dataSource={query.data?.items ?? []}
          loading={query.isPending}
          locale={{ emptyText: '暂无文章' }}
          sortDirections={['ascend', 'descend', 'ascend']}
          scroll={{ x: 1120 }}
          pagination={{
            current: params.page,
            pageSize: params.pageSize,
            total: query.data?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [...new Set([10, 20, 50, params.pageSize])].sort((a, b) => a - b),
            showTotal: (total) => `共 ${total} 篇`,
          }}
          onChange={(pagination, _filters, sorter, extra) => {
            if (extra.action === 'paginate')
              changeParams({
                page: pagination.pageSize !== params.pageSize ? 1 : (pagination.current ?? 1),
                pageSize: pagination.pageSize ?? 10,
              });
            if (extra.action === 'sort') {
              const value = Array.isArray(sorter) ? sorter[0] : sorter;
              if (value.field === 'createdAt' || value.field === 'updatedAt')
                changeParams({
                  page: 1,
                  sortBy: value.field,
                  sortOrder: value.order === 'ascend' ? 'asc' : 'desc',
                });
            }
          }}
        />
      </Card>

      {/* 删除确认弹窗：确认、取消和失败提示 */}
      <Modal
        title="删除文章"
        open={deleteId !== null}
        onOk={() => void confirmDelete()}
        onCancel={() => {
          if (!deletion.isPending) setDeleteId(null);
        }}
        okText="确认删除"
        cancelText="取消删除"
        confirmLoading={deletion.isPending}
        okButtonProps={{ danger: true, disabled: deletion.isPending, 'aria-label': '确认删除' }}
        cancelButtonProps={{ disabled: deletion.isPending, 'aria-label': '取消删除' }}
        closable={!deletion.isPending}
        mask={{ closable: !deletion.isPending }}
      >
        <p>确定删除这篇文章吗？此操作无法撤销。</p>
        {deletion.isError && <Alert type="error" title={deletion.error.message} />}
      </Modal>
    </section>
  );
}
