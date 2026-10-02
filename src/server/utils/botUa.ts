// Comprehensive bot/crawler/headless UA filter, shared by analytics + live-visitor tracking.
export const BOT_UA = new RegExp(
  [
    // Generic bot/crawler markers
    "bot", "crawl", "spider", "slurp", "scraper", "scan", "fetch", "checker",
    "monitor", "probe", "ping", "audit", "inspect", "preview", "snapshot",
    // Named crawlers & search engines
    "googlebot", "bingbot", "yandexbot", "baiduspider", "duckduckbot",
    "sogou", "exabot", "facebot", "ia_archiver", "ahrefsbot", "semrushbot",
    "dotbot", "mj12bot", "rogerbot", "screaming frog", "seokicks",
    "sistrix", "linkdexbot", "blexbot", "seobilitybot", "dataforseo",
    "majestic", "serpstat", "bytespider", "petalbot",
    // Social / link preview bots
    "facebookexternalhit", "twitterbot", "linkedinbot", "whatsapp",
    "slackbot", "discordbot", "telegrambot", "viber", "line-poker",
    "applebot", "pinterest", "tumblr",
    // HTTP tools / scripts
    "python", "curl", "wget", "axios", "got", "node-fetch", "java",
    "ruby", "perl", "go-http", "okhttp", "libwww", "lwp",
    "httpclient", "httpunit", "requests", "urllib",
    // Headless browsers
    "headlesschrome", "phantomjs", "selenium", "puppeteer", "playwright",
    "webdriver", "cypress",
    // Security / uptime scanners
    "zgrab", "masscan", "nmap", "nikto", "nuclei", "shodan",
    "censys", "qualys", "netcraft", "uptimerobot", "statuscake",
    "pingdom", "newrelic", "datadog", "freshping", "hetrixtools",
  ].join("|"),
  "i",
);

// Meta (AS32934) data centers — e.g. Prineville, US. They render ad/link
// previews with a normal mobile UA and run our JS, so the UA filter misses
// them; no real visitor browses from these networks.
const META_IPV4_CIDRS = [
  "31.13.24.0/21", "31.13.64.0/18", "45.64.40.0/22", "57.141.0.0/16", "57.144.0.0/14",
  "66.220.144.0/20", "69.63.176.0/20", "69.171.224.0/19", "74.119.76.0/22", "102.132.96.0/20",
  "103.4.96.0/22", "129.134.0.0/16", "147.75.208.0/20", "157.240.0.0/16", "163.70.128.0/17",
  "173.252.64.0/18", "179.60.192.0/22", "185.60.216.0/22", "185.89.216.0/22", "204.15.20.0/22",
].map((cidr) => {
  const [base, bits] = cidr.split("/");
  const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return { net: (ipv4ToInt(base)! & mask) >>> 0, mask };
});

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function isCrawlerIp(rawIp: string): boolean {
  const ip = rawIp.trim().toLowerCase().replace(/^::ffff:/, "");
  if (ip.startsWith("2a03:2880:")) return true;
  const n = ipv4ToInt(ip);
  return n !== null && META_IPV4_CIDRS.some(({ net, mask }) => ((n & mask) >>> 0) === net);
}
