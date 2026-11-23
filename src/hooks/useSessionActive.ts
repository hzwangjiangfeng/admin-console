import { useEffect, useRef } from 'react';

/* 判断当前组件是否仍然处于挂载状态，防止异步操作完成后，在已经卸载的组件中继续执行页面跳转、通知等操作 */
export function useSessionActive() {
  // 创建一个 Ref 对象，false 表示组件不处于活动状态
  // 为什么不使用 useState？因为这里仅需要记录一个值，不需要因为它改变而重新渲染页面
  const active = useRef(false);
  // 只在首次渲染后执行
  useEffect(() => {
    // 标记当前组件处于活动状态
    active.current = true;
    // 在组件卸载时，将 active.current 设置为 false，表示组件不再处于活动状态
    return () => {
      active.current = false;
    };
  }, []);

  return () => active.current;
}
