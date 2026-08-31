/* Serves the approved artboards against their own support.js runtime, for
   reference comparison only. Read-only; not part of the build. */
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..','Calmlyte Approved Site');
const T={'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.png':'image/png'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  const f=path.join(ROOT,p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end('404');}
  res.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
}).listen(4175,()=>console.log('approved artboards on http://localhost:4175'));
