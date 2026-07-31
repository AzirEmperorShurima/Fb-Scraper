import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";

chromium.use(stealthPlugin());

export function getRandomProxy(dbProxies = []) {
  let proxyList = [];
  try {
    if (dbProxies && Array.isArray(dbProxies)) {
      const activeProxies = dbProxies.filter(p => p.status === 'active' && p.server);
      proxyList = proxyList.concat(activeProxies);
    }
    if (process.env.PROXY_GATEWAY) {
      proxyList.push(process.env.PROXY_GATEWAY);
    }
    const proxyFile = path.resolve(process.cwd(), "proxies.json");
    if (fs.existsSync(proxyFile)) {
      const rawData = fs.readFileSync(proxyFile, 'utf8');
      const sanitizedData = rawData.replace(/^\s*\/\/.*$/gm, '');
      const data = JSON.parse(sanitizedData);
      if (Array.isArray(data)) {
         proxyList = proxyList.concat(data);
      }
    }
  } catch(e) {
    console.error("Lỗi đọc danh sách proxy:", e.message);
  }
  
  if (proxyList.length > 0) {
    const selected = proxyList[Math.floor(Math.random() * proxyList.length)];
    if (typeof selected === 'string') {
      if (selected.startsWith("http")) {
         try {
           const url = new URL(selected);
           return {
             server: `${url.protocol}//${url.hostname}:${url.port}`,
             username: url.username,
             password: url.password
           };
         } catch(e) {}
      }
      return { server: selected };
    }
    return {
      server: selected.server.includes("://") ? selected.server : `http://${selected.server}`,
      username: selected.username,
      password: selected.password,
      type: selected.type
    };
  }
  return undefined;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0"
];

export async function setupBrowser({
  userDataDir = null,
  webrtcDefense = true,
  realIpDefense = true,
  proxies = [],
  logMsg = console.log
}) {
  const proxy = getRandomProxy(proxies);
  if (proxy) logMsg(`🌐 Sử dụng Proxy: ${proxy.server} ${proxy.type ? `(${proxy.type})` : ''}`);

  const proxyConfig = proxy ? { server: proxy.server, username: proxy.username, password: proxy.password } : undefined;

  let browser;
  let context;

  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const timezones = ['Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Jakarta'];
  const timezoneId = timezones[Math.floor(Math.random() * timezones.length)];

  const browserArgs = [
    "--disable-notifications",
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox",
    "--disable-setuid-sandbox"
  ];

  if (webrtcDefense) {
    browserArgs.push(
      "--enforce-webrtc-ip-permission-check",
      "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      "--disable-rtc-smoothness-algorithm",
      "--disable-webrtc-hw-decoding"
    );
  }

  if (realIpDefense) {
    browserArgs.push(
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-site-isolation-trials"
    );
  }

  if (userDataDir) {
    logMsg(`🚀 Khởi chạy Real Chrome Profile từ: ${userDataDir}`);
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      proxy: proxyConfig,
      args: browserArgs,
      userAgent,
      viewport: { 
        width: 1280 + Math.floor(Math.random() * 200 - 100), 
        height: 800 + Math.floor(Math.random() * 200 - 100) 
      },
      timezoneId,
      locale: 'vi-VN'
    });
  } else {
    browser = await chromium.launch({
      headless: false,
      proxy: proxyConfig,
      args: browserArgs
    });

    context = await browser.newContext({
      userAgent,
      viewport: { 
        width: 1280 + Math.floor(Math.random() * 200 - 100), 
        height: 800 + Math.floor(Math.random() * 200 - 100) 
      },
      timezoneId,
      locale: 'vi-VN'
    });
  }

  return { browser, context };
}
