import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2','.mp3':'audio/mpeg','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.json':'application/json; charset=utf-8'};
const csp="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
const headers={'Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()'};
export const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{...headers,'Allow':'GET, HEAD'});return res.end();}
  try{
    const url=new URL(req.url,'http://localhost');
    const decoded=decodeURIComponent(url.pathname);
    if(decoded.includes('\0'))throw new Error('Invalid path');
    let file=path.resolve(root,`.${decoded}`);
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403,headers);return res.end();}
    let status=200;
    try{
      const info=await stat(file);
      if(info.isDirectory()){
        if(!url.pathname.endsWith('/')){res.writeHead(308,{...headers,Location:url.pathname+'/'});return res.end();}
        file=path.join(file,'index.html');
      }
      await stat(file);
    }catch{file=path.join(root,'404.html');status=404;}
    const buffer=await readFile(file);
    res.writeHead(status,{...headers,'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':path.extname(file)==='.html'?'no-store':'public, max-age=3600'});
    res.end(req.method==='HEAD'?undefined:buffer);
  }catch{res.writeHead(400,headers);res.end('Invalid request.');}
});
server.listen(port,'0.0.0.0',()=>process.stdout.write(`Intend available on port ${port}\n`));
