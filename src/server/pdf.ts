import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const CANDIDATE_CHROMIUM_PATHS = [
  process.env.CHROMIUM_PATH,
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean) as string[];

function findChromiumExecutable(): string {
  for (const candidate of CANDIDATE_CHROMIUM_PATHS) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    'Chromium executable not found. Set CHROMIUM_PATH or run inside the DeckPress Docker container.',
  );
}

// Serialize PDF jobs so small VPS instances never OOM from parallel Chromium launches.
let exportQueue: Promise<unknown> = Promise.resolve();

export function renderHtmlToPdf(html: string): Promise<Buffer> {
  const job = exportQueue.then(async () => {
    const executablePath = findChromiumExecutable();
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        const imgs = Array.from(document.images);
        await Promise.all(
          imgs.map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise((res) => {
                  img.onload = res;
                  img.onerror = res;
                }),
          ),
        );
      });
      const pdfBytes = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      return Buffer.from(pdfBytes);
    } finally {
      await browser.close();
    }
  });

  // Keep queue alive even if one job fails
  exportQueue = job.catch(() => {});
  return job;
}
