// Hardening regression tests. Run: node --test artifacts/api-server/hardening.test.js
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

function freePort(){ return new Promise(r=>{ const s=net.createServer().listen(0,()=>{ const p=s.address().port; s.close(()=>r(p)); }); }); }
function call(port, method, p, { cookie, csrf, body, raw, headers: extra } = {}){
  return new Promise((resolve,reject)=>{
    const headers = Object.assign({'Content-Type':'application/json'}, extra);
    if(cookie) headers.Cookie = cookie; if(csrf) headers['X-CSRF-Token'] = csrf;
    const req = http.request({host:'127.0.0.1',port,path:p,method,headers}, res=>{
      let t=''; res.on('data',c=>t+=c); res.on('end',()=>{ let j=null; try{ j=JSON.parse(t); }catch{} resolve({status:res.statusCode,headers:res.headers,json:j,text:t}); });
    });
    req.on('error',reject);
    if(raw!==undefined) req.write(raw); else if(body!==undefined) req.write(JSON.stringify(body));
    req.end();
  });
}
async function start(env={}){
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'gosie-api-'));
  const child = spawn(process.execPath, [path.join(__dirname,'server.js')], { env: Object.assign({}, process.env, {PORT:String(port), DB_PATH:path.join(dir,'t.db'), AUTH_RATE_LIMIT:'1000', STATIC_DIR:path.join(dir,'no-web')}, env), stdio:['ignore','pipe','pipe'] });
  let out=''; child.stdout.on('data',d=>out+=d); child.stderr.on('data',d=>out+=d);
  for(let i=0;i<50;i++){ try{ await call(port,'GET','/health'); break; }catch{ await new Promise(r=>setTimeout(r,100)); } }
  return { port, child, logs:()=>out, dir };
}
async function login(port, email='User@Example.com'){
  await call(port,'POST','/auth/register',{body:{email,password:'password-123'}});
  const r = await call(port,'POST','/auth/login',{body:{email:email.toLowerCase(),password:'password-123'}});
  return { cookie:r.headers['set-cookie'][0].split(';')[0], csrf:r.json.csrf_token, res:r };
}
const goodCfg = () => ({schemaVersion:'1.0.0-draft', weekGrouping:'category', budgetPerActivity:50, budgetHard:false, maxTravelMinutes:30, exceptionTravelMinutes:60, allowExceptions:true, transportModes:['walking'], weekendInterests:[], customInterests:[]});

let S;
before(async()=>{ S = await start(); });
after(()=>{ S.child.kill(); });

test('security headers on every response', async()=>{
  const r = await call(S.port,'GET','/health');
  assert.strictEqual(r.headers['x-content-type-options'],'nosniff');
  assert.strictEqual(r.headers['cache-control'],'no-store');
  assert.strictEqual(r.headers['x-frame-options'],'DENY');
});

test('malformed percent-encoding in URL does not crash the server', async()=>{
  const u = await login(S.port,'enc@example.com');
  const r = await call(S.port,'GET','/profiles/%E0%A4%A',{cookie:u.cookie,csrf:u.csrf});
  assert.strictEqual(r.status,400);
  assert.strictEqual((await call(S.port,'GET','/health')).status,200);
});

test('invalid JSON shapes are rejected, not crashed', async()=>{
  assert.strictEqual((await call(S.port,'POST','/auth/login',{raw:'null'})).status,400);
  assert.strictEqual((await call(S.port,'POST','/auth/login',{raw:'[1]'})).status,400);
  assert.strictEqual((await call(S.port,'POST','/auth/login',{raw:'{bad'})).status,400);
});

test('oversize body returns 413', async()=>{
  const r = await call(S.port,'POST','/auth/login',{raw:JSON.stringify({email:'a@b.c',password:'x'.repeat(70000)})});
  assert.strictEqual(r.status,413);
});

test('email is normalized: case variants cannot register twice; login is case-insensitive', async()=>{
  const a = await call(S.port,'POST','/auth/register',{body:{email:'Case@Example.com',password:'password-123'}});
  const b = await call(S.port,'POST','/auth/register',{body:{email:' case@example.COM ',password:'password-123'}});
  assert.strictEqual(a.status,201); assert.strictEqual(b.status,409);
  assert.strictEqual((await call(S.port,'POST','/auth/login',{body:{email:'CASE@example.com',password:'password-123'}})).status,200);
});

test('registration validates email and password bounds', async()=>{
  assert.strictEqual((await call(S.port,'POST','/auth/register',{body:{email:'not-an-email',password:'password-123'}})).status,400);
  assert.strictEqual((await call(S.port,'POST','/auth/register',{body:{email:'a@b.co',password:'x'.repeat(201)}})).status,400);
});

test('malformed config cannot be stored and cannot crash /weekend', async()=>{
  const u = await login(S.port,'cfg@example.com');
  const bad = Object.assign(goodCfg(),{transportModes:'walking'});
  assert.strictEqual((await call(S.port,'POST','/profiles',{...u,body:{title:'x',config:bad}})).status,400);
  assert.strictEqual((await call(S.port,'POST','/profiles',{...u,body:{title:'x',config:Object.assign(goodCfg(),{maxTravelMinutes:'far'})}})).status,400);
  assert.strictEqual((await call(S.port,'POST','/profiles',{...u,body:{title:{a:1},config:goodCfg()}})).status,400);
  assert.strictEqual((await call(S.port,'POST','/profiles/import',{...u,body:{config:5}})).status,400);
  // A legacy import missing optional fields must still produce a working weekend view.
  const imp = await call(S.port,'POST','/profiles/import',{...u,body:{title:'legacy',config:{balance:'balanced'}}});
  assert.strictEqual(imp.status,201);
  const wk = await call(S.port,'GET',`/weekend?profile_id=${imp.json.id}`,{cookie:u.cookie});
  assert.strictEqual(wk.status,200);
});

test('feedback validation', async()=>{
  const u = await login(S.port,'fb@example.com');
  const p = await call(S.port,'POST','/profiles',{...u,body:{title:'p',config:goodCfg()}});
  const post = body => call(S.port,'POST','/feedback',{...u,body});
  assert.strictEqual((await post({profile_id:p.json.id,item_id:'e1',action:'rating',rating:9})).status,400);
  assert.strictEqual((await post({profile_id:p.json.id,item_id:'e1',action:'explode'})).status,400);
  assert.strictEqual((await post({profile_id:p.json.id,item_id:'x'.repeat(101),action:'saved'})).status,400);
  assert.strictEqual((await post({profile_id:{x:1},item_id:'e1',action:'saved'})).status,404);
  assert.strictEqual((await post({profile_id:p.json.id,item_id:'e1',action:'saved'})).status,201);
});

test('per-user profile cap', async()=>{
  const u = await login(S.port,'cap@example.com');
  let last;
  for(let i=0;i<51;i++) last = await call(S.port,'POST','/profiles',{...u,body:{title:'p'+i,config:goodCfg()}});
  assert.strictEqual(last.status,409);
});

test('login rate limit returns 429', async()=>{
  const R = await start({AUTH_RATE_LIMIT:'3'});
  try{
    const codes=[]; for(let i=0;i<5;i++) codes.push((await call(R.port,'POST','/auth/login',{body:{email:'a@b.co',password:'wrong-pass-1'}})).status);
    assert.deepStrictEqual(codes,[401,401,401,429,429]);
  } finally { R.child.kill(); }
});

test('TRUST_PROXY keys the limiter by X-Forwarded-For', async()=>{
  const R = await start({AUTH_RATE_LIMIT:'1', TRUST_PROXY:'1'});
  try{
    const hit = ip => new Promise((res,rej)=>{ const q=http.request({host:'127.0.0.1',port:R.port,path:'/auth/login',method:'POST',headers:{'X-Forwarded-For':ip,'Content-Type':'application/json'}},r=>{ r.resume(); r.on('end',()=>res(r.statusCode)); }); q.on('error',rej); q.end('{"email":"a@b.co","password":"wrong-pass-1"}'); });
    assert.strictEqual(await hit('1.1.1.1'),401);
    assert.strictEqual(await hit('2.2.2.2'),401);
    assert.strictEqual(await hit('1.1.1.1'),429);
  } finally { R.child.kill(); }
});

test('Secure cookie when COOKIE_SECURE=1', async()=>{
  const R = await start({COOKIE_SECURE:'1'});
  try{ const u = await login(R.port,'sec@example.com'); assert.match(u.res.headers['set-cookie'][0], /; Secure/); assert.match(u.res.headers['set-cookie'][0], /HttpOnly/); }
  finally { R.child.kill(); }
});

test('invalid PORT fails fast', async()=>{
  const code = await new Promise(r=>{ const c=spawn(process.execPath,[path.join(__dirname,'server.js')],{env:Object.assign({},process.env,{PORT:'abc',DB_PATH:path.join(os.tmpdir(),'gosie-badport.db')}),stdio:'ignore'}); c.on('exit',r); });
  assert.strictEqual(code,1);
});

test('requests are logged as JSON without bodies or secrets', async()=>{
  await call(S.port,'POST','/auth/login',{body:{email:'log@example.com',password:'super-secret-pw'}});
  await new Promise(r=>setTimeout(r,100));
  assert.match(S.logs(), /"path":"\/auth\/login"/);
  assert.doesNotMatch(S.logs(), /super-secret-pw/);
});

test('login CSRF: cross-origin and non-JSON state-changing requests are rejected', async()=>{
  const body={email:'csrf@example.com',password:'password-123'};
  await call(S.port,'POST','/auth/register',{body});
  const evil = await call(S.port,'POST','/auth/login',{body,headers:{Origin:'https://evil.example'}});
  assert.strictEqual(evil.status,403); assert.strictEqual(evil.json.error,'origin_not_allowed');
  const nul = await call(S.port,'POST','/auth/login',{body,headers:{Origin:'null'}});
  assert.strictEqual(nul.status,403);
  const form = await call(S.port,'POST','/auth/login',{raw:'email=a&password=b',headers:{'Content-Type':'application/x-www-form-urlencoded'}});
  assert.strictEqual(form.status,415);
  const same = await call(S.port,'POST','/auth/login',{body,headers:{Origin:'http://127.0.0.1:'+S.port}});
  assert.strictEqual(same.status,200);
  assert.ok(!evil.headers['set-cookie']);
});

test('ALLOWED_ORIGINS permits a configured origin only', async()=>{
  const R = await start({ALLOWED_ORIGINS:'https://app.example.com'});
  try{
    const body={email:'ao@example.com',password:'password-123'};
    await call(R.port,'POST','/auth/register',{body});
    assert.strictEqual((await call(R.port,'POST','/auth/login',{body,headers:{Origin:'https://app.example.com'}})).status,200);
    assert.strictEqual((await call(R.port,'POST','/auth/login',{body,headers:{Origin:'https://other.example'}})).status,403);
  } finally { R.child.kill(); }
});

test('SIGTERM shuts down cleanly (non-Windows)', { skip: process.platform==='win32' }, async()=>{
  const R = await start();
  const code = await new Promise(r=>{ R.child.on('exit',r); R.child.kill('SIGTERM'); });
  assert.strictEqual(code,0);
});
