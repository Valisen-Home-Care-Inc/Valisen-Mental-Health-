const puppeteer = require("puppeteer");
const path = require("path");

const PAGES = [
  { name: "Home", url: "http://localhost:3000" },
  { name: "Services", url: "http://localhost:3000/services" },
  { name: "Intake", url: "http://localhost:3000/intake" },
  { name: "About", url: "http://localhost:3000/about" },
];

const VIEWPORT = { width: 1280, height: 720 };

async function screenshot() {
  const browser = await puppeteer.launch();

  try {
    for (const p of PAGES) {
      console.log(`📸 Screenshotting ${p.name}...`);
      const page = await browser.newPage();
      await page.setViewport(VIEWPORT);
      await page.goto(p.url, { waitUntil: "networkidle2" });

      const imagePath = path.join(__dirname, `screenshot-${p.name.toLowerCase()}.png`);
      await page.screenshot({ path: imagePath, fullPage: true });
      console.log(`✓ Saved ${imagePath}`);
      await page.close();
    }

    console.log("\n✅ Done! Screenshots saved. Use an image-to-PDF converter to combine them.");
  } finally {
    await browser.close();
  }
}

screenshot().catch(console.error);
