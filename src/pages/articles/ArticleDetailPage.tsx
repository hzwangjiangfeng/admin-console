import { useLocation, useNavigate, useParams } from 'react-router';
import { Alert, Button, Card, Skeleton, Tag } from 'antd';
import { parseArticleId } from '../../utils/articles/listParams';
import { getArticleListReturnTo } from '../../utils/articles/navigation';
import { useArticleDetailQuery } from '../../hooks/articles/useArticleQueries';
import { getChannelName } from '../../constants/channels';
import styles from './ArticlePages.module.css';
export default function ArticleDetailPage() {
  const id = parseArticleId(useParams().id);
  return id === null ? <InvalidArticle /> : <ArticleDetailContent key={id} id={id} />;
}
function InvalidArticle() {
  const navigate = useNavigate(),
    location = useLocation();
  return (
    <div className={styles.errorPage}>
      <h1>无效的文章地址</h1>
      <Button
        aria-label="返回列表"
        onClick={() => navigate(getArticleListReturnTo(location.state))}
      >
        返回列表
      </Button>
    </div>
  );
}
function ArticleDetailContent({ id }: { id: number }) {
  const query = useArticleDetailQuery(id),
    navigate = useNavigate(),
    location = useLocation();
  const back = (
    <Button aria-label="返回列表" onClick={() => navigate(getArticleListReturnTo(location.state))}>
      返回列表
    </Button>
  );
  if (query.error?.status === 404)
    return (
      <div className={styles.errorPage}>
        <h1>文章不存在</h1>
        {back}
      </div>
    );
  return (
    <section>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.eyebrow}>ARTICLE DETAIL</div>
          <h1>{query.data?.title ?? '文章详情'}</h1>
        </div>
        {back}
      </div>
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
      <Card className={styles.panel}>
        {query.isPending ? (
          <Skeleton active />
        ) : (
          query.data && (
            <>
              <div className={styles.detailMeta}>
                <Tag color="blue">{getChannelName(query.data.channelId)}</Tag>
                <span>
                  创建于 {new Date(query.data.createdAt).toLocaleString('zh-CN', { hour12: false })}
                </span>
              </div>
              <article className={styles.body}>{query.data.content}</article>
            </>
          )
        )}
      </Card>
    </section>
  );
}
