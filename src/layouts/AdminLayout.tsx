import { Link, Outlet } from 'react-router-dom';
import styles from './AdminLayout.module.css';
export default function AdminLayout() {
  return <div className={styles.shell}><aside className={styles.sidebar}><div className={styles.brand}><span className={styles.mark}>文</span><div>内容工作台<small>CONTENT WORKSPACE</small></div></div><nav aria-label="后台导航"><Link className={styles.navLink} to="/admin/articles">文章管理</Link></nav><div className={styles.caption}>专注内容，有序管理</div></aside><div className={styles.workspace}><header className={styles.header}><span>工作空间 / 文章管理</span><span className={styles.badge}>ADMIN</span></header><main className={styles.main}>{import.meta.env.VITE_DEMO_MODE === 'true' && <p role="status">演示模式：数据仅保存在当前页面内存中，刷新后恢复示例数据。</p>}<Outlet /></main></div></div>;
}
