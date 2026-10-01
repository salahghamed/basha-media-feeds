// Public reads only. GitHub builds and uploads compressed feeds separately.
const feeds = {'/graph.json':'android:graph:gzip','/camera/catalog.json':'camera:catalog:gzip','/podcast/episodes.json':'podcast:episodes:gzip'};
export default {
 async fetch(request,env){
  const url=new URL(request.url),origin=request.headers.get('Origin');
  const allowed=['https://bashamedia.me','https://www.bashamedia.me'];
  const headers={'Access-Control-Allow-Origin':origin&&allowed.includes(origin)?origin:allowed[0],'Vary':'Origin','Cache-Control':'public,max-age=300','X-Content-Type-Options':'nosniff'};
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers});
  if(origin&&!allowed.includes(origin))return new Response('Origin not allowed',{status:403,headers});
  const key=feeds[url.pathname];if(!key)return new Response('Not found',{status:404,headers});
  const value=await env.ARCHIVE.get(key,{type:'stream'});
  if(!value)return Response.json({error:'Feed awaits its first successful sync'},{status:503,headers:{...headers,'Cache-Control':'no-store'}});
  return new Response(request.method==='HEAD'?null:value,{headers:{...headers,'Content-Type':'application/json;charset=utf-8','Content-Encoding':'gzip'}});
 }
};
