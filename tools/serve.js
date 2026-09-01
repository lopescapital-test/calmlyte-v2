const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..','build');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  if(p==='/')p='/index.html';
  const f=path.join(ROOT,p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end('404 '+p);}
  res.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
}).listen(4173,()=>console.log('serving build/ on http://localhost:4173'));
