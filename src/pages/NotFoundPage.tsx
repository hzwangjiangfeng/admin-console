import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <main>
      <h1>页面不存在</h1>
      <Link to="/admin/articles">返回列表</Link>
    </main>
  );
}
