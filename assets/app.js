/*
 * FluxGrab site config.
 * 把下面几个链接换成你自己的真实地址即可上线：
 *   WEB_APP_URL     —— 在线体验版（部署好的解析后端/前端）地址
 *   BUY_URL         —— Lemon Squeezy / Paddle / Gumroad 的结账链接
 *   DOWNLOAD_WIN_URL—— Windows 安装包下载地址（如 GitHub Releases）
 */
window.FLUXGRAB_CONFIG = {
  WEB_APP_URL: "app.html",   // 在线下载页（X/TikTok/IG）
  BUY_URL: "#",              // e.g. "https://fluxgrab.lemonsqueezy.com/buy/xxxx"
  DOWNLOAD_WIN_URL: "#",     // e.g. "https://github.com/<you>/fluxgrab/releases/latest"

  // 在线解析后端（cobalt 实例）。
  COBALT_API_URL: "https://api.fluxgrab.com/",
};

(function () {
  var cfg = window.FLUXGRAB_CONFIG || {};

  document.querySelectorAll("[data-app-link]").forEach(function (a) {
    if (cfg.WEB_APP_URL && cfg.WEB_APP_URL !== "#") { a.href = cfg.WEB_APP_URL; a.target = "_blank"; a.rel = "noopener"; }
  });
  document.querySelectorAll("[data-buy-link]").forEach(function (a) {
    if (cfg.BUY_URL && cfg.BUY_URL !== "#") { a.href = cfg.BUY_URL; }
  });
  document.querySelectorAll("[data-download-win]").forEach(function (a) {
    if (cfg.DOWNLOAD_WIN_URL && cfg.DOWNLOAD_WIN_URL !== "#") { a.href = cfg.DOWNLOAD_WIN_URL; }
  });

  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();
