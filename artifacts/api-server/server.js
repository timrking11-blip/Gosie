// PIT Option B — Phase B1: Local Scaffold, Authentication, and Profiles ONLY.
// Fictional data only. No Google, no hosting, no paid services. Local SQLite.
// Run: DB_PATH=<path> PORT=<port> node server.js   (Node >= 22.5, uses node:sqlite)
// Env: PORT, DB_PATH, COOKIE_SECURE=1 (set behind HTTPS), AUTH_RATE_LIMIT (attempts/min/IP, default 20)
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const PORT = Number(process.env.PORT || 8791);
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) { console.error(JSON.stringify({fatal:'invalid PORT', value:process.env.PORT})); process.exit(1); }
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'b1.db');
const COOKIE_SECURE = process.env.COOKIE_SECURE === '1';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const AUTH_RATE_LIMIT = Number(process.env.AUTH_RATE_LIMIT) || 20;
const MAX_BODY = 65536;
const MAX_PROFILES_PER_USER = 50;
const authHits = new Map();
function clientIp(req){
  if (TRUST_PROXY) { const f = String(req.headers['x-forwarded-for']||'').split(',')[0].trim(); if (f) return f; }
  return req.socket.remoteAddress || 'unknown';
}
function rateLimited(req){
  const ip = clientIp(req); const now = Date.now();
  const hits = (authHits.get(ip) || []).filter(t => now - t < 60000); hits.push(now); authHits.set(ip, hits);
  return hits.length > AUTH_RATE_LIMIT;
}
function log(obj){ console.log(JSON.stringify(Object.assign({t:new Date().toISOString()}, obj))); }
const isStr = (v,max)=> typeof v==='string' && v.length<=max;
const isNum = v => typeof v==='number' && Number.isFinite(v) && v>=0 && v<=100000;
const strArr = (v,n,max)=> Array.isArray(v) && v.length<=n && v.every(x=>isStr(x,max));
// Returns an error string or null. Fields are checked only when present so legacy exports still import.
function configError(c){
  if (c===null || typeof c!=='object' || Array.isArray(c)) return 'config_must_be_object';
  for (const k of ['budgetPerActivity','maxTravelMinutes','exceptionTravelMinutes']) if (k in c && !isNum(c[k])) return k+'_invalid';
  for (const k of ['budgetHard','allowExceptions','surpriseMe']) if (k in c && typeof c[k]!=='boolean') return k+'_invalid';
  for (const k of ['balance','weekGrouping','homeBase']) if (k in c && c[k]!==null && !isStr(c[k],200)) return k+'_invalid';
  for (const k of ['transportModes','weekendInterests','socialContexts','balancedPriorities']) if (k in c && !strArr(c[k],50,200)) return k+'_invalid';
  if ('customInterests' in c){
    if (!Array.isArray(c.customInterests) || c.customInterests.length>50 || !c.customInterests.every(x=>x && typeof x==='object' && !Array.isArray(x) && Object.values(x).every(v=>typeof v==='number' || isStr(v,500)))) return 'customInterests_invalid';
  }
  if ('customSections' in c && (!Array.isArray(c.customSections) || c.customSections.length>50)) return 'customSections_invalid';
  return null;
}
setInterval(()=>{
  const now=Date.now(); for(const [ip,h] of authHits) if(!h.some(t=>now-t<60000)) authHits.delete(ip);
  try{ db.prepare('DELETE FROM sessions WHERE expires_at<?').run(now); }catch(e){ log({level:'error',msg:'session_cleanup_failed',err:String(e)}); }
}, 60000).unref();
const FEEDBACK_ACTIONS = new Set(['saved','dismissed','rating']);
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL, pass_salt TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0, title TEXT NOT NULL, config TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, profile_id TEXT NOT NULL, item_id TEXT NOT NULL, action TEXT NOT NULL, rating INTEGER, created_at TEXT NOT NULL);`);
function sha(s){ return crypto.createHash('sha256').update(s).digest('hex'); }
function hashPw(pw, salt){ return crypto.scryptSync(pw, salt, 64).toString('hex'); }
const DUMMY_SALT = crypto.randomBytes(16).toString('hex');
function send(res, code, obj){
  res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"});
  res.end(JSON.stringify(obj));
}
function parseCookies(req){ const out={}; (req.headers.cookie||'').split(';').forEach(p=>{ const [k,...v]=p.trim().split('='); if(k) out[k]=v.join('='); }); return out; }
function sessionOf(req){
  const sid = parseCookies(req).session_id; if(!sid) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE id=?').get(sid); if(!s) return null;
  if (Date.now() > s.expires_at) { db.prepare('DELETE FROM sessions WHERE id=?').run(sid); return null; }
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(s.user_id); if(!u) return null;
  return { session: s, user: u };
}
function demoConfig(balance, extra){ return Object.assign({
  schemaVersion: '1.0.0-draft', balance, weekGrouping: 'company', weekNested: null,
  budgetPerActivity: 50, budgetHard: false, maxTravelMinutes: 30, exceptionTravelMinutes: 60, allowExceptions: true,
  transportModes: ['walking','transit'], homeBase: 'Downtown (demo)', weekendInterests: [], customInterests: [], socialContexts: [], surpriseMe: false, customSections: []
}, extra); }
function seedDemos(){
  if (db.prepare('SELECT COUNT(*) c FROM profiles WHERE is_demo=1').get().c > 0) return;
  const demos = [
    ['demo-maya','Maya — Professional Focus', demoConfig('professional', {weekGrouping:'company', budgetPerActivity:60, budgetHard:false, maxTravelMinutes:30, exceptionTravelMinutes:60, allowExceptions:true, transportModes:['transit','walking'], homeBase:'Downtown (demo)', weekendInterests:['Live music','Restaurants and food']})],
    ['demo-jordan','Jordan — Personal Focus', demoConfig('personal', {weekGrouping:'chronological', budgetPerActivity:25, budgetHard:true, maxTravelMinutes:25, exceptionTravelMinutes:25, allowExceptions:false, transportModes:['walking','cycling'], homeBase:'Lakeside (demo)', weekendInterests:['Outdoor','Fitness','Relaxation'], surpriseMe:true})],
    ['demo-alex','Alex — Balanced', demoConfig('balanced', {weekGrouping:'category', budgetPerActivity:50, budgetHard:false, maxTravelMinutes:35, exceptionTravelMinutes:60, allowExceptions:true, transportModes:['walking','transit','cycling'], homeBase:'Old Market (demo)', weekendInterests:['Arts/museums/theater','Restaurants and food','Hidden gems','Learning and workshops'], surpriseMe:true, balancedPriorities:['Deadlines','Social Plans','Learning'], customInterests:[
      {id:'ci-marvel-2026-10-30', label:'Marvel movies and premiere-night screenings', category:'Movies & Cinema', specificInterest:'Marvel Cinematic Universe', desiredExperience:'Premiere night or opening weekend', priority:1},
      {id:'ci-photo-2026-10-30', label:'Photography walks', category:'Outdoors', specificInterest:'Photography', desiredExperience:'Guided walks and meetups', priority:2}
    ]})],
  ];
  for (const [id,title,cfg] of demos) db.prepare('INSERT INTO profiles(id,user_id,is_demo,title,config,created_at) VALUES (?,?,?,?,?,?)').run(id,'system-demo',1,title,JSON.stringify(cfg),new Date().toISOString());
}
seedDemos();
function ownProfile(userId, pid){ return db.prepare('SELECT * FROM profiles WHERE id=? AND user_id=?').get(pid, userId); }
const server = http.createServer((req,res)=>{
  let url; try{ url = new URL(req.url,'http://localhost'); }catch{ return send(res,400,{error:'bad_request'}); }
  const started = Date.now();
  res.on('finish', ()=> log({method:req.method, path:url.pathname, status:res.statusCode, ms:Date.now()-started}));
  let body=''; let tooLarge=false;
  req.on('data',c=>{ if(tooLarge) return; body+=c; if(body.length>MAX_BODY){ tooLarge=true; body=''; } });
  req.on('error',()=>{});
  req.on('end',()=>{ try{ handle(req,res,url,body,tooLarge); }catch(e){ log({level:'error',msg:'unhandled',path:url.pathname,err:String(e&&e.stack||e)}); if(!res.headersSent) send(res,500,{error:'internal_error'}); else res.end(); } });
});
function handle(req,res,url,body,tooLarge){
  {
    if(tooLarge) return send(res,413,{error:'payload_too_large'});
    let j={}; if(body){ try{ j=JSON.parse(body); }catch{ return send(res,400,{error:'invalid_json'}); } }
    if(j===null || typeof j!=='object' || Array.isArray(j)) return send(res,400,{error:'invalid_json'});
    if(req.method==='POST' && (url.pathname==='/auth/register' || url.pathname==='/auth/login') && rateLimited(req)) return send(res,429,{error:'rate_limited'});
    const sess = sessionOf(req);
    // Public: register, login, health
    if(req.method==='GET' && url.pathname==='/health') return send(res,200,{ok:true,pilot:'b1-local'});
    if(req.method==='POST' && url.pathname==='/auth/register'){
      if(typeof j.email!=='string' || typeof j.password!=='string' || !j.email || !j.password) return send(res,400,{error:'email_and_password_required'});
      const email=j.email.trim().toLowerCase();
      if(email.length>254 || !/^[^\s@]+@[^\s@]+$/.test(email)) return send(res,400,{error:'invalid_email'});
      if(j.password.length<8) return send(res,400,{error:'password_too_short'});
      if(j.password.length>200) return send(res,400,{error:'password_too_long'});
      const salt=crypto.randomBytes(16).toString('hex'); const id='user-'+crypto.randomBytes(8).toString('hex');
      try{ db.prepare('INSERT INTO users(id,email,pass_hash,pass_salt,created_at) VALUES (?,?,?,?,?)').run(id,email,hashPw(j.password,salt),salt,new Date().toISOString()); }catch{ return send(res,409,{error:'email_exists'}); }
      return send(res,201,{id,email});
    }
    if(req.method==='POST' && url.pathname==='/auth/login'){
      if(typeof j.email!=='string' || typeof j.password!=='string' || j.password.length>200) return send(res,401,{error:'unauthorized'});
      const u=db.prepare('SELECT * FROM users WHERE email=?').get(j.email.trim().toLowerCase());
      // Hash even for unknown users so response time does not reveal which emails exist.
      const hashed=hashPw(j.password,u?u.pass_salt:DUMMY_SALT);
      if(!u || !crypto.timingSafeEqual(Buffer.from(hashed), Buffer.from(u.pass_hash))) return send(res,401,{error:'unauthorized'});
      const sid=crypto.randomBytes(24).toString('hex'); const csrf=crypto.randomBytes(24).toString('hex');
      const exp=Date.now()+24*3600*1000;
      db.prepare('INSERT INTO sessions(id,user_id,csrf,expires_at,created_at) VALUES (?,?,?,?,?)').run(sid,u.id,csrf,exp,new Date().toISOString());
      res.setHeader('Set-Cookie', `session_id=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${COOKIE_SECURE?'; Secure':''}`);
      return send(res,200,{user_id:u.id, csrf_token:csrf, expires_at:exp});
    }
    // Authenticated routes below
    if(!sess) return send(res,401,{error:'unauthorized'});
    const csrfOk = ()=> req.headers['x-csrf-token'] && req.headers['x-csrf-token']===sess.session.csrf;
    if(req.method==='POST' && url.pathname==='/auth/logout'){
      if(!csrfOk()) return send(res,403,{error:'csrf_required'});
      db.prepare('DELETE FROM sessions WHERE id=?').run(sess.session.id); return send(res,200,{status:'logged_out'});
    }
    if(req.method==='GET' && url.pathname==='/profiles'){
      const rows=db.prepare('SELECT id,title,is_demo,config FROM profiles WHERE user_id=?').all(sess.user.id);
      return send(res,200,{profiles: rows.map(r=>({id:r.id,title:r.title,is_demo:!!r.is_demo,config:JSON.parse(r.config)}))});
    }
    if(req.method==='POST' && url.pathname==='/profiles'){
      if(!csrfOk()) return send(res,403,{error:'csrf_required'});
      if(!isStr(j.title,200) || !j.title.trim() || !j.config || j.config.schemaVersion!=='1.0.0-draft') return send(res,400,{error:'invalid_config'});
      { const ce=configError(j.config); if(ce) return send(res,400,{error:'invalid_config',detail:ce}); }
      if(db.prepare('SELECT COUNT(*) c FROM profiles WHERE user_id=?').get(sess.user.id).c>=MAX_PROFILES_PER_USER) return send(res,409,{error:'profile_limit_reached'});
      const id='profile-'+crypto.randomBytes(8).toString('hex');
      db.prepare('INSERT INTO profiles(id,user_id,is_demo,title,config,created_at) VALUES (?,?,?,?,?,?)').run(id,sess.user.id,0,j.title,JSON.stringify(j.config),new Date().toISOString());
      return send(res,201,{id,title:j.title});
    }
    const mProfile = url.pathname.match(/^\/profiles\/([^\/]+)(\/export)?$/);
    if(mProfile){
      let pid; try{ pid=decodeURIComponent(mProfile[1]); }catch{ return send(res,400,{error:'bad_request'}); }
      if(req.method==='GET' && mProfile[2]==='/export'){
        const p=ownProfile(sess.user.id,pid); if(!p) return send(res,404,{error:'not_found'});
        return send(res,200,{id:p.id,title:p.title,config:JSON.parse(p.config)});
      }
      if(req.method==='GET'){
        const p=ownProfile(sess.user.id,pid); if(!p) return send(res,404,{error:'not_found'});
        return send(res,200,{id:p.id,title:p.title,config:JSON.parse(p.config)});
      }
      if(req.method==='PUT'){
        if(!csrfOk()) return send(res,403,{error:'csrf_required'});
        const p=ownProfile(sess.user.id,pid); if(!p) return send(res,404,{error:'not_found'});
        if(!j.config || j.config.schemaVersion!=='1.0.0-draft') return send(res,400,{error:'invalid_config'});
        { const ce=configError(j.config); if(ce) return send(res,400,{error:'invalid_config',detail:ce}); }
        if(j.title!==undefined && (!isStr(j.title,200) || !j.title.trim())) return send(res,400,{error:'invalid_title'});
        db.prepare('UPDATE profiles SET config=?, title=? WHERE id=?').run(JSON.stringify(j.config), j.title||p.title, pid);
        return send(res,200,{id:pid});
      }
      if(req.method==='DELETE'){
        if(!csrfOk()) return send(res,403,{error:'csrf_required'});
        const p=ownProfile(sess.user.id,pid); if(!p) return send(res,404,{error:'not_found'});
        db.prepare('DELETE FROM profiles WHERE id=?').run(pid); db.prepare('DELETE FROM feedback WHERE profile_id=? AND user_id=?').run(pid,sess.user.id);
        return send(res,200,{status:'deleted'});
      }
    }
    if(req.method==='POST' && url.pathname==='/profiles/import'){
      if(!csrfOk()) return send(res,403,{error:'csrf_required'});
      const cfg=j.config; if(!cfg || typeof cfg!=='object' || Array.isArray(cfg)) return send(res,400,{error:'config_required'});
      // Legacy: profiles without schemaVersion are upgraded to 1.0.0-draft (Phase 2 legacy rule)
      if(!cfg.schemaVersion){ cfg.schemaVersion='1.0.0-draft'; }
      if(cfg.schemaVersion!=='1.0.0-draft') return send(res,400,{error:'version_mismatch'});
      { const ce=configError(cfg); if(ce) return send(res,400,{error:'invalid_config',detail:ce}); }
      if(j.title!==undefined && (!isStr(j.title,200) || !j.title.trim())) return send(res,400,{error:'invalid_title'});
      if(db.prepare('SELECT COUNT(*) c FROM profiles WHERE user_id=?').get(sess.user.id).c>=MAX_PROFILES_PER_USER) return send(res,409,{error:'profile_limit_reached'});
      const id='profile-'+crypto.randomBytes(8).toString('hex');
      db.prepare('INSERT INTO profiles(id,user_id,is_demo,title,config,created_at) VALUES (?,?,?,?,?,?)').run(id,sess.user.id,0,j.title||'Imported profile',JSON.stringify(cfg),new Date().toISOString());
      return send(res,201,{id,title:j.title||'Imported profile'});
    }
    if(req.method==='GET' && url.pathname==='/demo-profiles'){
      const rows=db.prepare('SELECT id,title,config FROM profiles WHERE is_demo=1').all();
      return send(res,200,{profiles: rows.map(r=>({id:r.id,title:r.title,config:JSON.parse(r.config)}))});
    }
    if(req.method==='POST' && url.pathname==='/feedback'){
      if(!csrfOk()) return send(res,403,{error:'csrf_required'});
      const p=ownProfile(sess.user.id,typeof j.profile_id==='string'?j.profile_id:''); if(!p) return send(res,404,{error:'not_found'});
      if(!isStr(j.item_id,100) || !j.item_id || !FEEDBACK_ACTIONS.has(j.action) || (j.action==='rating' && !(Number.isInteger(j.rating) && j.rating>=1 && j.rating<=5))) return send(res,400,{error:'invalid_feedback'});
      const info=db.prepare('INSERT INTO feedback(user_id,profile_id,item_id,action,rating,created_at) VALUES (?,?,?,?,?,?)').run(sess.user.id,j.profile_id,j.item_id,j.action,j.rating??null,new Date().toISOString());
      return send(res,201,{id:info.lastInsertRowid});
    }
    if(req.method==='GET' && url.pathname==='/feedback'){
      const rows=db.prepare('SELECT id,profile_id,item_id,action,rating FROM feedback WHERE user_id=?').all(sess.user.id);
      return send(res,200,{feedback:rows});
    }
    // ---- B2: Week / Weekend dashboards (fictional demo data, deterministic) ----
    if(req.method==='GET' && url.pathname==='/week'){
      const pid=url.searchParams.get('profile_id')||''; const p=ownProfile(sess.user.id,pid);
      if(!p) return send(res,404,{error:'not_found'});
      const cfg=JSON.parse(p.config);
      // Fictional week records from the Phase 2 reference (Alex visible set, 7 of 12 total)
      const weekRecords=[
        {id:'w1',title:'Q3 planning review with leadership',category:'Meetings',company:'Northwind Studio',domain:'professional',priority:'High',dayLabel:'Mon'},
        {id:'w2',title:'Atlas prototype milestone due',category:'Deadlines',company:'Northwind Studio',domain:'professional',priority:'High',dayLabel:'Wed'},
        {id:'w4',title:'Decide: extend contractor or hire in-house',category:'Decisions',company:'Northwind Studio',domain:'professional',priority:'High',dayLabel:'Thu'},
        {id:'w8',title:'Dinner with Sam and Priya',category:'Social Plans',company:'—',domain:'personal',priority:'Medium',dayLabel:'Fri'},
        {id:'w12',title:'Storefront launch checklist review',category:'Deadlines',company:'Harbor Retail Group',domain:'professional',priority:'Medium',dayLabel:'Fri'},
        {id:'w7',title:'Morning run — 5K loop',category:'Fitness',company:'—',domain:'personal',priority:'Low',dayLabel:'Wed'},
        {id:'w11',title:'Side-project: photo archive sorting',category:'Personal Goals',company:'—',domain:'personal',priority:'Low',dayLabel:'Sat'},
      ];
      const groups={}; weekRecords.forEach(r=>{ const k=cfg.weekGrouping==='company'?r.company:cfg.weekGrouping==='category'?r.category:r.dayLabel; (groups[k]=groups[k]||[]).push(r); });
      return send(res,200,{theme:'Modern Executive Productivity', grouping:cfg.weekGrouping, totalBeforeFilter:12, items:weekRecords, groups, why:['Demo data — fictional records, not a real calendar.']});
    }
    if(req.method==='GET' && url.pathname==='/weekend'){
      const pid=url.searchParams.get('profile_id')||''; const p=ownProfile(sess.user.id,pid);
      if(!p) return send(res,404,{error:'not_found'});
      const cfg=Object.assign({transportModes:[],maxTravelMinutes:30,exceptionTravelMinutes:60,budgetPerActivity:50,budgetHard:false,allowExceptions:false,weekendInterests:[],customInterests:[]}, JSON.parse(p.config));
      const social=url.searchParams.get('social')||'all';
      const socialToken = social==='friend'?'friends':social==='solo'?'solo':social==='date'?'date':social==='group'?'group':'flexible';
      // Fictional weekend records from the Phase 2 reference (16 records, e1–e16)
      const recs=[
        {id:'e1',name:'Riverside Jazz Quartet (demo listing)',category:'Live Music',price:35,travelMinutes:20,transport:'transit',social:['solo','date','friends','flexible'],interests:[],text:'riverside jazz quartet live music'},
        {id:'e2',name:'Night Market & Street Food Row (demo listing)',category:'Food & Drink',price:25,travelMinutes:15,transport:'walking',social:['friends','date','family','group','flexible'],interests:['Restaurants and food','Hidden gems'],text:'night market street food restaurants hidden gems'},
        {id:'e3',name:'Modern Photography Exhibition (demo listing)',category:'Arts & Museums',price:18,travelMinutes:25,transport:'transit',social:['solo','date','flexible'],interests:['Arts, museums, and theater'],text:'modern photography exhibition arts museums photography'},
        {id:'e4',name:'Hilltop Trail Hike & Picnic (demo idea)',category:'Outdoors',price:0,travelMinutes:35,transport:'driving',social:['solo','friends','family','flexible'],interests:[],text:'hilltop trail hike picnic outdoors'},
        {id:'e5',name:'Arena Rock Show (demo listing)',category:'Live Music',price:85,travelMinutes:55,transport:'transit',social:['friends','date','group','flexible'],interests:[],text:'arena rock show live music'},
        {id:'e6',name:'Beginner Pottery Workshop (demo listing)',category:'Learning',price:45,travelMinutes:18,transport:'cycling',social:['solo','date','friends','flexible'],interests:['Learning and workshops','Hidden gems'],text:'beginner pottery workshop learning hidden gems'},
        {id:'e7',name:'Rooftop Cinema: Classic Films (demo listing)',category:'Movies & Cinema',price:22,travelMinutes:28,transport:'transit',social:['date','friends','flexible'],interests:['Arts, museums, and theater'],text:'rooftop cinema classic films arts museums'},
        {id:'e8',name:'Community 5K Fun Run (demo listing)',category:'Fitness',price:15,travelMinutes:22,transport:'cycling',social:['solo','friends','family','group','flexible'],interests:[],text:'community 5k fun run fitness'},
        {id:'e9',name:'Faraway Vineyard Day Trip (demo idea)',category:'Day Trips',price:60,travelMinutes:95,transport:'driving',social:['date','friends','flexible'],interests:['Restaurants and food'],text:'faraway vineyard day trip restaurants food'},
        {id:'e10',name:'Neighborhood Bookshop Reading (demo listing)',category:'Learning',price:0,travelMinutes:8,transport:'walking',social:['solo','flexible'],interests:['Learning and workshops'],text:'neighborhood bookshop reading learning'},
        {id:'e11',name:'Marvel Premiere Night Screening (demo listing)',category:'Movies & Cinema',price:24,travelMinutes:26,transport:'transit',social:['friends','date','group','flexible'],interests:[],text:'marvel premiere night screening marvel cinematic universe premiere night opening weekend movies cinema'},
        {id:'e12',name:'Independent Cinema: Director Q&A (demo listing)',category:'Movies & Cinema',price:16,travelMinutes:24,transport:'transit',social:['solo','date','flexible'],interests:['Arts, museums, and theater'],text:'independent cinema director q&a movies cinema'},
        {id:'e13',name:'Comic Books & Collectibles Meetup (demo listing)',category:'Pop Culture',price:5,travelMinutes:14,transport:'walking',social:['friends','group','flexible'],interests:[],text:'comic books collectibles meetup pop culture'},
        {id:'e14',name:'Sunrise Photography Walk (demo idea)',category:'Outdoors',price:0,travelMinutes:18,transport:'walking',social:['solo','friends','group','flexible'],interests:[],text:'sunrise photography walk photography guided walks meetups outdoors'},
        {id:'e15',name:'Board Game & Tabletop Night (demo listing)',category:'Gaming',price:10,travelMinutes:16,transport:'cycling',social:['friends','group','flexible'],interests:[],text:'board game tabletop night gaming'},
        {id:'e16',name:'Community Volunteering Morning (demo listing)',category:'Community',price:0,travelMinutes:20,transport:'transit',social:['solo','friends','group','family','flexible'],interests:[],text:'community volunteering morning'},
      ];
      const tokens = s => (s.toLowerCase().match(/[a-z]+/g)||[]);
      function customMatch(rec, ci){
        const recToks = new Set(tokens(rec.text));
        // B1 seed uses specificInterest; PIT reference uses specific; accept both (field-name defect found in B2 testing, fixed here)
        const specToks = tokens(ci.specific||ci.specificInterest||ci.originalText||'');
        if (specToks.some(t=>recToks.has(t))) return true;
        const allToks = new Set([...tokens(ci.category||''), ...tokens(ci.label||ci.originalText||''), ...tokens(ci.desiredExperience||ci.experience||'')]);
        let hits=0; allToks.forEach(t=>{ if(recToks.has(t)) hits++; });
        return hits>=3;
      }
      const fb = db.prepare('SELECT * FROM feedback WHERE user_id=? AND profile_id=?').all(sess.user.id,pid);
      // Field-by-field fidelity note (B2): B1 demo configs use 'Arts/museums/theater',
      // PIT reference uses 'Arts, museums, and theater'. Normalize interest strings
      // (lowercase, non-letters to spaces, drop 'and') before comparing, so the
      // same interest is not missed by punctuation alone.
      const norm = s => s.toLowerCase().replace(/[^a-z]+/g,' ').split(' ').filter(w=>w && w!=='and').sort().join(' ');
      const cfgInterestsNorm = new Set((cfg.weekendInterests||[]).map(norm));
      const out=[];
      for(const r of recs){
        const customMatches = (cfg.customInterests||[]).filter(ci=>customMatch(r,ci)).map(ci=>ci.label);
        const interestMatch = r.interests.some(i=>cfgInterestsNorm.has(norm(i)));
        let score=64; const why=['Demo data — fictional listing. Price and travel time are invented for this template and are NOT verified.','Why am I seeing this? '+(interestMatch?`Matches selected interest: ${r.interests.join(', ')}.`:'Does not match a selected interest — ranked lower on soft preference, not excluded.')];
        if(customMatches.length){ score+=30; why.push(`Matches your stored custom interest “${customMatches.join(', ')}”. Match is against fictional demo records only; it does not mean a live source offers this.`); }
        if(interestMatch) score+=20;
        if(social!=='all' && r.social.includes(socialToken)) score+=5;
        if(social!=='all' && !r.social.includes(socialToken) && !r.social.includes('flexible')) score-=10;
        const saved = fb.find(f=>f.item_id===r.id && f.action==='saved');
        const rating = fb.find(f=>f.item_id===r.id && f.action==='rating');
        const dismissed = fb.find(f=>f.item_id===r.id && f.action==='dismissed');
        if(saved){ score+=25; why.push('You saved this — it stays pinned.'); }
        if(rating){ score+= (rating.rating===5?8:rating.rating===4?4:2); why.push(`You rated this ${rating.rating}/5 — ratings nudge similar categories in future rankings.`); }
        // Hard constraints
        const reasons=[];
        if(!cfg.transportModes.includes(r.transport)) reasons.push(`Needs ${r.transport}, which is not in this profile's travel modes (hard constraint).`);
        if(r.travelMinutes > cfg.maxTravelMinutes && !(cfg.allowExceptions && r.travelMinutes <= cfg.exceptionTravelMinutes)) reasons.push(`${r.travelMinutes} min travel exceeds the ${cfg.maxTravelMinutes} min hard limit.`);
        if(cfg.budgetHard && r.price > cfg.budgetPerActivity) reasons.push(`$${r.price} is over the $${cfg.budgetPerActivity} hard budget.`);
        let status='included';
        if(dismissed) status='dismissed';
        else if(reasons.length) status='excluded';
        else if((r.travelMinutes > cfg.maxTravelMinutes && cfg.allowExceptions && r.travelMinutes <= cfg.exceptionTravelMinutes) || (!cfg.budgetHard && r.price > cfg.budgetPerActivity)) { status='exception'; reasons.push('Shown only as a labeled exception, never silently included.'); }
        out.push(Object.assign({}, r, {score, why, customMatches, status, excludeReasons: reasons, sourceType:'fictional-demo', saved:!!saved}));
      }
      const included = out.filter(o=>o.status==='included').sort((a,b)=> (b.saved?1:0)-(a.saved?1:0) || b.score-a.score);
      const exceptions = out.filter(o=>o.status==='exception');
      const excluded = out.filter(o=>o.status==='excluded');
      return send(res,200,{theme:'Life in Motion', social, included, exceptions, excluded, includedCount:included.length, exceptionCount:exceptions.length, excludedCount:excluded.length});
    }
    return send(res,404,{error:'not_found'});
  }
}
server.timeout=10000; server.headersTimeout=10000; server.requestTimeout=10000; server.keepAliveTimeout=5000;
server.listen(PORT, '0.0.0.0', ()=>console.log(JSON.stringify({listening:PORT, db:DB_PATH})));
for(const sig of ['SIGINT','SIGTERM']) process.on(sig, ()=>{
  log({msg:'shutting_down',sig});
  setTimeout(()=>process.exit(1), 5000).unref();
  server.close(()=>{ try{ db.close(); }catch{} process.exit(0); });
  server.closeIdleConnections?.();
});
process.on('unhandledRejection', e=>log({level:'error',msg:'unhandledRejection',err:String(e)}));
process.on('uncaughtException', e=>{ log({level:'fatal',msg:'uncaughtException',err:String(e&&e.stack||e)}); process.exit(1); });
