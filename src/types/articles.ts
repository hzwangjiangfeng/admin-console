export interface Article {
  id: number;
  title: string;
  channelId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}
export type ArticleListItem = Omit<Article, 'content'>;
export interface ArticleListResponse {
  items: ArticleListItem[];
  total: number;
}
export interface CreateArticleInput {
  title: string;
  channelId: number;
  content: string;
}
export type UpdateArticleInput = Partial<CreateArticleInput>;
export type ArticleFormValues = CreateArticleInput;
export type FieldErrors = Partial<Record<keyof ArticleFormValues, string[]>>;
export interface ApiErrorResponse {
  code: string;
  message: string;
  fieldErrors?: FieldErrors;
}
export type ArticleSortField = 'createdAt' | 'updatedAt';
export interface ArticleListParams {
  page: number;
  pageSize: number;
  keyword: string;
  channelId: number | null;
  sortBy: ArticleSortField;
  sortOrder: 'asc' | 'desc';
}
