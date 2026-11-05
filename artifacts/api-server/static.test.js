// Same-origin web serving + /api prefix + storage selection. Run: node --test artifacts/api-server/static.test.js
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

function freePort(){ return new Promise(r=>{ const s=net.createServer().listen(0,()=>{ const p=s.address().port; s.close(()=>r(p)); }); }); }
function call(port, method, p, { cookie, csrf, body, headers: extra } = {}){
  return new Promise((resolve,reject)=>{
    const headers = Object.assign({}, extra);
    if(body!==undefined) headers['Content-Type']='application/json';
    if(cookie) headers.Cookie = cookie; if(csrf) headers['X-CSRF-Token'] = csrf;
    const req = http.request({host:'127.0.0.1',port,path:p,method,headers}, res=>{
      let t=''; res.on('data',c=>t+=c); res.on('end',()=>{ let j=null; try{ j=JSON.parse(t); }catch{} resolve({status:res.statusCode,headers:res.headers,json:j,text:t}); });
    });
    req.on('error',reject);
    if(body!==undefined) req.write(JSON.stringify(body));
    req.end();
  });
}
let S, dir;
before(async()=>{
  dir = fs.mkdtempSync(path.join(os.tmpdir(),'gosie-web-'));
  fs.mkdirSync(path.join(dir,'web','assets'),{recursive:true});
  fs.writeFileSync(path.join(dir,'web','index.html'),'<!doctype html><title>Gosie</title>');
  fs.writeFileSync(path.join(dir,'web','assets','app-abc.js'),'console.log(1)');
  fs.writeFileSync(path.join(dir,'secret.txt'),'TOP SECRET');
  const port = await freePort();
  const child = spawn(process.execPath,[path.join(__dirname,'server.js')],{env:Object.assign({},process.env,{PORT:String(port),STORAGE:'memory',STATIC_DIR:path.join(dir,'web'),AUTH_RATE_LIMIT:'1000'}),stdio:['ignore','pipe','pipe']});
  let out=''; child.stdout.on('data',d=>out+=d); child.stderr.on('data',d=>out+=d);
  for(let i=0;i<50;i++){ try{ await call(port,'GET','/health'); break; }catch{ await new Promise(r=>setTimeout(r,100)); } }
  S = { port, child, logs:()=>out };
});
after(()=>{ S.child.kill(); });

test('serves index.html at / and falls back to it for client routes', async()=>{
  const a = await call(S.port,'GET','/');
  assert.strictEqual(a.status,200); assert.match(a.headers['content-type'],/text\/html/); assert.match(a.text,/Gosie/);
  assert.strictEqual(a.headers['cache-control'],'no-cache');
  const b = await call(S.port,'GET','/some/client/route');
  assert.strictEqual(b.status,200); assert.match(b.text,/Gosie/);
});

test('hashed assets are cacheable; missing assets 404 instead of returning HTML', async()=>{
  const a = await call(S.port,'GET','/assets/app-abc.js');
  assert.strictEqual(a.status,200); assert.match(a.headers['content-type'],/javascript/); assert.match(a.headers['cache-control'],/immutable/);
  assert.strictEqual(a.headers['x-content-type-options'],'nosniff');
  assert.strictEqual((await call(S.port,'GET','/assets/missing.js')).status,404);
});

test('static serving cannot escape STATIC_DIR', async()=>{
  for(const p of ['/..%2fsecret.txt','/%2e%2e/secret.txt','/..%5csecret.txt','/assets/..%2f..%2fsecret.txt']){
    const r = await call(S.port,'GET',p);
    assert.doesNotMatch(r.text,/TOP SECRET/, p);
  }
  assert.strictEqual((await call(S.port,'GET','/%00')).status,400);
  assert.strictEqual((await call(S.port,'GET','/%E0%A4%A')).status,400);
});

test('static paths only allow GET/HEAD', async()=>{
  assert.strictEqual((await call(S.port,'POST','/',{body:{}})).status,405);
  assert.strictEqual((await call(S.port,'HEAD','/')).status,200);
});

test('API lives under /api; legacy paths are the web app when web is served', async()=>{
  assert.strictEqual((await call(S.port,'GET','/api/health')).json.ok,true);
  assert.strictEqual((await call(S.port,'GET','/health')).json.ok,true);
  assert.strictEqual((await call(S.port,'GET','/api/me')).status,401);
  assert.match((await call(S.port,'GET','/profiles')).headers['content-type'],/text\/html/);
});

test('register, login, /me, profile, logout work through /api with cookie + csrf', async()=>{
  const cred={email:'web@example.com',password:'password-123'};
  assert.strictEqual((await call(S.port,'POST','/api/auth/register',{body:cred})).status,201);
  const l = await call(S.port,'POST','/api/auth/login',{body:cred,headers:{Origin:'http://127.0.0.1:'+S.port}});
  assert.strictEqual(l.status,200);
  const cookie = l.headers['set-cookie'][0].split(';')[0];
  const me = await call(S.port,'GET','/api/me',{cookie});
  assert.strictEqual(me.json.email,'web@example.com'); assert.strictEqual(me.json.csrf_token,l.json.csrf_token);
  const demo = await call(S.port,'GET','/api/demo-profiles',{cookie});
  const cfg = demo.json.profiles[0].config;
  const c = await call(S.port,'POST','/api/profiles',{cookie,csrf:me.json.csrf_token,body:{title:'Mine',config:cfg}});
  assert.strictEqual(c.status,201);
  assert.strictEqual((await call(S.port,'GET','/api/profiles',{cookie})).json.profiles.length,1);
  const out = await call(S.port,'POST','/api/auth/logout',{cookie,csrf:me.json.csrf_token,body:{}});
  assert.strictEqual(out.status,200); assert.match(out.headers['set-cookie'][0],/Max-Age=0/);
  assert.strictEqual((await call(S.port,'GET','/api/me',{cookie})).status,401);
});

test('storage backend is reported at startup and /api/me never works without a session', async()=>{
  assert.match(S.logs(),/"storage":"memory"/); assert.match(S.logs(),/"web":true/);
});

test('unreachable DATABASE_URL fails fast at startup instead of serving', async()=>{
  const port = await freePort();
  const code = await new Promise(r=>{ const c=spawn(process.execPath,[path.join(__dirname,'server.js')],{env:Object.assign({},process.env,{PORT:String(port),DATABASE_URL:'postgres://u:p@127.0.0.1:1/none'}),stdio:'ignore'}); c.on('exit',r); });
  assert.strictEqual(code,1);
});
