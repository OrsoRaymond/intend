import {readFile,readdir,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
let checks=0;
const check=(condition,message)=>{if(!condition)throw new Error(message);checks++;};
async function files(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){const name=path.join(dir,entry.name);out.push(...(entry.isDirectory()?await files(name):[name]));}return out;}
for(const file of await files(dist)){
  if(!/\.(html|js|css)$/.test(file))continue;
  const source=await readFile(file,'utf8');
  if(file.endsWith('.js')){
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});check(result.status===0,`${file}: ${result.stderr}`);
    check(!/\b(localStorage|sessionStorage|indexedDB|XMLHttpRequest|WebSocket|sendBeacon)\b|\bfetch\s*\(|document\.cookie/.test(source),`${file} contains unexpected storage or network access`);
  }
  if(file.endsWith('.html')){
    check(source.includes('lang="en"'),`${file} missing document language`);
    check(source.includes('name="viewport"'),`${file} missing responsive viewport`);
    check(source.includes('Content-Security-Policy'),`${file} missing CSP`);
    check(!/<script(?![^>]*\bsrc=)[^>]*>\s*[^<]/.test(source),`${file} contains inline scripts`);
    check(!/\son\w+\s*=|\sstyle\s*=/.test(source),`${file} contains inline handlers/styles`);
    const ids=[...source.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);check(new Set(ids).size===ids.length,`${file} contains duplicate IDs`);
    for(const match of source.matchAll(/(?:src|href)="(\/(?!\/)[^"?#]*)[^"]*"/g)){
      const url=match[1];if(!url)continue;const target=path.join(dist,url,url.endsWith('/')?'index.html':'');
      await access(target);checks++;
    }
  }
}
console.log(`${checks} static checks passed: syntax, local links, CSP, and memory-only application boundary.`);
