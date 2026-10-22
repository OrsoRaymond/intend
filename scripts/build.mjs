import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(await readFile(path.join(root,'site.config.json'),'utf8'));
const candidate=process.env.SITE_URL||config.url;
const parsed=new URL(candidate);
if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw new Error('SITE_URL must be a plain HTTP(S) origin.');
const origin=parsed.origin;
for(const [file,route] of [['index.html','/'],['privacy/index.html','/privacy/'],['terms/index.html','/terms/']]){
  const location=path.join(root,'dist',file);
  let html=await readFile(location,'utf8');
  html=html.replace(/\s*<link rel="canonical"[^>]*>/g,'').replace(/\s*<meta property="og:url"[^>]*>/g,'');
  html=html.replace('</head>',`<link rel="canonical" href="${origin}${route}"><meta property="og:url" content="${origin}${route}"></head>`);
  html=html.replace(/<meta property="og:image" content="[^"]*">/g,`<meta property="og:image" content="${origin}/assets/quiet-room.webp">`);
  await writeFile(location,html);
}
await writeFile(path.join(root,'dist','robots.txt'),`User-agent: *\nAllow: /\nDisallow: /app/\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile(path.join(root,'dist','sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/','/privacy/','/terms/'].map(route=>`<url><loc>${origin}${route}</loc></url>`).join('')}</urlset>\n`);
// Version browser assets so existing visitors receive each deployed redesign.
const revisions={};
for(const asset of ['styles.css','app.css','site.js','app.js']){
  const bytes=await readFile(path.join(root,'dist','assets',asset));
  revisions[asset]=createHash('sha256').update(bytes).digest('hex').slice(0,12);
}
for(const file of ['index.html','app/index.html','privacy/index.html','terms/index.html','404.html']){
  const location=path.join(root,'dist',file);
  const html=await readFile(location,'utf8');
  await writeFile(location,html.replace(/(\/(?:assets)\/(styles\.css|app\.css|site\.js|app\.js))(?:\?v=[a-z0-9]+)?/g,(_,url,asset)=>`${url}?v=${revisions[asset]}`));
}
console.log('Static site ready in dist/. No bundler or runtime dependencies.');
