import {gzipSync,gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const monthStart=(date,offset=0)=>{
 const [year,month]=date.split('-').map(Number);
 return new Date(Date.UTC(year,month-1+offset,1,12)).toISOString().slice(0,10);
};
export const monthEnd=date=>new Date(Date.parse(monthStart(date,1))-86400000).toISOString().slice(0,10);
const validDay=d=>/^\d{4}-\d{2}-\d{2}$/.test(d.date)&&['views','gained','lost'].every(k=>Number.isSafeInteger(d[k])&&d[k]>=0)&&Number.isFinite(d.minutes)&&d.minutes>=0;
export function calendarHistory(rows,start,end){
 const indexed=new Map(rows.map(r=>[r[0],r]));
 const result=[];
 for(let date=start;date<=end;date=new Date(Date.parse(date+'T12:00:00Z')+86400000).toISOString().slice(0,10)){
  const r=indexed.get(date);result.push({date,views:r?.[1]??0,gained:r?.[2]??0,lost:r?.[3]??0,minutes:r?.[4]??0});
 }
 return result;
}
export function calendarSummaries(cache,through){
 if(!cache||!/^\d{4}-\d{2}-\d{2}$/.test(through||''))return [];
 let days=cache.monthlyHistory;
 if(!Array.isArray(days)||!days.length){
  const gains=new Map((cache.dailySubscribers||[]).map(d=>[d.date,d.gained])),extra=new Map((cache.dailyExtended||[]).map(d=>[d.date,d]));
  days=(cache.dailyViews||[]).map(d=>({...d,gained:gains.get(d.date),lost:extra.get(d.date)?.lost,minutes:extra.get(d.date)?.minutes}));
 }
 if(!days.every(validDay)||new Set(days.map(d=>d.date)).size!==days.length)return [];
 days=days.filter(d=>d.date<=through).sort((a,b)=>a.date.localeCompare(b.date));
 const grouped=new Map();for(const d of days){const key=d.date.slice(0,7);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(d);}
 const summaries=[];
 for(const [month,rows] of grouped){
  const start=month+'-01',last=monthEnd(start),end=last<through?last:through;
  const expected=Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000)+1;
  if(rows[0].date!==start||rows.at(-1).date!==end||rows.length!==expected)continue;
  const total=k=>rows.reduce((sum,d)=>sum+d[k],0),views=total('views'),gained=total('gained'),lost=total('lost'),peak=rows.reduce((best,d)=>d.views>best.views?d:best,rows[0]);
  const previous=summaries.find(s=>s.month===monthStart(start,-1).slice(0,7)&&s.complete);
  const current={month,start,end,complete:end===last,daysReported:expected,daysInMonth:Number(last.slice(-2)),views,watchHours:total('minutes')/60,subscribersGained:gained,subscribersLost:lost,netSubscribers:gained-lost,peakDay:views>0?{date:peak.date,views:peak.views,sharePercent:peak.views/views*100}:null,comparison:null};
  if(current.complete&&previous){const change=(a,b)=>b===0?null:(a-b)/b*100;current.comparison={month:previous.month,viewsPercent:change(views,previous.views),watchPercent:change(current.watchHours,previous.watchHours),subscriberPercent:change(gained,previous.subscribersGained)};}
  summaries.push(current);
 }
 return summaries.slice(-13).reverse();
}
export async function paginatedDailyReport(request){
 // A 13-calendar-month daily report has fewer than 400 rows. Request the
 // entire bounded period so a capped response cannot look like a current month.
 const response=await request({maxResults:'500'}),rows=response.rows||[];
 if(!Array.isArray(rows)||rows.length>400)throw new Error('Daily report exceeded bounded history window');
 return rows;
}


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
export function extendedHistory(rows,start,end){
 const values=new Map(rows.map(r=>[r[0],r]));const result=[];
 for(let date=start;date<=end;date=addDays(date,1)){const r=values.get(date);result.push({date,lost:r?.[3]||0,minutes:r?.[4]||0});}return result;
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
  const extra=ready&&a?.dailyExtended?.filter(d=>d.date>=addDays(analyticsThrough,-59)&&d.date<=analyticsThrough),extraReady=extra?.length===60;
  const aggregate=(field,previous=false)=>extraReady?extra.slice(previous?0:30,previous?30:60).reduce((n,d)=>n+d[field],0):null;
  const watchHours30d=extraReady?aggregate('minutes')/60:null,previousWatchHours30d=extraReady?aggregate('minutes',true)/60:null;
  const netSubscribers30d=extraReady&&subsReady?subscribersGained30d-aggregate('lost'):null,previousNetSubscribers30d=extraReady&&subsReady?previousSubscribersGained30d-aggregate('lost',true):null;
  const insights=a?.insights?.through===analyticsThrough?a.insights:null;
  return {monthlySummaries:calendarSummaries(a,a?.through),watchHours30d,previousWatchHours30d,watchChangePercent:watchHours30d===null?null:percent(watchHours30d,previousWatchHours30d),netSubscribers30d,previousNetSubscribers30d,topCountries:insights?.countries??null,topVideo:insights?.topVideo??null,insightsThrough:insights?.through??null,key:c.key,name:c.name,order:c.order,channelId:pub.channelId||null,thumbnail:pub.thumbnail||null,subscribers:pub.subscribers??null,totalViews:pub.totalViews??null,publicUpdatedAt:pub.updatedAt||null,analyticsUpdatedAt:a?.updatedAt||null,analyticsStatus:ready?'connected':'connection-required',analyticsThrough:ready?analyticsThrough:null,views30d,previousViews30d,changePercent:ready?percent(views30d,previousViews30d):null,subscribersGained30d,previousSubscribersGained30d,subscriberChangePercent:subsReady?percent(subscribersGained30d,previousSubscribersGained30d):null,dailyViews};
 });
 const views30d=sum(normalized,'views30d'),previousViews30d=sum(normalized,'previousViews30d');
 const publicTimes=normalized.map(c=>c.publicUpdatedAt).filter(Boolean).sort();
 return {schemaVersion:1,updatedAt:publicTimes.at(-1)||null,checkedAt:now.toISOString(),timezone:'Asia/Amman',analyticsTimezone:'America/Los_Angeles',analyticsThrough,
  periods:analyticsThrough?{current:{start:addDays(analyticsThrough,-29),end:analyticsThrough},previous:{start:addDays(analyticsThrough,-59),end:addDays(analyticsThrough,-30)}}:null,
  network:{subscribers:sum(normalized,'subscribers'),totalViews:sum(normalized,'totalViews'),views30d,previousViews30d,changePercent:views30d===null?null:percent(views30d,previousViews30d),analyticsChannels:normalized.filter(c=>c.analyticsStatus==='connected').length},channels:normalized};
}
async function json(response){if(!response.ok)throw new Error('Upstream HTTP '+response.status);const data=await response.json();if(data.error)throw new Error('Upstream rejected request');return data;}
function kvURL(env,key){for(const n of ['CLOUDFLARE_ACCOUNT_ID','ARCHIVE_NAMESPACE_ID'])if(!/^[a-f0-9]{32}$/i.test(env[n]||''))throw new Error('Missing storage configuration');return `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${env.ARCHIVE_NAMESPACE_ID}/values/${encodeURIComponent(key)}`;}
async function readCache(env,key,fetcher){const r=await fetcher(kvURL(env,key),{headers:{Authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`}});if(r.status===404)return {};if(!r.ok)throw new Error('Cache unavailable; refusing to replace previous data');return JSON.parse(gunzipSync(Buffer.from(await r.arrayBuffer())));}
async function writeCache(env,key,data,fetcher){await json(await fetcher(kvURL(env,key),{method:'PUT',headers:{Authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/octet-stream'},body:gzipSync(JSON.stringify(data))}));}
export async function collect(env,publicCache,analyticsCache,fetcher=fetch,now=new Date()){
 const tokens=new Map();
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
  if(cached?.dailyExtended?.length===90&&cached?.monthlyHistory?.length>=90&&cached?.insights?.through===cached.through&&now-new Date(cached.updatedAt)<6*3600000)continue;
  try{
   const token=await json(await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_OAUTH_CLIENT_ID,client_secret:env.GOOGLE_OAUTH_CLIENT_SECRET,refresh_token:refresh,grant_type:'refresh_token'}),signal:AbortSignal.timeout(20000)}));
   tokens.set(c.key,token.access_token);
   const end=lastCompleteDay(now),start=monthStart(end,-12);
   const rows=await paginatedDailyReport(async paging=>json(await fetcher('https://youtubeanalytics.googleapis.com/v2/reports?'+new URLSearchParams({ids:'channel=='+publicCache[c.key].channelId,startDate:start,endDate:end,metrics:'views,subscribersGained,subscribersLost,estimatedMinutesWatched',dimensions:'day',sort:'day',...paging}),{headers:{Authorization:`Bearer ${token.access_token}`},signal:AbortSignal.timeout(30000)})));
   if(!rows.length)throw new Error('Analytics pending');
   if(rows.some(r=>!/^\d{4}-\d{2}-\d{2}$/.test(r[0])||!Number.isSafeInteger(r[1])||r[1]<0||!Number.isSafeInteger(r[2])||r[2]<0||!Number.isSafeInteger(r[3])||r[3]<0||!Number.isFinite(r[4])||r[4]<0||r[0]<start||r[0]>end))throw new Error('Invalid daily report');
   if(new Set(rows.map(r=>r[0])).size!==rows.length||rows.some((r,i)=>i&&r[0]<=rows[i-1][0]))throw new Error('Invalid report ordering');
   const through=rows.at(-1)[0];if(through<addDays(end,-10))throw new Error('Analytics too old');
   analyticsCache[c.key]={through,updatedAt:now.toISOString(),monthlyHistory:calendarHistory(rows,start,through),dailyViews:history(rows,addDays(through,-89),through),dailySubscribers:subscriberHistory(rows,addDays(through,-89),through),dailyExtended:extendedHistory(rows,addDays(through,-89),through),insights:cached?.insights??null};
   console.log(`${c.name}: Analytics connected through ${through}`);
  }catch(error){const reason=/^(Upstream HTTP [0-9]{3}|Upstream rejected request|Invalid report page|Invalid daily report|Invalid report ordering|Analytics pending|Analytics too old|Daily report exceeded bounded history window)$/.test(error.message)?error.message:"Upstream unavailable";console.warn(`${c.name}: ${reason}; cached values retained`);}
 }
 const alignedThrough=normalize(publicCache,analyticsCache,now).analyticsThrough;
 for(const c of channels){const access=tokens.get(c.key),a=analyticsCache[c.key];if(!access||!a||!alignedThrough)continue;
  const report=async(params)=>json(await fetcher('https://youtubeanalytics.googleapis.com/v2/reports?'+new URLSearchParams({ids:'channel=='+publicCache[c.key].channelId,startDate:addDays(alignedThrough,-29),endDate:alignedThrough,...params}),{headers:{Authorization:`Bearer ${access}`},signal:AbortSignal.timeout(30000)}));
  try{
   const countriesReport=await report({metrics:'views',dimensions:'country',sort:'-views',maxResults:'3'});
   const countries=(countriesReport.rows||[]).filter(r=>/^[A-Z]{2}$/.test(r[0])&&Number.isSafeInteger(r[1])&&r[1]>=0).map(r=>({code:r[0],views:r[1]}));
   const videosReport=await report({metrics:'views',dimensions:'video',sort:'-views',maxResults:'1'});
   const row=videosReport.rows?.[0];let topVideo=null;
   if(row&&/^[\w-]{11}$/.test(row[0])&&Number.isSafeInteger(row[1])&&row[1]>=0){
    const meta=await json(await fetcher('https://www.googleapis.com/youtube/v3/videos?'+new URLSearchParams({part:'snippet',id:row[0]}),{headers:{'X-Goog-Api-Key':env.YOUTUBE_API_KEY},signal:AbortSignal.timeout(20000)}));
    const item=meta.items?.find(i=>i.id===row[0]&&i.snippet?.channelId===publicCache[c.key].channelId);
    if(item)topVideo={id:item.id,title:String(item.snippet.title||''),thumbnail:item.snippet.thumbnails?.medium?.url||null,views:row[1]};
   }
   a.insights={through:alignedThrough,countries,topVideo};console.log(`${c.name}: audience and top-video insights connected`);
  }catch{console.warn(`${c.name}: audience insights delayed; previous snapshot retained`);}
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

