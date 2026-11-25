import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Alert, App, Button, Card, Skeleton } from 'antd';
import { parseArticleId } from '../../utils/articles/listParams';
import { getArticleListReturnTo } from '../../utils/articles/navigation';
import { useArticleDetailQuery } from '../../hooks/articles/useArticleQueries';
import type { ArticleFormValues } from '../../types/articles';
import { useUpdateArticleMutation } from '../../hooks/articles/useArticleMutations';
import { useSessionActive } from '../../hooks/useSessionActive';
import ArticleForm from '../../components/articles/ArticleForm';
import ArticleStatusTag from '../../components/articles/ArticleStatusTag';
import styles from './ArticlePages.module.css';
export default function ArticleEditPage() {
  const id = parseArticleId(useParams().id);
  const navigate = useNavigate();
  const location = useLocation();
  if (id === null) {
    return (
      <div className={styles.errorPage}>
        <h1>无效的文章地址</h1>
        <Button
          aria-label="返回列表"
          onClick={() => navigate(getArticleListReturnTo(location.state))} // location.state 用于获取进入当前页面时携带的路由状态
        >
          返回列表
        </Button>
      </div>
    );
  } else {
    // key={id} 切换不同文章时，重新创建编辑会话组件，避免保留上一篇文章的编辑状态
    return <ArticleEditSession key={id} id={id} />;
  }
}

/* 文章编辑会话组件 */
function ArticleEditSession({ id }: { id: number }) {
  // 获取文章详情
  const detail = useArticleDetailQuery(id);
  // 保存表单初始值
  const [initialValues, setInitialValues] = useState<ArticleFormValues | null>(null);
  // 表单仅初始化一次：
  // 1. 首次渲染时，如果已有新鲜缓存且没有正在刷新，条件直接满足，调用 setInitialValues()，React 重新渲染并显示 ArticleForm
  // 2. 如果没有缓存，或已有旧缓存但后台正在刷新，则先显示 Skeleton，等待查询成功且结束后，由 TanStack Query 触发重新渲染，再初始化表单。后续即使后台再次刷新，由于 initialValues 已不为 null，也不会重新初始化，避免覆盖用户正在编辑的内容
  if (initialValues === null && detail.isSuccess && detail.fetchStatus === 'idle') {
    const { title, channelId, content } = detail.data;
    setInitialValues({ title, channelId, content });
  }

  // 获取更新文章的异步操作
  const mutation = useUpdateArticleMutation();

  // 获取编程式导航函数
  const navigate = useNavigate();
  // 获取当前路由状态，location.state 用于获取进入当前页面时携带的路由状态
  const location = useLocation();
  const back = () => navigate(getArticleListReturnTo(location.state));
  // 获取当前会话是否仍然活跃的函数，避免在组件卸载后尝试更新状态
  const isSessionActive = useSessionActive();
  // Ant Design 的 App.useApp() 提供了全局的 message，在 src/app/AppProviders.tsx 中已配置
  const { message } = App.useApp();

  return (
    <section>
      {/* 页面头部：标题、编辑说明和返回列表按钮 */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.eyebrow}>EDIT ARTICLE</div>
          <h1>编辑文章</h1>
          <p className={styles.subtitle}>专注修改，后台刷新不会覆盖正在编辑的内容。</p>
        </div>
        <Button aria-label="返回列表" onClick={back}>
          返回列表
        </Button>
      </div>

      {/* 初始化错误提示：加载初始文章内容失败时，提供重试按钮 */}
      {!initialValues && detail.isError && (
        <Alert
          className={styles.notice}
          type="error"
          title={detail.error.message}
          action={
            <Button aria-label="重试" onClick={() => void detail.refetch()}>
              重试
            </Button>
          }
        />
      )}

      {/* 后台刷新提示：刷新失败时保留已填写的内容，允许重新获取文章 */}
      {initialValues && detail.isError && (
        <Alert
          className={styles.notice}
          type="warning"
          title={detail.error.message}
          description="后台刷新未完成，当前编辑内容已保留。"
          action={
            <Button aria-label="重试刷新" onClick={() => void detail.refetch()}>
              重试
            </Button>
          }
        />
      )}

      {/* 保存错误提示：提交修改失败时显示原因 */}
      {mutation.isError && (
        <Alert className={styles.notice} type="error" title={mutation.error.message} />
      )}

      {/* 表单卡片：承载文章编辑区域 */}
      <Card className={`${styles.panel} ${styles.formCard}`}>
        {initialValues && detail.data && (
          <div className={styles.editStatus}>
            <span>文章状态：</span>
            <ArticleStatusTag status={detail.data.status} />
          </div>
        )}
        {/* 初始化时显示骨架屏，取得初始值后显示可提交或取消的文章表单 */}
        {initialValues ? (
          <ArticleForm
            initialValues={initialValues}
            isSubmitting={mutation.isPending}
            fieldErrors={mutation.error?.fieldErrors}
            onCancel={back}
            onSubmit={async (input) => {
              try {
                await mutation.mutateAsync({ id, input });
              } catch {
                return;
              }
              // 如果组件不处于活动状态（比如，用户已经离开了编辑页面），直接返回
              if (!isSessionActive()) return;
              // 显示保存成功提示，void 明确表示不等待消息关闭（省略其实也是一样的效果）
              void message.success('保存成功');
              // 成功后跳转回文章列表页，使用 replace 避免用户点击浏览器“后退”时回到已提交的表单页
              navigate(getArticleListReturnTo(location.state), { replace: true });
            }}
          />
        ) : (
          !detail.isError && <Skeleton active />
        )}
      </Card>
    </section>
  );
}
