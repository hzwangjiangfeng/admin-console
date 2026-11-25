import { Tag } from 'antd';
import { ARTICLE_STATUS_LABELS } from '../../constants/articleStatuses';
import type { ArticleStatus } from '../../types/articles';

const STATUS_TAG_COLORS = { draft: 'default', published: 'green', archived: 'orange' } as const;

export default function ArticleStatusTag({ status }: { status: ArticleStatus }) {
  return <Tag color={STATUS_TAG_COLORS[status]}>{ARTICLE_STATUS_LABELS[status]}</Tag>;
}
