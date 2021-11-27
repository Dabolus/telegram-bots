import chromium from 'chrome-aws-lambda';
import type { Browser } from 'puppeteer-core';

let browserPromise: Promise<Browser>;

export const initializeBrowser = async () => {
  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
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
