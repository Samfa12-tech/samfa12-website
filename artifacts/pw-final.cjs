const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const targets = [
    { name: 'home', url: 'http://localhost:8000/' },
    { name: 'books', url: 'http://localhost:8000/books/' },
  ];
  for (const target of targets) {
    const page = await browser.newPage();
    await page.goto(target.url, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('.project-card, .project-card-featured, .mini-lab-card').length > 0, { timeout: 15000 });
    const out = path.join(process.cwd(), 'artifacts', `final-${target.name}-dust-check.png`);
    await page.screenshot({ path: out, fullPage: true });
    await page.close();
  }
  await browser.close();
})();
