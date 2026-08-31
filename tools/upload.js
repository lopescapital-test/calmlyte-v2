/* Build-time helper: receives a browser-encoded image and writes it into
   build/assets. Used only by tools/build-site.js image optimisation. */
const http=require('http'),fs=require('fs'),path=require('path');
const OUT=path.resolve(__dirname,'..','build','assets');
http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','content-type,x-filename');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.method!=='POST'){res.writeHead(405);return res.end();}
  const name=path.basename(String(req.headers['x-filename']||'out.bin'));
  const chunks=[];
  req.on('data',c=>chunks.push(c));
  req.on('end',()=>{
    const buf=Buffer.concat(chunks);
    fs.writeFileSync(path.join(OUT,name),buf);
    console.log('wrote',name,buf.length,'bytes');
    res.writeHead(200,{'Content-Type':'text/plain'});
    res.end(String(buf.length));
  });
}).listen(4174,()=>console.log('upload sink on http://localhost:4174'));
