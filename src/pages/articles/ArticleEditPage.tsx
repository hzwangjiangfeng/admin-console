import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, Card, Skeleton } from 'antd';
import { parseArticleId } from '../../utils/articles/listParams';
import { getArticleListReturnTo } from '../../utils/articles/navigation';
import { useArticleDetailQuery } from '../../hooks/articles/useArticleQueries';
import { useArticleEditor } from '../../hooks/articles/useArticleEditor';
import { useUpdateArticleMutation } from '../../hooks/articles/useArticleMutations';
import { useSessionActive } from '../../hooks/useSessionActive';
import ArticleForm from '../../components/articles/ArticleForm';
import styles from './ArticlePages.module.css';
export default function ArticleEditPage() {
 const id=parseArticleId(useParams().id),navigate=useNavigate(),location=useLocation();
 if(id===null)return <div className={styles.errorPage}><h1>无效的文章地址</h1><Button aria-label="返回列表" onClick={()=>navigate(getArticleListReturnTo(location.state))}>返回列表</Button></div>;
 return <ArticleEditSession key={id} id={id} />;
}
function ArticleEditSession({id}:{id:number}) {
 const detail=useArticleDetailQuery(id),editor=useArticleEditor(id),mutation=useUpdateArticleMutation();
 const navigate=useNavigate(),location=useLocation(),{message}=App.useApp();
 const isSessionActive=useSessionActive();
 const back=()=>navigate(getArticleListReturnTo(location.state));
 return <section><div className={styles.pageHeader}><div><div className={styles.eyebrow}>EDIT ARTICLE</div><h1>编辑文章</h1><p className={styles.subtitle}>专注修改，后台刷新不会覆盖正在编辑的内容。</p></div><Button aria-label="返回列表" onClick={back}>返回列表</Button></div>
  {editor.initializationError&&<Alert className={styles.notice} type="error" title={editor.initializationError.message} action={<Button aria-label="重试" onClick={editor.retryInitialization}>重试</Button>} />}
  {editor.initialValues&&detail.isError&&<Alert className={styles.notice} type="warning" title={detail.error.message} description="后台刷新未完成，当前编辑内容已保留。" action={<Button aria-label="重试刷新" onClick={()=>void detail.refetch()}>重试</Button>} />}
  {mutation.isError&&<Alert className={styles.notice} type="error" title={mutation.error.message} />}
  <Card className={`${styles.panel} ${styles.formCard}`}>{editor.isInitializing?<Skeleton active />:editor.initialValues&&<ArticleForm initialValues={editor.initialValues} isSubmitting={mutation.isPending} fieldErrors={mutation.error?.fieldErrors} onCancel={back} onSubmit={async input=>{
   try {await mutation.mutateAsync({id,input});}catch{return;}
   if(!isSessionActive())return;
   void message.success('保存成功');navigate(getArticleListReturnTo(location.state),{replace:true});
  }} />}</Card>
 </section>;
}
