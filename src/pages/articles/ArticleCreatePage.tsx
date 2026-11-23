import { useLocation, useNavigate } from 'react-router';
import { App, Alert, Button, Card } from 'antd';
import { useSessionActive } from '../../hooks/useSessionActive';
import ArticleForm from '../../components/articles/ArticleForm';
import { useCreateArticleMutation } from '../../hooks/articles/useArticleMutations';
import { getArticleListReturnTo } from '../../utils/articles/navigation';
import styles from './ArticlePages.module.css';
export default function ArticleCreatePage() {
  // 创建文章的异步操作
  const mutation = useCreateArticleMutation();

  const navigate = useNavigate();
  const location = useLocation();
  // 获取当前会话是否仍然活跃的函数，避免在组件卸载后尝试更新状态
  const isSessionActive = useSessionActive();
  // Ant Design 的 App.useApp() 提供了全局的 notification，在 src/app/AppProviders.tsx 中已配置
  const { notification } = App.useApp();

  return (
    <section>
      {/* 页面头部：新增文章的标题和简介 */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.eyebrow}>CREATE ARTICLE</div>
          <h1>新增文章</h1>
          <p className={styles.subtitle}>将新的想法整理成文章。</p>
        </div>
      </div>

      {/* 提交错误提示：新增失败时显示原因 */}
      {mutation.isError && (
        <Alert className={styles.notice} type="error" title={mutation.error.message} />
      )}

      {/* 表单卡片：使用 ArticleForm 填写文章，支持提交或取消 */}
      <Card className={`${styles.panel} ${styles.formCard}`}>
        <ArticleForm
          initialValues={{ title: '', content: '' }}
          isSubmitting={mutation.isPending}
          fieldErrors={mutation.error?.fieldErrors}
          onCancel={() => navigate(getArticleListReturnTo(location.state))} // location.state 用于获取进入当前页面时携带的路由状态
          onSubmit={async (values) => {
            let article;
            try {
              article = await mutation.mutateAsync(values);
            } catch {
              return;
            }
            // 如果组件不处于活动状态（比如，用户已经离开了新增页面），直接返回
            if (!isSessionActive()) return;
            // 成功后跳转回文章列表页，使用 replace 避免用户点击浏览器“后退”时回到已提交的表单页
            navigate('/admin/articles', { replace: true });
            // 成功通知：提供“查看文章”按钮，跳转到刚创建的文章详情页
            notification.success({
              key: 'article-created',
              title: '新增成功',
              description: '文章已保存，可继续管理内容或查看刚创建的文章。',
              duration: 0,
              actions: (
                <Button
                  aria-label="查看文章"
                  onClick={() => {
                    notification.destroy('article-created');
                    navigate(`/admin/articles/${article.id}`, {
                      state: { from: '/admin/articles' },
                    });
                  }}
                >
                  查看文章
                </Button>
              ),
            });
          }}
        />
      </Card>
    </section>
  );
}
