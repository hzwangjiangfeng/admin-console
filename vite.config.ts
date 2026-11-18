import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'VITE_');
 const mockApiGuard:Plugin={
  name:'mock-api-contract-guard',
  apply:'serve',
  configureServer(server){
   server.middlewares.use((request,response,next)=>{
    const path=request.url?.split('?')[0]??'';
    if(path!=='/api'&&!path.startsWith('/api/')){next();return;}
    // A properly intercepted Mock request never reaches Vite. Do not serve the SPA HTML as API data.
    response.statusCode=503;
    response.setHeader('Content-Type','application/json; charset=utf-8');
    response.setHeader('Cache-Control','no-store');
    response.end(JSON.stringify({code:'MOCK_NOT_INTERCEPTED',message:'开发 Mock 未接管 API 请求，请检查 Mock 是否启动，并关闭 Chrome Service Workers 的 Bypass for network'}));
   });
  },
 };
 return {
  plugins:[react(),...(env.VITE_ENABLE_MOCK==='true'?[mockApiGuard]:[])],
  test:{
   environment:'jsdom',
   environmentOptions:{jsdom:{url:'http://localhost:5173'}},
   setupFiles:['./src/test/setup.ts'],
   include:['src/**/*.test.{ts,tsx}'],
   restoreMocks:true,
  },
 };
});
