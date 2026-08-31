/* Build-time helper: receives a browser-encoded image and writes it to the path
   given in x-outpath (repo-relative). Used only for generating WebP derivatives
   of approved source imagery. */
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','content-type,x-outpath');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.method!=='POST'){res.writeHead(405);return res.end();}
  const rel=String(req.headers['x-outpath']||'');
  const out=path.resolve(ROOT,rel);
  if(!out.startsWith(ROOT)){res.writeHead(400);return res.end('bad path');}
  const chunks=[];req.on('data',c=>chunks.push(c));
  req.on('end',()=>{
    const buf=Buffer.concat(chunks);
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,buf);
    console.log('wrote',rel,buf.length);
    res.writeHead(200,{'Content-Type':'text/plain'});res.end(String(buf.length));
  });
}).listen(4174,()=>console.log('upload sink on 4174'));
