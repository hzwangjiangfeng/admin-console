import { useLocation, useNavigate, useParams } from 'react-router';
import { Alert, Button, Card, Skeleton, Tag } from 'antd';
import { parseArticleId } from '../../utils/articles/listParams';
import { getArticleListReturnTo } from '../../utils/articles/navigation';
import { useArticleDetailQuery } from '../../hooks/articles/useArticleQueries';
import { getChannelName } from '../../constants/channels';
import styles from './ArticlePages.module.css';

/* 文章详情页组件 */
export default function ArticleDetailPage() {
  const id = parseArticleId(useParams().id);
  return id === null ? <InvalidArticle /> : <ArticleDetailContent id={id} />;
}

/* 文章不存在或无效时的提示页面 */
function InvalidArticle() {
  const navigate = useNavigate();
  const location = useLocation();
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
}

/* 文章详情内容组件 */
function ArticleDetailContent({ id }: { id: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  // 返回列表按钮，location.state 用于获取进入当前页面时携带的路由状态
  const back = (
    <Button aria-label="返回列表" onClick={() => navigate(getArticleListReturnTo(location.state))}>
      返回列表
    </Button>
  );

  // 获取文章详情数据
  const query = useArticleDetailQuery(id);
  if (query.error?.status === 404)
    return (
      <div className={styles.errorPage}>
        <h1>文章不存在</h1>
        {back}
      </div>
    );

  /* 渲染文章详情内容 */
  return (
    <section>
      {/* 页头：文章标题和返回列表按钮 */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.eyebrow}>ARTICLE DETAIL</div>
          <h1>{query.data?.title ?? '文章详情'}</h1>
        </div>
        {back}
      </div>

      {/* 错误提示：查询失败时显示原因和重试按钮 */}
      {query.isError && (
        <Alert
          className={styles.notice}
          type="error"
          title={query.error.message}
          action={
            <Button aria-label="重试" onClick={() => void query.refetch()}>
              重试
            </Button>
          }
        />
      )}

      {/* 内容卡片：等待首次加载时显示骨架屏，有数据时展示文章 */}
      <Card className={styles.panel}>
        {query.isPending ? (
          <Skeleton active />
        ) : (
          query.data && (
            <>
              {/* 文章信息：所属频道和创建时间 */}
              <div className={styles.detailMeta}>
                <Tag color="blue">{getChannelName(query.data.channelId)}</Tag>
                <span>
                  创建于 {new Date(query.data.createdAt).toLocaleString('zh-CN', { hour12: false })}
                </span>
              </div>

              {/* 文章正文 */}
              <article className={styles.body}>{query.data.content}</article>
            </>
          )
        )}
      </Card>
    </section>
  );
}
