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
test('Daily history paginates and rejects a response beyond the bounded history window',async()=>{
 const indexes=[];const result=await paginatedDailyReport(async p=>{indexes.push(p.startIndex);return {rows:Array.from({length:p.startIndex==='1'?200:17},(_,i)=>[i])};});
 assert.equal(result.length,217);assert.deepEqual(indexes,['1','201']);
 await assert.rejects(paginatedDailyReport(async()=>({rows:Array.from({length:200},()=>[])})),/bounded/);
});
