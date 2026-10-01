import {gzipSync} from 'node:zlib';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dir=path.dirname(fileURLToPath(import.meta.url));
export function pack(data){return gzipSync(JSON.stringify(data),{level:9});}
export async function publish(key,data,env=process.env,fetcher=fetch){
 const {CLOUDFLARE_ACCOUNT_ID:account,ARCHIVE_NAMESPACE_ID:namespace,CLOUDFLARE_API_TOKEN:token}=env;
 if(!account||!namespace||!token)throw new Error('Missing private publishing credentials or storage IDs');
 if(!/^[a-f0-9]{32}$/i.test(account)||!/^[a-f0-9]{32}$/i.test(namespace))throw new Error('Invalid Cloudflare account or namespace ID');
 const payload=pack(data);if(payload.length>25*1024*1024)throw new Error('Compressed feed exceeds KV value limit');
 const response=await fetcher(`https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${namespace}/values/${encodeURIComponent(key)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream'},body:payload});
 let result;try{result=await response.json();}catch{throw new Error('Publishing returned an invalid response');}
 if(!response.ok||!result.success)throw new Error(`Feed publishing failed (${response.status})`);
 console.log(`Published ${key}: ${payload.length} compressed bytes`);
}
async function run(target){
 if(!process.env.YOUTUBE_API_KEY)throw new Error('Missing private YouTube API key');
 let data,key;
 if(target==='android'){
  const {syncYouTube}=await import('./android/youtube.mjs'),{buildGraph}=await import('./android/graph.mjs');
  const overrides=JSON.parse(await fs.readFile(path.join(dir,'android/overrides.json'),'utf8'));
  data=buildGraph(await syncYouTube(process.env),overrides);if(!data.stats.videos)throw new Error('Empty Android feed; retaining previous cache');key='android:graph:gzip';
 }else if(target==='camera'){
  const {syncYouTube,normalizeCatalog}=await import('./camera/catalog.mjs');
  const overrides=JSON.parse(await fs.readFile(path.join(dir,'camera/overrides.json'),'utf8'));
  data=normalizeCatalog(await syncYouTube({...process.env,YOUTUBE_CHANNEL_ID:'UCSg5-KvujMNs7nOj4WgLt3g'}),overrides);if(!data.videos.length)throw new Error('Empty Camera feed; retaining previous cache');key='camera:catalog:gzip';
 }else if(target==='podcast'){
  const env={...process.env};if(!env.YOUTUBE_FULL_EPISODES_PLAYLIST_ID){delete env.YOUTUBE_API_KEY;console.log('Podcast audio RSS refresh only; dedicated full-episodes playlist still needs configuration');}
  execFileSync('python',['podcast/scripts/sync.py'],{cwd:dir,env,stdio:'inherit'});
  data=JSON.parse(await fs.readFile(path.join(dir,'podcast/episodes.json'),'utf8'));if(!data.episodes.length)throw new Error('Empty podcast feed; retaining previous cache');key='podcast:episodes:gzip';
 }else throw new Error('Unknown channel');
 await publish(key,data);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run(process.argv[2]).catch(error=>{const message=String(error.message||'');const safe=/^(YouTube [a-zA-Z]+ failed: \d{3}|YouTube sync failed \(\d{3}\)|Feed publishing failed \(\d{3}\)|Missing private publishing credentials or storage IDs|Invalid Cloudflare account or namespace ID|Android Basha channel unavailable|Channel unavailable)$/.test(message)?message:'Unexpected sync error';console.error(safe+'. Previous published feed remains available.');process.exitCode=1;});
