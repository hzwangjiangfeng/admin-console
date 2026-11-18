import { test, expect } from '@playwright/test';

test('bypassed Mock is an explicit recoverable error, not cached HTML success',async({page,context})=>{
 const session=await context.newCDPSession(page);
 await session.send('Network.enable');
 await session.send('Network.setBypassServiceWorker',{bypass:true});
 let apiRequests=0;page.on('request',request=>{if(new URL(request.url()).pathname==='/api/admin/articles')apiRequests++;});
 await page.goto('/admin/articles');
 await expect(page.getByRole('heading',{name:'文章列表',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>navigator.serviceWorker.controller?.scriptURL)).toContain('mockServiceWorker.js');
 await expect(page.getByRole('alert')).toContainText('Mock 未接管 API 请求');
 expect(apiRequests).toBe(1);
 await session.send('Network.setBypassServiceWorker',{bypass:false});
 await page.getByRole('button',{name:'重试',exact:true}).click();
 const rows=page.locator('tbody tr[data-row-key]');await expect(rows).toHaveCount(10);await expect(rows.first()).toHaveAttribute('data-row-key','35');
 await page.getByRole('textbox',{name:'标题关键词'}).fill('React');await page.getByRole('button',{name:'查询',exact:true}).click();await expect(rows).toHaveCount(10);await expect(page.getByText('共 18 篇',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'重置',exact:true}).click();await expect(page).toHaveURL('http://127.0.0.1:5173/admin/articles');await expect(rows).toHaveCount(10);await expect(page.getByText('共 35 篇',{exact:true})).toBeVisible();
});
