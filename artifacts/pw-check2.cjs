const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:8000/books/', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('.project-card, .project-card-featured, .mini-lab-card').length > 0, { timeout: 15000 });
  const cards = await page.$$eval('.project-card', (els) =>
    els.map((el) => ({
      text: el.textContent.slice(0, 250),
      html: el.outerHTML.slice(0, 180),
    }))
  );
  const hasDust = cards.some((card) => card.text.toLowerCase().includes('dust on the river'));
  const titles = await page.$$eval('.project-card', (els) =>
    els.map((el) => Array.from(el.querySelectorAll('h3, h2, h1, .project-title, .card-title, .media-caption, p')).map((n) => n.textContent).join(' | ').slice(0, 200))
  );
  console.log(JSON.stringify({count: cards.length, hasDust, titles: titles.filter((t) => t.toLowerCase().includes('dust')), cards: cards.slice(0,10)}, null, 2));
  await browser.close();
  await page;
})();
