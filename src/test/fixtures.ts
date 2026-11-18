import type { Article } from '../types/articles';
export function makeArticle(overrides: Partial<Article> = {}): Article {
 const createdAt=overrides.createdAt??'2026-01-01T00:00:00.000Z';
 return {id:1,title:'示例文章',channelId:1,content:'文章正文',createdAt,updatedAt:createdAt,...overrides};
}
