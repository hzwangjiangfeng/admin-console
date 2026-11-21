import { Link, Outlet } from 'react-router';
import styles from './AdminLayout.module.css';
export default function AdminLayout() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            A
          </span>
          <div>管理后台</div>
        </div>
        <nav aria-label="后台导航">
          <Link className={styles.navLink} to="/admin/articles">
            文章管理
          </Link>
        </nav>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.header}>
          <span>工作空间 / 文章管理</span>
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
