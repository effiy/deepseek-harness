import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

// Extract token from the running server process
function getToken() {
  try {
    const pid = execSync("lsof -nP -tiTCP:3080 -sTCP:LISTEN 2>/dev/null | head -1", { encoding: 'utf8' }).trim();
    if (!pid) throw new Error('No process on 3080');
    const env = execSync(`ps eww -p ${pid} 2>/dev/null`, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    const match = env.match(/DSH_WEB_TOKEN=([^\s]+)/);
    if (!match) throw new Error('Token not found in env');
    return match[1];
  } catch (e) {
    console.error('Failed to get token:', e.message);
    process.exit(1);
  }
}

const TOKEN = getToken();
const BASE = `http://127.0.0.1:3080/?token=${TOKEN}`;

const BREAKPOINTS = [
  { name: 'mobile-375', width: 375, height: 812, scale: 2 },
  { name: 'tablet-768', width: 768, height: 1024, scale: 1 },
  { name: 'desktop-1024', width: 1024, height: 768, scale: 1 },
];

// Try navigating to different panels
const PANELS = [
  { name: 'chat', selector: '[aria-label*="Chat" i], [data-nav="chat"]' },
  { name: 'workspace', selector: '[aria-label*="Workspace" i]' },
  { name: 'settings', selector: '[aria-label*="Settings" i]' },
  { name: 'schedule', selector: '[aria-label*="Schedule" i]' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const outDir = '/tmp/dsh-responsive-audit-v2';
  await mkdir(outDir, { recursive: true });

  const findings = [];
  const overflowIssues = [];

  for (const bp of BREAKPOINTS) {
    console.log(`\n━━━ ${bp.name} (${bp.width}×${bp.height}) ━━━`);
    const context = await browser.newContext({
      viewport: { width: bp.width, height: bp.height },
      deviceScaleFactor: bp.scale,
    });
    const page = await context.newPage();

    try {
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
      const title = await page.title();
      console.log(`  Title: "${title}"`);

      // Wait for app to render (look for the frame)
      try {
        await page.waitForSelector('[data-sidebar-col], #dsh-main, .frame', { timeout: 10000 });
        console.log(`  ✅ App frame rendered`);
      } catch {
        console.log(`  ⚠️  App frame not found — page may be empty or auth failed`);
      }

      // Initial viewport screenshot
      await page.screenshot({ path: `${outDir}/${bp.name}-initial.png`, fullPage: false });
      console.log(`  💾 ${bp.name}-initial.png`);

      // Detect overflow elements
      const overflow = await page.evaluate(() => {
        const results = [];
        for (const el of document.querySelectorAll('*')) {
          const rect = el.getBoundingClientRect();
          if (rect.width > window.innerWidth + 3) {
            const cs = window.getComputedStyle(el);
            results.push({
              tag: el.tagName.toLowerCase(),
              class: (el.className && typeof el.className === 'string') ? String(el.className).slice(0, 80) : '',
              id: el.id || '',
              width: Math.round(rect.width),
              vw: window.innerWidth,
              over: Math.round(rect.width - window.innerWidth),
              overflow: cs.overflow,
              overflowX: cs.overflowX,
            });
          }
        }
        return results;
      });

      if (overflow.length > 0) {
        console.log(`  🔴 OVERFLOW: ${overflow.length} element(s)`);
        for (const item of overflow.slice(0, 8)) {
          console.log(`     ${item.tag}${item.class ? '.' + item.class : ''}${item.id ? '#' + item.id : ''}: ${item.width}px > ${item.vw}px (+${item.over}px)`);
        }
        overflowIssues.push({ breakpoint: bp.name, elements: overflow });
      } else {
        console.log(`  🟢 No overflow`);
      }

      // Check horizontal scroll
      const hScroll = await page.evaluate(() => ({
        hasHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      console.log(`  H-scroll: ${hScroll.hasHScroll ? '🔴 YES' : '🟢 No'} (scrollW=${hScroll.scrollW}, clientW=${hScroll.clientW})`);

      // Check for bottom nav visibility on mobile
      if (bp.name === 'mobile-375') {
        const bottomNav = await page.$('[data-shell-bottom] nav');
        console.log(`  Bottom nav: ${bottomNav ? '🟢 visible' : '🔴 hidden'}`);
      }

      // Try clicking sidebar toggle on mobile to capture sidebar overlay
      if (bp.name === 'mobile-375') {
        try {
          const hamburger = page.locator('[aria-label*="toggle sidebar" i], [aria-label*="导航" i]').first();
          if (await hamburger.isVisible({ timeout: 2000 }).catch(() => false)) {
            await hamburger.click();
            await page.waitForTimeout(600);
            await page.screenshot({ path: `${outDir}/${bp.name}-sidebar-open.png`, fullPage: false });
            console.log(`  💾 ${bp.name}-sidebar-open.png`);
          }
        } catch {}
      }

      // Full page screenshot
      await page.screenshot({ path: `${outDir}/${bp.name}-fullpage.png`, fullPage: true });
      console.log(`  💾 ${bp.name}-fullpage.png`);

      findings.push({
        breakpoint: bp.name,
        title,
        overflowCount: overflow.length,
        hasHScroll: hScroll.hasHScroll,
      });

    } catch (e) {
      console.log(`  ❌ ERROR: ${e.message}`);
    }
    await context.close();
  }

  await browser.close();

  // Write findings JSON
  const summary = {
    timestamp: new Date().toISOString(),
    url: BASE.replace(TOKEN, '[REDACTED]'),
    breakpoints: findings,
    overflowIssues,
  };
  await writeFile(`${outDir}/findings.json`, JSON.stringify(summary, null, 2));
  console.log(`\n📊 Summary written to ${outDir}/findings.json`);
  console.log(`📁 Screenshots: ${outDir}/`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
