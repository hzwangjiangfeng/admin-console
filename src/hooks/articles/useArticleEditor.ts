import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ArticleFormValues } from '../../types/articles';
import { toApiError, type ApiError } from '../../lib/apiError';
import { articleDetailOptions } from './useArticleQueries';
interface Initialization { id:number; values:ArticleFormValues|null; error:ApiError|null }
export function useArticleEditor(id:number) {
 const client=useQueryClient();
 const [attempt,setAttempt]=useState(0);
 const [state,setState]=useState<Initialization>({id,values:null,error:null});
 useEffect(()=>{
  let active=true;
  void client.fetchQuery(articleDetailOptions(id)).then(article=>{
   if(active) setState({id,values:{title:article.title,channelId:article.channelId,content:article.content},error:null});
  }).catch(error=>{if(active)setState({id,values:null,error:toApiError(error)});});
  return ()=>{active=false;};
 },[client,id,attempt]);
 const current=state.id===id?state:null;
 const initialValues=current?.values??null,initializationError=current?.error??null;
 return {initialValues,initializationError,isInitializing:!initialValues&&!initializationError,retryInitialization(){setState({id,values:null,error:null});setAttempt(value=>value+1);}};
}
