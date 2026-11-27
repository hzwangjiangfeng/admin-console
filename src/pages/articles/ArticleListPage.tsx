import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { TableProps } from 'antd';
import ArticleStatusTag from '../../components/articles/ArticleStatusTag';
import {
  ARTICLE_STATUS_NEXT,
  STATUS_ACTION_LABELS,
  STATUS_OPTIONS,
} from '../../constants/articleStatuses';
import { CHANNEL_OPTIONS, getChannelName } from '../../constants/channels';
import {
  useDeleteArticleMutation,
  useDeleteArticlesMutation,
  useUpdateArticleMutation,
  useUpdateArticlesStatusMutation,
} from '../../hooks/articles/useArticleMutations';
import { useArticleListQuery } from '../../hooks/articles/useArticleQueries';
import { normalizeArticleParams, serializeArticleParams } from '../../utils/articles/listParams';
import { createArticleListState } from '../../utils/articles/navigation';
import type { ArticleListItem, ArticleListParams, ArticleStatus } from '../../types/articles';
import styles from './ArticlePages.module.css';

const BATCH_ACTIONS = ['publish', 'archive', 'delete'] as const;
type BatchAction = (typeof BATCH_ACTIONS)[number];
const BATCH_ACTION_TEXT = {
  publish: { label: '发布', hint: '仅支持草稿和已下架文章' },
  archive: { label: '下架', hint: '仅支持已发布文章' },
  delete: { label: '删除', hint: '已发布文章请先下架' },
} satisfies Record<BatchAction, { label: string; hint: string }>;
const BATCH_TARGET_STATUS = { publish: 'published', archive: 'archived' } as const;

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
  // 记录待修正页码的列表查询字符串，null 表示没有待处理的分页修正
  const [repairSearch, setRepairSearch] = useState<string | null>(null);
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
    // 等列表刷新完成后，检查一下页码是否需要修正
    setRepairSearch(searchString);
    // 显示成功提示，void 明确表示不等待消息关闭（省略其实也是一样的效果）
    void message.success('删除成功');
  }
  // 在删除文章或修改文章状态后，等待列表数据刷新，再判断当前页码是否仍然有效。如果当前页码超出了最大页码，就自动跳转到最后一个有效页
  useEffect(() => {
    // 判断是否存在分页修正任务
    if (repairSearch === null) return;
    // 判断用户是否已经切换列表，由于删除、发布、下架都是异步操作，在请求完成之前，用户可能已经通过浏览器前进或后退切换了列表
    if (repairSearch !== searchString) {
      setRepairSearch(null);
      return;
    }
    // 等待列表数据可用，这里直接 return，没有清空 repairSearch，因此分页修正任务依然存在
    // 当 query.isFetching、query.isError 或 query.data 发生变化时，Effect 会再次执行
    if (query.isFetching || query.isError || !query.data) return;
    // 计算最后一个有效页码
    const lastPage = Math.max(1, Math.ceil(query.data.total / params.pageSize));
    // 清空分页修正任务，无论最终是否需要跳转，本次检查都已经完成
    setRepairSearch(null);
    // 只有当前页码超过最大有效页码时，才需要修正
    if (params.page > lastPage) {
      setSearch(serializeArticleParams({ ...params, page: lastPage }), { replace: true });
    }
  }, [repairSearch, query.isFetching, query.isError, query.data, params, searchString, setSearch]);

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
          // 状态变更可能让文章离开当前筛选结果，等列表刷新后再检查页码
          if (params.status !== null) setRepairSearch(searchString);
          // 显示成功提示，void 明确表示不等待消息关闭（省略其实也是一样的效果）
          void message.success(`${STATUS_ACTION_LABELS[row.status]}成功`);
        },
        // 请求失败时不更改列表里的状态，只提示失败原因
        onError: (error) => void message.error(error.message),
      },
    );
  }

  /* 批量操作 */
  // 记录用户选中了哪些文章
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  // 记录当前准备执行什么操作，null 表示关闭弹窗
  const [batchAction, setBatchAction] = useState<BatchAction | null>(null);
  // 获取当前操作文案
  const batchActionLabel = batchAction === null ? '' : BATCH_ACTION_TEXT[batchAction].label;
  // 当 URL 查询参数发生变化时，清空批量选择并关闭弹窗，避免翻页或筛选后保留之前的选择
  useEffect(() => {
    setSelectedIds([]);
    setBatchAction(null);
  }, [searchString]);
  // 获取当前页面的文章数据
  const rows = query.data?.items ?? [];
  // 列表可能在后台刷新，批量操作以当前页仍然存在的选中项为准
  const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
  // 用户勾选的文章中，仍然存在于当前页的文章 ID 列表
  // 为什么需要 selectedIds 和 visibleSelectedIds 两个变量？因为使用了 TanStack Query，列表数据可能在用户没有进行任何操作的情况下发生变化
  const visibleSelectedIds = selectedRows.map((row) => row.id);
  // 判断允许执行哪些批量操作
  const batchEligible = {
    delete: selectedRows.every((row) => row.status !== 'published'),
    publish: selectedRows.every(
      (row) => ARTICLE_STATUS_NEXT[row.status] === BATCH_TARGET_STATUS.publish,
    ),
    archive: selectedRows.every(
      (row) => ARTICLE_STATUS_NEXT[row.status] === BATCH_TARGET_STATUS.archive,
    ),
  };

  // 批量删除的异步操作
  const batchDeletion = useDeleteArticlesMutation();
  // 批量状态更新的异步操作
  const batchStatusUpdate = useUpdateArticlesStatusMutation();

  // 是否有批量请求正在执行
  const batchPending = batchDeletion.isPending || batchStatusUpdate.isPending;
  // 所有批量操作共用的禁用条件
  const batchActionDisabled =
    visibleSelectedIds.length === 0 ||
    query.isFetching ||
    query.isError ||
    statusUpdate.isPending ||
    deletion.isPending ||
    batchPending;

  // 处理用户打开确认弹窗后，列表数据又发生变化的情况
  // 场景一：文章离开当前页
  // 场景二：文章状态发生变化
  const batchTargetsChanged =
    batchAction !== null &&
    (visibleSelectedIds.length !== selectedIds.length || !batchEligible[batchAction]);
  // 最终确认按钮状态
  const confirmBatchActionDisabled = batchActionDisabled || batchTargetsChanged;

  // 打开批量操作弹窗
  function openBatchAction(action: BatchAction) {
    // 将当前页的有效勾选项带入弹窗
    setSelectedIds(visibleSelectedIds);
    // 记录要执行的操作，同时打开对应的确认弹窗
    setBatchAction(action);
  }

  async function confirmBatchAction() {
    if (batchAction === null || confirmBatchActionDisabled) return;

    try {
      const result =
        batchAction === 'delete'
          ? await batchDeletion.mutateAsync(selectedIds)
          : await batchStatusUpdate.mutateAsync({
              ids: selectedIds,
              status: BATCH_TARGET_STATUS[batchAction],
            });
      const succeededIds = 'deletedIds' in result ? result.deletedIds : result.updatedIds;
      // 关闭批量确认弹窗
      setBatchAction(null);
      if (succeededIds.length === 0) {
        void message.error(`批量${batchActionLabel}失败，请重试`);
        return;
      }

      // 从当前选中的文章 ID 中移除删除成功的 ID，保留其他选中项
      setSelectedIds((ids) => ids.filter((id) => !succeededIds.includes(id)));
      // 批量删除或存在状态筛选时的批量发布/下架，可能减少当前列表的总条数，因此需要在列表刷新后检查并修正页码
      if (batchAction === 'delete' || params.status !== null) {
        setRepairSearch(searchString);
      }

      if (result.failedIds.length > 0)
        void message.warning(
          `已${batchActionLabel} ${succeededIds.length} 篇，${result.failedIds.length} 篇失败`,
        );
      else void message.success(`已${batchActionLabel} ${succeededIds.length} 篇文章`);
    } catch {
      void message.error(`批量${batchActionLabel}请求异常，请刷新列表后确认结果`);
    }
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
            disabled={statusUpdate.isPending || query.isFetching || batchPending}
            onClick={() => changeArticleStatus(row)}
          >
            {STATUS_ACTION_LABELS[row.status]}
          </Button>
          <span title={row.status === 'published' ? '请先下架再删除' : undefined}>
            <Button
              type="link"
              danger
              disabled={row.status === 'published' || batchPending}
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

      {/* 结果表格 */}
      <Card className={styles.panel}>
        <div className={styles.tableHeading}>
          <h2>全部文章</h2>
          <span className={styles.muted}>
            {query.isFetching && query.data ? '正在后台更新…' : '文章内容与发布记录'}
          </span>
        </div>
        {/* 批量操作栏：当前页至少有一篇文章被勾选时才显示 */}
        {visibleSelectedIds.length > 0 && (
          <div className={styles.selectionBar}>
            <div className={styles.selectionHeader}>
              <span role="status" className={styles.selectionCount}>
                已选择 {visibleSelectedIds.length} 项
              </span>
              <Button
                type="link"
                disabled={batchAction !== null || batchPending}
                onClick={() => setSelectedIds([])}
              >
                取消选择
              </Button>
            </div>
            <Space wrap>
              {BATCH_ACTIONS.map((action) => {
                const label = `批量${BATCH_ACTION_TEXT[action].label}`;
                const hint = batchEligible[action] ? undefined : BATCH_ACTION_TEXT[action].hint;
                return (
                  <Tooltip
                    key={action}
                    title={hint}
                    trigger={hint ? ['hover', 'focus'] : []}
                    destroyOnHidden
                  >
                    {/* 禁用按钮由外层元素接收悬停和键盘焦点。 */}
                    <span
                      className={hint ? styles.batchActionTooltip : undefined}
                      tabIndex={hint ? 0 : undefined}
                      role={hint ? 'group' : undefined}
                      aria-label={hint ? label : undefined}
                      aria-description={hint}
                    >
                      <Button
                        danger={action === 'delete'}
                        disabled={
                          batchActionDisabled || batchAction !== null || !batchEligible[action]
                        }
                        aria-description={hint}
                        onClick={() => openBatchAction(action)}
                      >
                        {label}
                      </Button>
                    </span>
                  </Tooltip>
                );
              })}
            </Space>
          </div>
        )}
        <Table<ArticleListItem>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          rowSelection={{
            selectedRowKeys: visibleSelectedIds, // 配合 Table 中的 rowKey="id"，控制哪些行被选中
            onChange: (_, selected) => setSelectedIds(selected.map((row) => row.id)), // 用户勾选或取消勾选时，保存选中的文章 ID
            getTitleCheckboxProps: () => ({ 'aria-label': '全选当前页' }), // 配置表头全选复选框的无障碍名称
            getCheckboxProps: (row) => ({
              'aria-label': `选择《${row.title}》`,
              // 确认或执行批量操作期间固定选择，避免目标变化
              disabled: batchAction !== null || batchPending,
            }),
          }}
          loading={query.isPending}
          locale={{ emptyText: '暂无文章' }}
          sortDirections={['ascend', 'descend', 'ascend']}
          scroll={{ x: 1160 }}
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
      <Modal
        title={`批量${batchActionLabel}文章`}
        open={batchAction !== null}
        onOk={() => void confirmBatchAction()}
        onCancel={() => {
          if (!batchPending) setBatchAction(null);
        }}
        okText={`确认${batchActionLabel}`}
        cancelText={`取消${batchActionLabel}`}
        confirmLoading={batchPending}
        okButtonProps={{
          danger: batchAction === 'delete',
          disabled: confirmBatchActionDisabled,
          'aria-label': `确认${batchActionLabel}`,
        }}
        cancelButtonProps={{ disabled: batchPending, 'aria-label': `取消${batchActionLabel}` }}
        closable={!batchPending}
        mask={{ closable: !batchPending }}
      >
        <p>
          确定{batchActionLabel}选中的 {selectedIds.length} 篇文章吗？
          {batchAction === 'delete' && '此操作无法撤销。'}
        </p>
        {!batchPending && batchTargetsChanged && (
          <Alert type="warning" title={`待${batchActionLabel}文章已变更，请关闭弹窗后重新选择。`} />
        )}
      </Modal>
    </section>
  );
}
