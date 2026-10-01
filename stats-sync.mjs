import {gzipSync,gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// This is the sole channel registry. IDs resolve from official handles once,
// then remain pinned in the successful cache. Never infer channel ownership.
export const channels = [
 {key:'androidbasha',channelId:'UCs8vDlWQQJb21sLh9jh1qWA',name:'Android Basha',handle:'@AndroidBasha',credentialRef:'ANDROID_BASHA',order:1},
 {key:'camerabasha',channelId:'UCSg5-KvujMNs7nOj4WgLt3g',name:'Camera Basha',handle:'@CameraBasha',credentialRef:'CAMERA_BASHA',order:2},
 {key:'bashapodcast',channelId:'UC06QeEDxxig1DOGrPxq3IJA',name:'BashaPodcast',handle:'@BashaPodcast',credentialRef:'BASHA_PODCAST',order:3},
 {key:'hifibasha',channelId:'UCEOpbSlsyEkfGZWHns2nNhA',name:'HiFi Basha',handle:'@HiFiBasha',credentialRef:'HIFI_BASHA',order:4},
 {key:'gamingbasha',channelId:'UCIWgNj19ia7sR7cxJkIKsLw',name:'Gaming Basha',handle:'@GamingBasha',credentialRef:'GAMING_BASHA',order:5}
];
export const percent=(current,previous)=>previous===0?null:(current-previous)/previous*100;
export const addDays=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export function lastCompleteDay(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=t=>parts.find(p=>p.type===t).value;
 return addDays(`${value('year')}-${value('month')}-${value('day')}`,-1);
}
export function history(rows,start,end){
 const counts=new Map(rows.map(([date,views])=>[date,views]));
 const result=[];for(let date=start;date<=end;date=addDays(date,1))result.push({date,views:counts.get(date)||0});
 return result;
}
export function subscriberHistory(rows,start,end){
 const counts=new Map(rows.map(r=>[r[0],r[2]]));
 const result=[];for(let date=start;date<=end;date=addDays(date,1))result.push({date,gained:counts.get(date)||0});
 return result;
}
const numeric=v=>/^\d+$/.test(String(v))&&Number.isSafeInteger(Number(v))?Number(v):null;
const sum=(rows,field)=>rows.every(c=>Number.isSafeInteger(c[field]))?rows.reduce((n,c)=>n+c[field],0):null;
export function normalize(publicCache,analyticsCache,now=new Date()){
 const available=channels.map(c=>analyticsCache[c.key]).filter(a=>a?.dailyViews?.length===90);
 const analyticsThrough=available.length?available.map(a=>a.through).sort()[0]:null;
 const normalized=channels.map(c=>{
  const pub=publicCache[c.key]||{},a=analyticsCache[c.key],dailyViews=a&&analyticsThrough&&a.dailyViews[0].date<=addDays(analyticsThrough,-59)?a.dailyViews.filter(d=>d.date>=addDays(analyticsThrough,-59)&&d.date<=analyticsThrough):[];
  const ready=dailyViews.length===60,views30d=ready?dailyViews.slice(-30).reduce((n,d)=>n+d.views,0):null,previousViews30d=ready?dailyViews.slice(0,30).reduce((n,d)=>n+d.views,0):null;
  const gains=ready&&a?.dailySubscribers?.filter(d=>d.date>=addDays(analyticsThrough,-59)&&d.date<=analyticsThrough),subsReady=gains?.length===60;
  const subscribersGained30d=subsReady?gains.slice(-30).reduce((n,d)=>n+d.gained,0):null,previousSubscribersGained30d=subsReady?gains.slice(0,30).reduce((n,d)=>n+d.gained,0):null;
  return {key:c.key,name:c.name,order:c.order,channelId:pub.channelId||null,thumbnail:pub.thumbnail||null,subscribers:pub.subscribers??null,totalViews:pub.totalViews??null,publicUpdatedAt:pub.updatedAt||null,analyticsUpdatedAt:a?.updatedAt||null,analyticsStatus:ready?'connected':'connection-required',analyticsThrough:ready?analyticsThrough:null,views30d,previousViews30d,changePercent:ready?percent(views30d,previousViews30d):null,subscribersGained30d,previousSubscribersGained30d,subscriberChangePercent:subsReady?percent(subscribersGained30d,previousSubscribersGained30d):null,dailyViews};
 });
 const views30d=sum(normalized,'views30d'),previousViews30d=sum(normalized,'previousViews30d');
 const publicTimes=normalized.map(c=>c.publicUpdatedAt).filter(Boolean).sort();
 return {schemaVersion:1,updatedAt:publicTimes.at(-1)||null,checkedAt:now.toISOString(),timezone:'Asia/Amman',analyticsTimezone:'America/Los_Angeles',analyticsThrough,
  periods:analyticsThrough?{current:{start:addDays(analyticsThrough,-29),end:analyticsThrough},previous:{start:addDays(analyticsThrough,-59),end:addDays(analyticsThrough,-30)}}:null,
  network:{subscribers:sum(normalized,'subscribers'),totalViews:sum(normalized,'totalViews'),views30d,previousViews30d,changePercent:views30d===null?null:percent(views30d,previousViews30d),analyticsChannels:normalized.filter(c=>c.analyticsStatus==='connected').length},channels:normalized};
}
async function json(response){if(!response.ok)throw new Error('Upstream request failed');const data=await response.json();if(data.error)throw new Error('Upstream rejected request');return data;}
function kvURL(env,key){for(const n of ['CLOUDFLARE_ACCOUNT_ID','ARCHIVE_NAMESPACE_ID'])if(!/^[a-f0-9]{32}$/i.test(env[n]||''))throw new Error('Missing storage configuration');return `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${env.ARCHIVE_NAMESPACE_ID}/values/${encodeURIComponent(key)}`;}
async function readCache(env,key,fetcher){const r=await fetcher(kvURL(env,key),{headers:{Authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`}});if(r.status===404)return {};if(!r.ok)throw new Error('Cache unavailable; refusing to replace previous data');return JSON.parse(gunzipSync(Buffer.from(await r.arrayBuffer())));}
async function writeCache(env,key,data,fetcher){await json(await fetcher(kvURL(env,key),{method:'PUT',headers:{Authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/octet-stream'},body:gzipSync(JSON.stringify(data))}));}
export async function collect(env,publicCache,analyticsCache,fetcher=fetch,now=new Date()){
 const request=async(params)=>json(await fetcher('https://www.googleapis.com/youtube/v3/channels?'+new URLSearchParams(params),{headers:{'X-Goog-Api-Key':env.YOUTUBE_API_KEY},signal:AbortSignal.timeout(20000)}));
 for(const c of channels){if(publicCache[c.key]?.channelId)continue;if(c.channelId){publicCache[c.key]={channelId:c.channelId};continue;}try{const d=await request({part:'id',forHandle:c.handle});const id=d.items?.[0]?.id;if(/^UC[\w-]{22}$/.test(id||''))publicCache[c.key]={channelId:id};}catch{console.warn(`${c.name}: channel resolution pending`);}}
 const ids=channels.map(c=>publicCache[c.key]?.channelId).filter(Boolean);
 let publicSuccess=false;
 if(ids.length)try{
  const response=await request({part:'snippet,statistics',id:ids.join(',')});
  for(const c of channels){const item=response.items?.find(i=>i.id===publicCache[c.key]?.channelId);if(!item)continue;const totalViews=numeric(item.statistics?.viewCount),subscribers=item.statistics?.hiddenSubscriberCount?null:numeric(item.statistics?.subscriberCount);if(totalViews===null)continue;
   const thumbnail=item.snippet?.thumbnails?.medium?.url||item.snippet?.thumbnails?.default?.url||null;
   publicCache[c.key]={channelId:item.id,thumbnail:thumbnail?.startsWith('https://')?thumbnail:null,subscribers,totalViews,updatedAt:now.toISOString()};publicSuccess=true;console.log(`${c.name}: ${item.id}`);
  }
 }catch{console.warn('Public statistics refresh delayed; cached values retained');}
 for(const c of channels){
  const refresh=env[c.credentialRef+'_REFRESH_TOKEN'],cached=analyticsCache[c.key];
  if(!refresh||!env.GOOGLE_OAUTH_CLIENT_ID||!env.GOOGLE_OAUTH_CLIENT_SECRET||!publicCache[c.key]?.channelId)continue;
  if(cached?.dailySubscribers?.length===90&&now-new Date(cached.updatedAt)<6*3600000)continue;
  try{
   const token=await json(await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_OAUTH_CLIENT_ID,client_secret:env.GOOGLE_OAUTH_CLIENT_SECRET,refresh_token:refresh,grant_type:'refresh_token'}),signal:AbortSignal.timeout(20000)}));
   const end=lastCompleteDay(now),start=addDays(end,-100);
   const report=await json(await fetcher('https://youtubeanalytics.googleapis.com/v2/reports?'+new URLSearchParams({ids:'channel=='+publicCache[c.key].channelId,startDate:start,endDate:end,metrics:'views,subscribersGained',dimensions:'day',sort:'day',maxResults:'200'}),{headers:{Authorization:`Bearer ${token.access_token}`},signal:AbortSignal.timeout(30000)}));
   const rows=report.rows||[];if(!rows.length)throw new Error('Analytics pending');
   if(rows.some(r=>!/^\d{4}-\d{2}-\d{2}$/.test(r[0])||!Number.isSafeInteger(r[1])||r[1]<0||!Number.isSafeInteger(r[2])||r[2]<0||r[0]<start||r[0]>end))throw new Error('Invalid daily report');
   const through=rows.at(-1)[0];if(through<addDays(end,-10))throw new Error('Analytics too old');
   analyticsCache[c.key]={through,updatedAt:now.toISOString(),dailyViews:history(rows,addDays(through,-89),through),dailySubscribers:subscriberHistory(rows,addDays(through,-89),through)};
   console.log(`${c.name}: Analytics connected through ${through}`);
  }catch{console.warn(`${c.name}: Analytics refresh delayed or owner authorization required; cached values retained`);}
 }
 return {publicSuccess,publicCache,analyticsCache,data:normalize(publicCache,analyticsCache,now)};
}
export async function run(env=process.env,fetcher=fetch){
 if(!env.YOUTUBE_API_KEY||!env.CLOUDFLARE_API_TOKEN)throw new Error('Missing private service secrets');
 const [pub,analytics]=await Promise.all([readCache(env,'stats:public:gzip',fetcher),readCache(env,'stats:analytics:gzip',fetcher)]);
 const result=await collect(env,pub,analytics,fetcher);
 if(!result.publicSuccess)throw new Error('No new public statistics; previous snapshot retained');
 await writeCache(env,'stats:public:gzip',result.publicCache,fetcher);
 await writeCache(env,'stats:analytics:gzip',result.analyticsCache,fetcher);
 await writeCache(env,'stats:dashboard:gzip',result.data,fetcher);
 console.log('Published network dashboard. Analytics connections: '+result.data.network.analyticsChannels+'/5');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run().catch(()=>{console.error('Statistics update could not complete. Previous dashboard remains available. Check secret names, API enablement and channel authorization.');process.exitCode=1;});
