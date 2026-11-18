import type { Article } from '../../types/articles';
export function createSeedArticles(): Article[] {
 return Array.from({length:35},(_,index)=>{
  const createdAt=new Date(Date.UTC(2026,0,index+1)).toISOString();
  return {id:index+1,title:`${index%2===0?'React 实践':'Vue 笔记'} ${String(index+1).padStart(2,'0')}`,channelId:index%3+1,content:`这是第 ${index+1} 篇示例文章。\n\n用清晰的结构记录想法，让每一篇内容都井井有条。`,createdAt,updatedAt:createdAt};
 });
}
export const articleStore={articles:createSeedArticles(),nextId:36};
export function resetArticleStore(seed:Article[]=createSeedArticles()) {articleStore.articles=structuredClone(seed);articleStore.nextId=Math.max(0,...seed.map(a=>a.id))+1;}
