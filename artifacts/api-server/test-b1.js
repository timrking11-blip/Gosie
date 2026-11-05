const http = require('http');
const { DatabaseSync } = require('node:sqlite');
const BASE_PORT = Number(process.env.PORT) || 8791;
const DB = process.env.DB_PATH;
function call(method, path, cookie, csrf, body, noCsrf=false){
  return new Promise((resolve,reject)=>{
    const headers={'Content-Type':'application/json'};
    if(cookie) headers.Cookie=cookie;
    if(csrf && !noCsrf) headers['X-CSRF-Token']=csrf;
    const req=http.request({host:'localhost',port:BASE_PORT,path,method,headers}, res=>{
      let t=''; res.on('data',c=>t+=c); res.on('end',()=>{ let j=null; try{j=JSON.parse(t);}catch{} resolve({status:res.statusCode, headers:res.headers, json:j, text:t}); });
    });
    req.on('error',reject); if(body) req.write(JSON.stringify(body)); req.end();
  });
}
function cookieOf(res){ const sc=res.headers['set-cookie']; if(!sc) return null; return sc[0].split(';')[0]; }
function dbState(){ const db=new DatabaseSync(DB); const s={users:db.prepare('SELECT COUNT(*) c FROM users').get().c, profiles:db.prepare('SELECT COUNT(*) c FROM profiles').get().c, demo:db.prepare('SELECT COUNT(*) c FROM profiles WHERE is_demo=1').get().c, feedback:db.prepare('SELECT COUNT(*) c FROM feedback').get().c, sessions:db.prepare('SELECT COUNT(*) c FROM sessions').get().c}; db.close(); return s; }
function cfgHash(id){ const db=new DatabaseSync(DB); const r=db.prepare('SELECT config FROM profiles WHERE id=?').get(id); db.close(); if(!r) return null; return require('crypto').createHash('sha256').update(r.config).digest('hex').slice(0,16); }
(async()=>{
  const R=[]; const check=(id,cond,detail)=>{ R.push({id,pass:!!cond,detail}); console.log(`${cond?'PASS':'FAIL'} ${id} — ${detail}`); };
  const before=dbState(); console.log('DB before:', JSON.stringify(before));
  await call('POST','/auth/register',null,null,{email:'test-a@b1.local',password:'TestPass-A-123'});
  await call('POST','/auth/register',null,null,{email:'test-b@b1.local',password:'TestPass-B-123'});
  const la=await call('POST','/auth/login',null,null,{email:'test-a@b1.local',password:'TestPass-A-123'});
  const lb=await call('POST','/auth/login',null,null,{email:'test-b@b1.local',password:'TestPass-B-123'});
  const A={cookie:cookieOf(la), csrf:la.json.csrf_token, id:la.json.user_id};
  const B={cookie:cookieOf(lb), csrf:lb.json.csrf_token, id:lb.json.user_id};
  check('setup-login', la.status===200 && lb.status===200 && A.cookie && B.cookie, `A login ${la.status}, B login ${lb.status}`);
  // A creates profile
  const cfg={schemaVersion:'1.0.0-draft', balance:'professional', weekGrouping:'company', budgetPerActivity:60, budgetHard:false, maxTravelMinutes:30, exceptionTravelMinutes:60, allowExceptions:true, transportModes:['transit'], homeBase:'Downtown (demo)', weekendInterests:[], customInterests:[], socialContexts:[], surpriseMe:false, customSections:[]};
  const created=await call('POST','/profiles',A.cookie,A.csrf,{title:'A profile', config:cfg});
  const aPid=created.json?.id; check('a-create', created.status===201 && aPid, `status ${created.status} id ${aPid}`);
  const hashBefore=cfgHash(aPid);
  // B1-1 read isolation
  const bRead=await call('GET',`/profiles/${aPid}`,B.cookie,B.csrf);
  const bList=await call('GET','/profiles',B.cookie,B.csrf);
  check('B1-1-read-isolation', bRead.status===404 && !JSON.stringify(bList.json).includes(aPid), `B read A=${bRead.status}, B list contains A? ${JSON.stringify(bList.json).includes(aPid)}`);
  // B1-2 write isolation + hash unchanged
  const bPut=await call('PUT',`/profiles/${aPid}`,B.cookie,B.csrf,{title:'Hacked', config:cfg});
  const bDel=await call('DELETE',`/profiles/${aPid}`,B.cookie,B.csrf);
  const hashAfter=cfgHash(aPid);
  check('B1-2-write-isolation', bPut.status===404 && bDel.status===404 && hashBefore===hashAfter, `PUT ${bPut.status} DEL ${bDel.status} hash ${hashBefore}->${hashAfter}`);
  // B1-3 feedback isolation
  const fa=await call('POST','/feedback',A.cookie,A.csrf,{profile_id:aPid,item_id:'e11',action:'saved',rating:5});
  // B needs own profile for its feedback
  const bCreated=await call('POST','/profiles',B.cookie,B.csrf,{title:'B profile', config:cfg});
  const bPid=bCreated.json?.id;
  const fb=await call('POST','/feedback',B.cookie,B.csrf,{profile_id:bPid,item_id:'e11',action:'saved',rating:3});
  const faList=await call('GET','/feedback',A.cookie,A.csrf);
  const fbList=await call('GET','/feedback',B.cookie,B.csrf);
  check('B1-3-feedback-isolation', fa.status===201 && fb.status===201 && faList.json.feedback.length===1 && fbList.json.feedback.length===1 && faList.json.feedback[0].rating===5 && fbList.json.feedback[0].rating===3, `A fb ${JSON.stringify(faList.json)} B fb ${JSON.stringify(fbList.json)}`);
  // B1-4 export isolation
  const bExp=await call('GET',`/profiles/${aPid}/export`,B.cookie,B.csrf);
  const aExp=await call('GET',`/profiles/${aPid}/export`,A.cookie,A.csrf);
  check('B1-4-export-isolation', bExp.status===404 && aExp.status===200 && aExp.json.config.schemaVersion==='1.0.0-draft' && !JSON.stringify(aExp.json).includes('TestPass'), `B export ${bExp.status}, A export ${aExp.status} schema ${aExp.json?.config?.schemaVersion}`);
  // Demo fixture immutability
  const demoHashBefore=cfgHash('demo-alex');
  const demoPut=await call('PUT','/profiles/demo-alex',A.cookie,A.csrf,{title:'Hacked demo', config:cfg});
  const demoDel=await call('DELETE','/profiles/demo-alex',A.cookie,A.csrf);
  const demoHashAfter=cfgHash('demo-alex');
  check('demo-immutable', demoPut.status===404 && demoDel.status===404 && demoHashBefore===demoHashAfter, `PUT ${demoPut.status} DEL ${demoDel.status} hash ${demoHashBefore}->${demoHashAfter}`);
  // Demo copy via import
  const demoList=await call('GET','/demo-profiles',A.cookie,A.csrf);
  const alexDemo=demoList.json.profiles.find(p=>p.id==='demo-alex');
  const imp=await call('POST','/profiles/import',A.cookie,A.csrf,{title:'Alex copy', config:alexDemo.config});
  const impGet=await call('GET',`/profiles/${imp.json?.id}`,A.cookie,A.csrf);
  check('demo-copy-via-import', imp.status===201 && impGet.status===200 && impGet.json.config.customInterests?.length===2, `import ${imp.status} copy customInterests ${impGet.json?.config?.customInterests?.length}`);
  // B1-7 CSRF
  const noCsrf=await call('POST','/profiles',A.cookie,A.csrf,{title:'No csrf', config:cfg}, true);
  check('B1-7-csrf', noCsrf.status===403, `mutation without CSRF=${noCsrf.status}`);
  // B1-9 schema validation
  const badVer=await call('POST','/profiles/import',A.cookie,A.csrf,{title:'Bad', config:{schemaVersion:'9.9.9', balance:'personal'}});
  const badJsonCountBefore=dbState().profiles;
  check('B1-9-schema-validation', badVer.status===400 && dbState().profiles===badJsonCountBefore, `bad version=${badVer.status} profiles unchanged=${dbState().profiles===badJsonCountBefore}`);
  // B1-10 legacy import
  const legacy=await call('POST','/profiles/import',A.cookie,A.csrf,{title:'Legacy', config:{balance:'personal', weekGrouping:'chronological'}});
  const legacyGet=await call('GET',`/profiles/${legacy.json?.id}`,A.cookie,A.csrf);
  check('B1-10-legacy-import', legacy.status===201 && legacyGet.json.config.schemaVersion==='1.0.0-draft' && legacyGet.json.config.balance==='personal', `legacy ${legacy.status} schema ${legacyGet.json?.config?.schemaVersion}`);
  // B1-11 demo seeding
  const demos=await call('GET','/demo-profiles',A.cookie,A.csrf);
  check('B1-11-demo-seeding', demos.json.profiles.length===3 && demos.json.profiles.find(p=>p.id==='demo-alex')?.config.customInterests.length===2, `demos ${demos.json.profiles.length} alex custom ${demos.json.profiles.find(p=>p.id==='demo-alex')?.config.customInterests.length}`);
  // B1-5 session expiry: expire A's session in DB directly (test manipulation, deterministic)
  { const db=new DatabaseSync(DB); db.prepare('UPDATE sessions SET expires_at=? WHERE user_id=?').run(Date.now()-1000, A.id); db.close(); }
  const expired=await call('GET','/profiles',A.cookie,A.csrf);
  check('B1-5-session-expiry', expired.status===401, `expired session request=${expired.status}`);
  // Re-login A for logout test
  const la2=await call('POST','/auth/login',null,null,{email:'test-a@b1.local',password:'TestPass-A-123'});
  const A2={cookie:cookieOf(la2), csrf:la2.json.csrf_token, id:la2.json.user_id};
  const okBefore=await call('GET','/profiles',A2.cookie,A2.csrf);
  const logout=await call('POST','/auth/logout',A2.cookie,A2.csrf);
  const afterLogout=await call('GET','/profiles',A2.cookie,A2.csrf);
  check('B1-6-logout-invalidation', okBefore.status===200 && logout.status===200 && afterLogout.status===401, `before ${okBefore.status} logout ${logout.status} after ${afterLogout.status}`);
  // B1-8 persistence across restart is tested by the outer harness (server restart + re-check) — here record state
  const mid=dbState(); console.log('DB mid (before restart):', JSON.stringify(mid));
  check('B1-8-persistence-pre-restart', mid.users>=2 && mid.profiles>=6 && mid.feedback>=2, `users ${mid.users} profiles ${mid.profiles} feedback ${mid.feedback} (nonempty)`);
  console.log('RESULTS', JSON.stringify(R));
  console.log('DB final:', JSON.stringify(dbState()));
})();
