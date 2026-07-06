const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('.project-card-featured, .project-card').length > 0, { timeout: 15000 });
  const hasDust = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.project-card, .project-card-featured, .mini-lab-card'));
    return cards.some((el) => (el.textContent || '').toLowerCase().includes('dust on the river'));
  });
  const cards = await page.$$eval('.project-card-featured, .project-card', (els) =>
    els.map((el) => (el.textContent || '').trim().slice(0, 180))
  );
  const dustInTop = cards.filter((text) => text.toLowerCase().includes('dust on the river'));
  console.log(JSON.stringify({hasDust, totalCards: cards.length, topDustMatches: dustInTop}, null, 2));
  await browser.close();
})();
