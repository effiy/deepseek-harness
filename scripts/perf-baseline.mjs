import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const cookieRaw = readFileSync('/tmp/dsh-cookies.txt', 'utf-8');
const cookieLine = cookieRaw.split('\n').find(l => l.includes('dsh-auth'));
const parts = cookieLine.split('\t');
const cookieName = parts[5];
const cookieValue = parts[6];

console.log(`Cookie: ${cookieName}=${cookieValue.substring(0, 20)}...`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addCookies([{ name: cookieName, value: cookieValue, domain: '127.0.0.1', path: '/', httpOnly: true }]);

const page = await context.newPage();

// Register Web Vitals observers before navigation
await page.evaluate(() => {
  window.__DSH_PERF = {};
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__DSH_PERF.LCP = { value: entry.startTime, element: entry.element?.tagName };
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') window.__DSH_PERF.FCP = entry.startTime;
      }
    }).observe({ type: 'paint', buffered: true });

    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) {
      window.__DSH_PERF.nav = {
        domContentLoaded: nav.domContentLoadedEventEnd,
        loadComplete: nav.loadEventEnd,
        domInteractive: nav.domInteractive,
        ttfb: nav.responseStart,
      };
    }
  } catch(e) { window.__DSH_PERF.error = e.message; }
});

const start = Date.now();
await page.goto('http://127.0.0.1:3080', { waitUntil: 'load', timeout: 30000 });
const loadTime = Date.now() - start;
await page.waitForTimeout(5000);

const perf = await page.evaluate(() => window.__DSH_PERF || {});
const heap = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
const domNodes = await page.evaluate(() => document.querySelectorAll('*').length);

console.log('\n===== DSH Web Performance Baseline =====');
console.log(`Wall load: ${loadTime}ms`);
console.log(`FCP: ${perf.FCP?.toFixed(1) || 'N/A'}ms`);
console.log(`LCP: ${perf.LCP?.value?.toFixed(1) || 'N/A'}ms (${perf.LCP?.element || 'N/A'})`);
console.log(`DOM Interactive: ${perf.nav?.domInteractive?.toFixed(1) || 'N/A'}ms`);
console.log(`DOMContentLoaded: ${perf.nav?.domContentLoaded?.toFixed(1) || 'N/A'}ms`);
console.log(`Load Complete: ${perf.nav?.loadComplete?.toFixed(1) || 'N/A'}ms`);
console.log(`TTFB: ${perf.nav?.ttfb?.toFixed(1) || 'N/A'}ms`);
console.log(`JS Heap: ${(heap / 1048576).toFixed(1)} MB`);
console.log(`DOM Nodes: ${domNodes}`);
console.log(`Error: ${perf.error || 'none'}`);

// CDP metrics
try {
  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  const metrics = await client.send('Performance.getMetrics');
  console.log('\n--- CDP Performance Metrics ---');
  const names = ['FirstContentfulPaint', 'LargestContentfulPaint', 'DomContentLoaded', 'FirstMeaningfulPaint'];
  for (const m of metrics.metrics) {
    if (names.includes(m.name)) console.log(`  ${m.name}: ${(m.value * 1000).toFixed(1)}ms`);
  }
} catch(e) { console.log(`CDP: ${e.message}`); }

await browser.close();
