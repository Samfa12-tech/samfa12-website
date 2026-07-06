const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:8000/books/', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('.project-card, .project-card-featured, .mini-lab-card').length > 0, { timeout: 15000 });
  const info = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.project-card'));
    const target = cards.find((card) => (card.textContent || '').toLowerCase().includes('dust on the river'));
    if (!target) return { hasDust: false };
    const img = target.querySelector('img');
    const links = Array.from(target.querySelectorAll('a')).map((a) => a.textContent?.trim()).filter(Boolean);
    return {
      hasDust: true,
      imageSrc: img ? img.getAttribute('src') : null,
      alt: img ? img.getAttribute('alt') : null,
      links,
    };
  });
  const output = path.join(process.cwd(), 'artifacts', 'dust-books-thumb-check.png');
  await page.screenshot({ path: output, fullPage: true });
  await browser.close();
  console.log(JSON.stringify({ ...info, screenshot: output, screenshotWeb: output.replace(/\\/g, '/') }, null, 2));
})();
