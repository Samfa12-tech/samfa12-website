const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const pages = [
    { url: "http://localhost:8000/", file: "dust-home-browser-check.png" },
    { url: "http://localhost:8000/books/", file: "dust-books-browser-check.png" }
  ];
  const out = [];
  for (const item of pages) {
    const page = await browser.newPage();
    await page.goto(item.url, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll(".project-card").length > 0, { timeout: 15000 });
    const hasDust = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".project-card-title")).some((node) =>
        node?.textContent?.toLowerCase().includes("dust on the river")
      );
    });
    const cardCount = await page.$$eval(".project-card", cards => cards.length);
    const output = path.join(process.cwd(), "artifacts", item.file);
    await page.screenshot({ path: output, fullPage: true });
    out.push({ url: item.url, cards: cardCount, hasDust, screenshot: output, path: output.replace(/\\/g, "/") });
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(out, null, 2));
})();
