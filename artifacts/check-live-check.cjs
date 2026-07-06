const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://samfa12.com/books/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
  const cards = await page.$$eval('.project-card', els => els.map((el) => (el.textContent || '').toLowerCase().includes('dust on the river')));
  const has = cards.includes(true);
  const first = await page.$$eval('.project-card', els => els.map((el) => (el.textContent||'').trim().slice(0,140)).filter(Boolean).slice(0,5));
  console.log(JSON.stringify({url: page.url(), hasDust: has, sample: first}, null, 2));
  await browser.close();
})();
