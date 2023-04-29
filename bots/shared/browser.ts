import chromium from '@sparticuz/chromium';
import puppeteer, { Browser } from 'puppeteer-core';

let browserPromise: Promise<Browser>;

export const initializeBrowser = async () => {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });

  return browser;
};

export const setupBrowser = () => {
  if (!browserPromise) {
    browserPromise = initializeBrowser();
  }

  return browserPromise;
};
