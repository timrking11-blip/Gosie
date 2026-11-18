// Offline API fixtures in a disposable Chromium profile; never authenticates,
// creates accounts, writes catalog records, or sends API mutations.
// Run: node artifacts/gosie/discoveries-browser-check.cjs
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const output = path.resolve('generated-artifacts/discovery-browser-check');
const base = process.env.GOSIE_BROWSER_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
function fixtures() {
  const original = window.fetch.bind(window);
  window.discoveryMode = 'ready';
  window.discoveryRequests = 0;
  const config = { weekGrouping: 'chronological', weekendInterests: [], socialContexts: [], customInterests: [],
    transportModes: [], budgetPerActivity: 50, maxTravelMinutes: 30 };
  const record = { id: 'synthetic-only', title: 'Synthetic exhibition with a deliberately long descriptive title',
    venue: 'Synthetic public museum', region: 'Fictional region', category: 'exhibit',
    why: 'Synthetic reviewed evidence for browser verification only. Not a real listing.',
    status: 'scheduled', flags: ['stale'], firstSeenAt: '2026-10-01T12:00:00Z', lastCheckedAt: '2026-10-02T12:00:00Z',
    dates: { publication: null, announcedOpening: null, confirmedOpening: null, exhibitStart: '2026-11-01', exhibitEnd: '2026-12-31' },
    sources: [{ url: 'https://www.metmuseum.org/exhibitions', publisher: 'Synthetic source label',
      excerpt: 'Synthetic evidence. ' + 'LongUnbrokenSourceText'.repeat(8), publicationDate: null, checkedAt: '2026-10-02T12:00:00Z' }] };
  window.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!url.pathname.startsWith('/api/')) return original(input, options);
    let data = {}, status = 200;
    switch (url.pathname) {
      case '/api/auth/session': data = { authenticated: true, user: { id: 'synthetic', email: 'browser-fixture@example.invalid' } }; break;
      case '/api/profiles': data = { profiles: [{ id: 'synthetic', title: 'Synthetic test profile', config }] }; break;
      case '/api/demo-profiles': data = { profiles: [] }; break;
      case '/api/feedback': data = { feedback: [] }; break;
      case '/api/week': data = { items: [], groups: {}, why: [] }; break;
      case '/api/weekend': data = { included: [], exceptions: [], excluded: [], dismissed: [] }; break;
      case '/api/community/items': data = { items: [] }; break;
      case '/api/discoveries':
        window.discoveryRequests++;
        status = window.discoveryMode === 'error' ? 503 : 200;
        data = { schemaVersion: 1, revision: 'synthetic-browser-fixture', warning: 'Synthetic stale catalog warning.',
          records: window.discoveryMode === 'empty' ? [] : [record] }; break;
      default: throw new Error(`Unexpected fixture API: ${url.pathname}`);
    }
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  };
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gosie-browser-'));
  const chrome = spawn('chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let socket;
  try {
    for (let n = 0; n < 100 && !fs.existsSync(path.join(profile, 'DevToolsActivePort')); n++) await delay(100);
    const port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0];
    const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    socket = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let counter = 0;
    const pending = new Map(), exceptions = [];
    socket.onmessage = ({ data }) => {
      const event = JSON.parse(data);
      if (event.id) { const p = pending.get(event.id); pending.delete(event.id); event.error ? p.reject(event.error) : p.resolve(event.result); }
      if (event.method === 'Runtime.exceptionThrown') exceptions.push(event.params.exceptionDetails.text);
      if (event.method === 'Network.loadingFailed') console.error('Browser request failed:', event.params.errorText, event.params.blockedReason || '');
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++counter; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const until = async (expression) => {
      for (let n = 0; n < 100; n++) { if (await evaluate(expression)) return; await delay(100); }
      throw new Error(`Timed out: ${expression}\n${await evaluate('document.body.innerText.slice(0,1500)')}\n${JSON.stringify(exceptions)}`);
    };
    const key = async (key, code, windowsVirtualKeyCode) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode });
      if (key === 'Enter') await send('Input.dispatchKeyEvent', { type: 'char', text: '\r' });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode });
      await delay(100);
    };
    await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
    await delay(500);
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `(${fixtures.toString()})()` });
    const results = [];
    for (const width of [360, 768, 1280]) {
      for (const scale of [1, 2]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
        const navigation = await send('Page.navigate', { url: `${base}/app?view=weekend` });
        if (navigation.errorText) throw new Error(`Navigation failed: ${navigation.errorText}`);
        await until(`!!document.querySelector('.research-discovery')`);
        if (scale === 2) await evaluate(`document.documentElement.style.fontSize='200%'`);
        await evaluate(`document.querySelector('.research-discoveries').scrollIntoView()`);
        // Use browser keyboard events, not DOM click simulation.
        await evaluate(`document.querySelector('.research-discovery summary').focus()`);
        await send('Emulation.setFocusEmulationEnabled', { enabled: true });
        await key('Enter', 'Enter', 13);
        assert.equal(await evaluate(`document.querySelector('.research-discovery details').open`), true);
        await key('Tab', 'Tab', 9);
        assert.equal(await evaluate(`document.activeElement.tagName`), 'A');
        const link = await evaluate(`({href:document.activeElement.href,rel:document.activeElement.rel,target:document.activeElement.target,referrer:document.activeElement.referrerPolicy})`);
        assert.equal(link.href, 'https://www.metmuseum.org/exhibitions');
        assert.equal(link.target, '_blank'); assert.equal(link.rel, 'noopener noreferrer');
        assert.equal(link.referrer, 'no-referrer');
        await evaluate(`document.querySelector('.research-discovery summary').focus()`);
        await key(' ', 'Space', 32);
        assert.equal(await evaluate(`document.querySelector('.research-discovery details').open`), false);
        await key('Enter', 'Enter', 13);
        const dimensions = await evaluate(`(() => {
          const section=document.querySelector('.research-discoveries');
          return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,
            sectionWidth:section.clientWidth,sectionScroll:section.scrollWidth,
            font:getComputedStyle(section.querySelector('p')).fontSize,
            stale:section.textContent.includes('Stale — recheck'),
            overflow:[...section.querySelectorAll('*')].filter(e=>e.getClientRects().length && e.scrollWidth>e.clientWidth+2 && !['SUMMARY','A','STRONG'].includes(e.tagName)).map(e=>e.tagName)};
        })()`);
        results.push({ width, scale, ...dimensions, keyboard: 'Enter/Space disclosure and Tab source focus passed', link });
        await evaluate(`document.querySelector('.research-discovery summary').scrollIntoView({block:'center'})`);
        const screenshot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(output, `${width}-${scale}x.png`), Buffer.from(screenshot.data, 'base64'));
        assert.equal(dimensions.stale, true);
        assert.ok(dimensions.sectionScroll <= dimensions.sectionWidth + 2, JSON.stringify(dimensions));
        assert.deepEqual(dimensions.overflow, []);
        const injection = await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.discoveryMode='error'` });
        await send('Page.reload');
        await until(`!!document.querySelector('.research-discoveries [role=alert]')`);
        if (scale === 2) await evaluate(`document.documentElement.style.fontSize='200%'`);
        await evaluate(`window.discoveryMode='empty'; document.querySelector('.research-discoveries button').focus()`);
        await key('Enter', 'Enter', 13);
        await until(`document.querySelector('.research-discoveries')?.textContent.includes('No current discoveries')`);
        assert.equal(await evaluate('window.discoveryRequests'), 2);
        results.at(-1).retryToEmpty = 'Keyboard retry after 503 reached the empty state';
        await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });
      }
    }
    // Remount via real browser reload with a separate injected initial state.
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.discoveryMode='error'` });
    await send('Page.reload');
    await until(`!!document.querySelector('.research-discoveries [role=alert]')`);
    await evaluate(`window.discoveryMode='empty'; document.querySelector('.research-discoveries button').focus()`);
    await key('Enter', 'Enter', 13);
    await until(`document.querySelector('.research-discoveries')?.textContent.includes('No current discoveries')`);
    const retryRequests = await evaluate('window.discoveryRequests');
    assert.equal(retryRequests, 2);
    assert.deepEqual(exceptions, []);
    const report = { mode: 'Live Chromium with isolated synthetic session and API responses; not a real authentication test',
      results, retryRequests, empty: true, runtimeExceptions: exceptions,
      limits: ['No real login, backend persistence, provider or source-page navigation tested', '200% root text scale, not OS text scaling or native-phone testing'] };
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    socket?.close(); chrome.kill('SIGTERM');
    await new Promise((resolve) => chrome.exitCode !== null ? resolve() : chrome.once('exit', resolve));
    fs.rmSync(profile, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
