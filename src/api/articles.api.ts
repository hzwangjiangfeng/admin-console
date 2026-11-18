import type { AxiosResponse } from 'axios';
import type { ArticleListParams, CreateArticleInput, UpdateArticleInput } from '../types/articles';
import { http } from '../lib/http';
import { toApiError } from '../lib/apiError';
import { serializeArticleParams } from '../utils/articles/listParams';
import { invalidArticleResponse, readArticle, readArticleList } from './articleResponses';

async function request<T>(run:()=>Promise<AxiosResponse<unknown>>,read:(response:AxiosResponse<unknown>)=>T):Promise<T> {
 try{return read(await run());}catch(error){throw toApiError(error);}
}
export const getArticles=(params:ArticleListParams,signal?:AbortSignal)=>request(()=>http.get('/admin/articles',{params:serializeArticleParams(params),signal}),response=>readArticleList(response.data,response.status));
export const getArticle=(id:number,signal?:AbortSignal)=>request(()=>http.get(`/admin/articles/${id}`,{signal}),response=>readArticle(response.data,response.status));
export const createArticle=(input:CreateArticleInput)=>request(()=>http.post('/admin/articles',input),response=>readArticle(response.data,response.status));
export const updateArticle=(id:number,input:UpdateArticleInput)=>request(()=>http.patch(`/admin/articles/${id}`,input),response=>readArticle(response.data,response.status));
export async function deleteArticle(id:number):Promise<void> {
 await request(()=>http.delete(`/admin/articles/${id}`),response=>{if(response.status!==204)throw invalidArticleResponse(response.status);});
}
