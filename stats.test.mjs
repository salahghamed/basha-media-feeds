import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
import {channels,percent,lastCompleteDay,history,normalize,collect,addDays,subscriberHistory} from './stats-sync.mjs';
const through='2026-09-30',pub=Object.fromEntries(channels.map((c,i)=>[c.key,{channelId:'UC'+'x'.repeat(22),subscribers:100+i,totalViews:1000+i,updatedAt:'2026-10-01T12:00:00Z'}]));
const analytics=Object.fromEntries(channels.map((c,i)=>[c.key,{through,updatedAt:'2026-10-01T12:00:00Z',dailyViews:history(Array.from({length:90},(_,n)=>[addDays(through,n-89),n>=60?(i+1)*20:(i+1)*10]),addDays(through,-89),through)}]));
test('Subscriber gains compare adjacent periods and old caches remain unavailable',()=>{
 const a=structuredClone(analytics);
 for(const [i,c] of channels.entries())a[c.key].dailySubscribers=subscriberHistory(Array.from({length:90},(_,n)=>[addDays(through,n-89),0,n>=60?(i+1)*4:(i+1)*2]),addDays(through,-89),through);
 const d=normalize(pub,a);assert.equal(d.channels[0].subscribersGained30d,120);assert.equal(d.channels[0].previousSubscribersGained30d,60);assert.equal(d.channels[0].subscriberChangePercent,100);assert.equal(d.channels[4].subscribersGained30d,600);
 a.androidbasha.dailySubscribers=a.androidbasha.dailySubscribers.map(r=>({...r,gained:0}));const zero=normalize(pub,a).channels[0];assert.equal(zero.subscriberChangePercent,null);assert.equal(zero.subscribersGained30d,0);
 assert.equal(normalize(pub,analytics).channels[0].subscribersGained30d,null);
});
test('Five-channel order and summed comparison are stable',()=>{const d=normalize(pub,analytics);assert.deepEqual(d.channels.map(c=>c.name),['Android Basha','Camera Basha','BashaPodcast','HiFi Basha','Gaming Basha']);assert.equal(d.network.subscribers,510);assert.equal(d.network.totalViews,5010);assert.equal(d.network.views30d,9000);assert.equal(d.network.previousViews30d,4500);assert.equal(d.network.changePercent,100);assert.deepEqual(d.periods,{current:{start:'2026-09-01',end:'2026-09-30'},previous:{start:'2026-08-02',end:'2026-08-31'}});});
test('Missing authorization does not invent zero metrics or partial network totals',()=>{const d=normalize(pub,{androidbasha:analytics.androidbasha});assert.equal(d.network.views30d,null);assert.equal(d.channels[4].analyticsStatus,'connection-required');assert.equal(d.channels[4].views30d,null);assert.equal(d.channels.length,5);assert.equal(d.network.subscribers,510);});
test('Network percentage uses summed views, rather than mean channel percentages',()=>{const a=structuredClone(analytics);a.androidbasha.dailyViews=a.androidbasha.dailyViews.map((d,i)=>({...d,views:i>=60?1000:2000}));const d=normalize(pub,a);assert.equal(d.network.changePercent,percent(d.network.views30d,d.network.previousViews30d));assert.notEqual(d.network.changePercent,d.channels.reduce((s,c)=>s+c.changePercent,0)/5);});
test('Analytics cutoff is common across channels; periods contain 30 adjacent days',()=>{const a=structuredClone(analytics);a.gamingbasha.through='2026-09-28';a.gamingbasha.dailyViews=history([['2026-09-28',12]],'2026-07-01','2026-09-28');const d=normalize(pub,a);assert.equal(d.analyticsThrough,'2026-09-28');assert.ok(d.channels.every(c=>c.dailyViews.length===60));assert.equal(d.periods.current.end,'2026-09-28');assert.equal(d.periods.previous.end,'2026-08-29');});
test('Complete days follow Analytics Pacific dates across midnight and leap years',()=>{assert.equal(lastCompleteDay(new Date('2026-10-01T01:00:00Z')),'2026-09-29');assert.equal(lastCompleteDay(new Date('2026-10-01T14:00:00Z')),'2026-09-30');assert.equal(addDays('2024-03-01',-1),'2024-02-29');assert.equal(percent(10,0),null);assert.equal(percent(0,0),null);assert.equal(percent(0,10),-100);});
test('Google failure preserves last successful public and Analytics cache',async()=>{const original=structuredClone(pub),a=structuredClone(analytics);const result=await collect({YOUTUBE_API_KEY:'fake'},original,a,async()=>{throw new Error('offline');});assert.equal(result.publicSuccess,false);assert.deepEqual(result.publicCache,pub);assert.deepEqual(result.analyticsCache,analytics);});
test('Public serialization only includes explicit safe fields',()=>{const p=structuredClone(pub);p.androidbasha.refreshToken='test-secret';p.androidbasha.revenue=900;const d=JSON.stringify(normalize(p,analytics));assert.ok(!d.includes('test-secret'));assert.ok(!d.includes('revenue'));assert.ok(!d.includes('refreshToken'));});
test('Number formatting keeps calculations intact and handles unavailable data',()=>{const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('./format.js',import.meta.url),'utf8'),ctx);for(const [n,expected] of [[999,'999'],[1200,'1.2K'],[87000,'87K'],[2130000,'2.13M'],[487600000,'487.6M'],[1240000000,'1.24B'],[null,'—']])assert.equal(vm.runInContext(`compactNumber(${JSON.stringify(n)})`,ctx),expected);});
test('Watch hours and net growth use aligned periods; mismatched audience reports are withheld',()=>{
 const a=structuredClone(analytics),c=a.androidbasha;
 c.dailySubscribers=c.dailyViews.map((d,i)=>({date:d.date,gained:i>=60?4:2}));
 c.dailyExtended=c.dailyViews.map((d,i)=>({date:d.date,lost:i>=60?5:1,minutes:i>=60?120:60}));
 c.insights={through,countries:[{code:'JO',views:100}],topVideo:{id:'abcdefghijk',title:'Example',views:80}};
 const r=normalize(pub,a).channels[0];assert.equal(r.watchHours30d,60);assert.equal(r.previousWatchHours30d,30);assert.equal(r.watchChangePercent,100);assert.equal(r.netSubscribers30d,-30);assert.equal(r.previousNetSubscribers30d,30);assert.equal(r.topCountries[0].code,'JO');
 c.insights.through='2026-09-29';assert.equal(normalize(pub,a).channels[0].topCountries,null);
 assert.equal(normalize(pub,analytics).channels[0].watchHours30d,null);
});

import {calendarHistory,calendarSummaries,monthStart,monthEnd,paginatedDailyReport} from './stats-sync.mjs';
test('Calendar months use exact dates, leap days and matching completed-month comparisons',()=>{
 const days=calendarHistory([], '2024-01-01','2024-03-10').map(d=>({...d,views:10,gained:2,lost:3,minutes:60}));
 const summaries=calendarSummaries({monthlyHistory:days},'2024-03-10');
 assert.deepEqual(summaries.map(s=>s.month),['2024-03','2024-02','2024-01']);
 assert.equal(summaries[0].complete,false);assert.equal(summaries[0].views,100);assert.equal(summaries[0].comparison,null);
 assert.equal(summaries[1].views,290);assert.equal(summaries[1].watchHours,29);assert.equal(summaries[1].netSubscribers,-29);assert.equal(summaries[1].daysInMonth,29);
 assert.equal(summaries[1].comparison.viewsPercent,percent(290,310));assert.equal(monthEnd('2024-02-01'),'2024-02-29');assert.equal(monthStart('2026-01-15',-12),'2025-01-01');
});
test('Incomplete leading months, missing metrics and duplicate dates are withheld',()=>{
 const days=calendarHistory([['2026-08-31',9,1,2,60]],'2026-08-15','2026-09-20');
 const summaries=calendarSummaries({monthlyHistory:days},'2026-09-20');assert.deepEqual(summaries.map(s=>s.month),['2026-09']);assert.equal(summaries[0].comparison,null);
 assert.deepEqual(calendarSummaries({monthlyHistory:[{date:'2026-09-01',views:2,gained:null,lost:0,minutes:0}]},'2026-09-01'),[]);
 assert.deepEqual(calendarSummaries({monthlyHistory:[days[0],days[0]]},'2026-09-20'),[]);
 const missing=days.filter(d=>d.date!=='2026-09-10');assert.deepEqual(calendarSummaries({monthlyHistory:missing},'2026-09-20'),[]);
});
test('Monthly comparisons never divide by zero, and old daily caches can supply covered months',()=>{
 const days=calendarHistory([['2026-09-01',5,2,0,120]],'2026-08-01','2026-09-30');
 const result=calendarSummaries({monthlyHistory:days},'2026-09-30');assert.equal(result[0].comparison.viewsPercent,null);
 const cache={dailyViews:days.map(d=>({date:d.date,views:d.views})),dailySubscribers:days.map(d=>({date:d.date,gained:d.gained})),dailyExtended:days.map(d=>({date:d.date,lost:d.lost,minutes:d.minutes}))};
 assert.deepEqual(calendarSummaries(cache,'2026-09-30'),result);
});
test('Daily report requests the whole bounded history rather than truncating at 200 days',async()=>{
 const requests=[];const result=await paginatedDailyReport(async p=>{requests.push(p);return {rows:Array.from({length:367},(_,i)=>[i])};});
 assert.equal(result.length,367);assert.deepEqual(requests,[{maxResults:'500'}]);
 await assert.rejects(paginatedDailyReport(async()=>({rows:Array.from({length:401},()=>[])})),/bounded/);
});

test('A delayed channel cannot freeze calendar-month summaries for current channels',()=>{
 const pub={},cache={};for(const c of channels){const through=c.key==='androidbasha'?'2026-09-28':'2026-10-02',start=addDays(through,-89);const ds=calendarHistory([['2026-09-01',100,5,1,120]],start,through);pub[c.key]={subscribers:1,totalViews:100,updatedAt:'2026-10-03T00:00:00Z'};cache[c.key]={through,monthlyHistory:ds,dailyViews:ds.map(d=>({date:d.date,views:d.views})),dailySubscribers:ds.map(d=>({date:d.date,gained:d.gained})),dailyExtended:ds.map(d=>({date:d.date,lost:d.lost,minutes:d.minutes}))};}
 const out=normalize(pub,cache);assert.equal(out.analyticsThrough,'2026-09-28');assert.equal(out.channels[0].monthlySummaries[0].end,'2026-09-28');assert.equal(out.channels[1].monthlySummaries[0].month,'2026-10');assert.equal(out.channels[1].monthlySummaries[1].complete,true);
});

import {contentFormatHistory,contentFormatWindow,contentFormatRows} from './stats-sync.mjs';
test('Format classification keeps regular videos, Shorts and livestreams distinct',()=>{
 const split=contentFormatHistory([['2026-09-01','VIDEO_ON_DEMAND',50],['2026-09-01','SHORTS',30],['2026-09-01','LIVE_STREAM',10],['2026-09-01','UNSPECIFIED',5],['2026-09-01','STORY',5]],[{date:'2026-09-01',views:100}]);
 assert.deepEqual(split,[{date:'2026-09-01',regular:50,shorts:30,other:20}]);
 assert.deepEqual(contentFormatWindow({contentFormatHistory:split},'2026-09-01','2026-09-01'),{regular:50,shorts:30,other:20});
 assert.deepEqual(contentFormatRows({columnHeaders:[{name:'creatorContentType'},{name:'day'},{name:'views'}],rows:[['SHORTS','2026-09-01',30]]}),[['2026-09-01','SHORTS',30]]);
 assert.deepEqual(contentFormatHistory([['2026-09-01','videoOnDemand',50],['2026-09-01','shorts',30],['2026-09-01','liveStream',20]],[{date:'2026-09-01',views:100}]),split);
});
test('Unreconciled or missing breakdowns remain unavailable instead of invented zero',()=>{
 const totals=[{date:'2026-09-01',views:100},{date:'2026-09-02',views:0}],split=contentFormatHistory([['2026-09-01','SHORTS',50]],totals);
 assert.deepEqual(split[0],{date:'2026-09-01',regular:null,shorts:null,other:null});assert.equal(split[1].regular,0);
 assert.equal(contentFormatWindow({contentFormatHistory:split},'2026-09-01','2026-09-02'),null);
 assert.equal(contentFormatWindow({},'2026-09-01','2026-09-02'),null);
 assert.equal(contentFormatWindow({contentFormatHistory:[split[1],split[1]]},'2026-09-01','2026-09-02'),null);
 assert.throws(()=>contentFormatHistory([['2026-09-01','UNKNOWN',100]],totals));
 assert.throws(()=>contentFormatHistory([['2026-09-01','SHORTS',50],['2026-09-01','SHORTS',50]],totals));
});
test('Format totals reconcile for aligned rolling and calendar-month windows',()=>{
 const a=structuredClone(analytics);
 for(const c of channels){a[c.key].contentFormatHistory=a[c.key].dailyViews.map(d=>({date:d.date,regular:d.views*.6,shorts:d.views*.3,other:d.views*.1}));a[c.key].monthlyHistory=a[c.key].dailyViews.map(d=>({...d,gained:0,lost:0,minutes:0}));}
 const data=normalize(pub,a),channel=data.channels[0];
 assert.deepEqual(channel.viewsByFormat30d,{regular:360,shorts:180,other:60});
 assert.equal(channel.dailyViewsByFormat.length,60);assert.equal(channel.monthlySummaries[0].viewsByFormat.regular,360);
 delete a.androidbasha.contentFormatHistory;
 const delayed=normalize(pub,a);assert.equal(delayed.channels[0].viewsByFormat30d,null);assert.equal(delayed.channels[0].dailyViewsByFormat.length,0);assert.ok(delayed.channels[1].viewsByFormat30d);
 assert.equal(delayed.network.views30d,data.network.views30d);
});
test('Format collection queries official content types and preserves totals on format failure',async()=>{
 const now=new Date('2026-10-01T14:00:00Z'),end=lastCompleteDay(now),start=monthStart(end,-12),days=calendarHistory([],start,end).map(d=>({...d,views:10}));
 const env={YOUTUBE_API_KEY:'fake',GOOGLE_OAUTH_CLIENT_ID:'fake',GOOGLE_OAUTH_CLIENT_SECRET:'fake',ANDROID_BASHA_REFRESH_TOKEN:'fake'},queries=[];
 const fetcher=async url=>{
  if(url.includes('/token'))return Response.json({access_token:'fake'});
  if(url.includes('/v3/channels'))return Response.json({items:[]});
  const q=new URL(url).searchParams;queries.push(q);
  if(q.get('dimensions')==='day')return Response.json({rows:days.map(d=>[d.date,10,0,0,0])});
  if(q.get('dimensions')==='day,creatorContentType')return Response.json({columnHeaders:[{name:'creatorContentType'},{name:'day'},{name:'views'}],rows:days.flatMap(d=>[['videoOnDemand',d.date,7],['shorts',d.date,3]])});
  return Response.json({rows:[]});
 };
 const result=await collect(env,structuredClone(pub),{},fetcher,now);
 assert.deepEqual(result.data.channels[0].viewsByFormat30d,{regular:210,shorts:90,other:0});
 assert.equal(queries.find(q=>q.get('dimensions')==='day,creatorContentType').get('maxResults'),'2500');
 const retained=await collect(env,structuredClone(pub),result.analyticsCache,async(url,opts)=>url.includes('creatorContentType')?Response.json({}, {status:503}):fetcher(url,opts),new Date('2026-10-02T14:00:00Z'));
 assert.equal(retained.data.channels[0].views30d,300);assert.deepEqual(retained.data.channels[0].viewsByFormat30d,{regular:210,shorts:90,other:0});
});
