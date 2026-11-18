import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Alert, App, Button, Card, Form, Input, Modal, Select, Space, Table, Tag } from 'antd';
import type { TableProps } from 'antd';
import { CHANNEL_OPTIONS, getChannelName } from '../../constants/channels';
import { useDeleteArticleMutation } from '../../hooks/articles/useArticleMutations';
import { useArticleListQuery } from '../../hooks/articles/useArticleQueries';
import { normalizeArticleParams, serializeArticleParams } from '../../utils/articles/listParams';
import { createArticleListState } from '../../utils/articles/navigation';
import type { ArticleListItem, ArticleListParams } from '../../types/articles';
import styles from './ArticlePages.module.css';
export default function ArticleListPage() {
 const [search, setSearch] = useSearchParams();
 const params = useMemo(() => normalizeArticleParams(search), [search]);
 const location = useLocation();
 const from = createArticleListState(location);
 const [form] = Form.useForm<{keyword:string; channelId?:number}>();
 const query = useArticleListQuery(params);
 const deletion = useDeleteArticleMutation();
 const [deleteId,setDeleteId] = useState<number|null>(null);
 const [repairEmptyPage,setRepairEmptyPage] = useState(false);
 const {message} = App.useApp();
 useEffect(()=>{
  if(!repairEmptyPage||query.isFetching||query.isError||!query.data)return;
  if(query.data.items.length===0&&params.page>1) setSearch(serializeArticleParams({...params,page:params.page-1}),{replace:true});
  else setRepairEmptyPage(false);
 },[repairEmptyPage,query.isFetching,query.isError,query.data,params,setSearch]);
 async function confirmDelete() {
  if(deleteId===null||deletion.isPending)return;
  const id=deleteId;
  try {await deletion.mutateAsync(id);}catch{return;}
  setDeleteId(null);setRepairEmptyPage(true);void message.success('删除成功');
 }
 const searchString = search.toString();
 useEffect(() => { form.setFieldsValue({keyword: params.keyword, channelId: params.channelId ?? undefined}); }, [form, params.keyword, params.channelId, searchString]);
 function changeParams(patch: Partial<ArticleListParams>) { setSearch(serializeArticleParams({...params, ...patch}),{flushSync:true}); }
 function resetParams() {
  form.setFieldsValue({keyword:'',channelId:undefined});
  setSearch(new URLSearchParams(),{flushSync:true});
 }
 const columns: TableProps<ArticleListItem>['columns'] = [
  {title:'文章标题',dataIndex:'title',render:(title:string,row) => <Link to={`/admin/articles/${row.id}`} state={from} className={styles.titleLink}>{title}</Link>},
  {title:'所属频道',dataIndex:'channelId',width:130,render:(id:number)=><Tag color="blue">{getChannelName(id)}</Tag>},
  {title:'创建时间',dataIndex:'createdAt',width:210,sorter:true,sortOrder:params.sortBy==='createdAt'?(params.sortOrder==='desc'?'descend':'ascend'):null,render:(value:string)=>new Date(value).toLocaleString('zh-CN',{hour12:false})},
  {title:'更新时间',dataIndex:'updatedAt',width:210,sorter:true,sortOrder:params.sortBy==='updatedAt'?(params.sortOrder==='desc'?'descend':'ascend'):null,render:(value:string)=>new Date(value).toLocaleString('zh-CN',{hour12:false})},
  {title:'操作',key:'actions',width:220,render:(_,row)=><Space><Link to={`/admin/articles/${row.id}`} state={from}>详情</Link><Link to={`/admin/articles/${row.id}/edit`} state={from}>编辑</Link><Button type="link" danger aria-label={`删除《${row.title}》`} onClick={()=>{deletion.reset();setDeleteId(row.id);}}>删除</Button></Space>},
 ];
 return <section><div className={styles.pageHeader}><div><div className={styles.eyebrow}>CONTENT MANAGEMENT</div><h1>文章列表</h1><p className={styles.subtitle}>整理想法，发布内容，让每一篇文章都易于找到。</p></div><Link to="/admin/articles/new" state={from}><Button type="primary" size="large">新增文章</Button></Link></div>
  <Card className={styles.panel}><Form form={form} layout="inline" onFinish={values=>changeParams({keyword:(values.keyword??'').trim(),channelId:values.channelId??null,page:1})} className={styles.filters}>
   <Form.Item label="标题关键词" name="keyword"><Input placeholder="搜索文章标题" allowClear /></Form.Item>
   <Form.Item label="所属频道" name="channelId"><Select options={CHANNEL_OPTIONS} placeholder="全部频道" allowClear style={{minWidth:150}} /></Form.Item>
   <Form.Item><Space><Button type="primary" htmlType="submit" aria-label="查询">查询</Button><Button htmlType="button" aria-label="重置" onClick={resetParams}>重置</Button></Space></Form.Item>
  </Form></Card>
  {query.isError && <Alert className={styles.notice} type="error" showIcon title={query.error.message} action={<Button aria-label="重试" onClick={()=>void query.refetch()}>重试</Button>} />}
  <Card className={styles.panel}><div className={styles.tableHeading}><h2>全部文章</h2><span className={styles.muted}>{query.isFetching&&query.data?'正在后台更新…':'文章内容与发布记录'}</span></div>
   <Table<ArticleListItem> rowKey="id" columns={columns} dataSource={query.data?.items??[]} loading={query.isPending} locale={{emptyText:'暂无文章'}} sortDirections={['ascend','descend','ascend']} scroll={{x:1000}} pagination={{current:params.page,pageSize:params.pageSize,total:query.data?.total??0,showSizeChanger:true,pageSizeOptions:[...new Set([10,20,50,params.pageSize])].sort((a,b)=>a-b),showTotal:total=>`共 ${total} 篇`}} onChange={(pagination,_filters,sorter,extra)=>{ if(extra.action==='paginate') changeParams({page:pagination.pageSize!==params.pageSize?1:pagination.current??1,pageSize:pagination.pageSize??10}); if(extra.action==='sort') {const value=Array.isArray(sorter)?sorter[0]:sorter;if(value.field==='createdAt'||value.field==='updatedAt')changeParams({page:1,sortBy:value.field,sortOrder:value.order==='ascend'?'asc':'desc'});} }} />
  </Card>
  <Modal title="删除文章" open={deleteId!==null} onOk={()=>void confirmDelete()} onCancel={()=>{if(!deletion.isPending)setDeleteId(null);}} okText="确认删除" cancelText="取消删除" confirmLoading={deletion.isPending} okButtonProps={{danger:true,disabled:deletion.isPending,'aria-label':'确认删除'}} cancelButtonProps={{disabled:deletion.isPending,'aria-label':'取消删除'}} closable={!deletion.isPending} mask={{closable:!deletion.isPending}}>
   <p>确定删除这篇文章吗？此操作无法撤销。</p>
   {deletion.isError&&<Alert type="error" title={deletion.error.message} />}
  </Modal>
 </section>;
}
