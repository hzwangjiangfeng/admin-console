import { useLocation, useNavigate } from 'react-router-dom';
import { App, Alert, Button, Card } from 'antd';
import { useSessionActive } from '../../hooks/useSessionActive';
import ArticleForm from '../../components/articles/ArticleForm';
import { useCreateArticleMutation } from '../../hooks/articles/useArticleMutations';
import { getArticleListReturnTo } from '../../utils/articles/navigation';
import styles from './ArticlePages.module.css';
export default function ArticleCreatePage() {
 const mutation=useCreateArticleMutation(),navigate=useNavigate(),location=useLocation();
 const {notification}=App.useApp();
 const isSessionActive=useSessionActive();
 return <section><div className={styles.pageHeader}><div><div className={styles.eyebrow}>CREATE ARTICLE</div><h1>新增文章</h1><p className={styles.subtitle}>将新的想法整理成文章。</p></div></div>
  {mutation.isError&&<Alert className={styles.notice} type="error" title={mutation.error.message} />}
  <Card className={`${styles.panel} ${styles.formCard}`}><ArticleForm initialValues={{title:'',content:''}} isSubmitting={mutation.isPending} fieldErrors={mutation.error?.fieldErrors} onCancel={()=>navigate(getArticleListReturnTo(location.state))} onSubmit={async values=>{
   let article; try {article=await mutation.mutateAsync(values);} catch {return;}
   if(!isSessionActive())return;
   navigate('/admin/articles',{replace:true});
   notification.success({key:'article-created',title:'新增成功',description:'文章已保存，可继续管理内容或查看刚创建的文章。',duration:0,actions:<Button aria-label="查看文章" onClick={()=>{notification.destroy('article-created');navigate(`/admin/articles/${article.id}`,{state:{from:'/admin/articles'}});}}>查看文章</Button>});
  }} /></Card>
 </section>;
}
