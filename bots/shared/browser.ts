import chromium from '@sparticuz/chromium';
import puppeteer, { Browser } from 'puppeteer-core';

let browserPromise: Promise<Browser>;

export const initializeBrowser = async () => {
  const browser = await puppeteer.launch({
    args: puppeteer.defaultArgs({ args: chromium.args }),
    executablePath: await chromium.executablePath(),
    acceptInsecureCerts: true,
  });

  return browser;
};

export const setupBrowser = () => {
  if (!browserPromise) {
    browserPromise = initializeBrowser();
  }

  return browserPromise;
};
