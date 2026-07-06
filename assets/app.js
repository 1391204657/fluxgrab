/*
 * FluxGrab site config.
 * 把下面几个链接换成你自己的真实地址即可上线：
 *   WEB_APP_URL     —— 在线体验版（部署好的解析后端/前端）地址
 *   BUY_URL         —— Lemon Squeezy / Paddle / Gumroad 的结账链接
 *   DOWNLOAD_WIN_URL—— Windows 安装包下载地址（如 GitHub Releases）
 */
window.FLUXGRAB_CONFIG = {
  WEB_APP_URL: "app.html",   // 在线下载页（X/TikTok/IG）
  BUY_URL: "https://fluxgrab.lemonsqueezy.com/checkout/buy/5c4a5f2a-430f-4b3a-a975-119edddab862",
  DOWNLOAD_WIN_URL: "https://github.com/1391204657/fluxgrab/releases/latest/download/FluxGrab-Windows.zip",

  // 在线解析后端（cobalt 实例）。
  COBALT_API_URL: "https://api.fluxgrab.com/",

  // VPN 联盟广告位（可选增收）。填了才显示，留空则隐藏。
  VPN_AFFILIATE_URL: "",                 // e.g. "https://go.nordvpn.net/aff_c?...."
  VPN_NAME: "NordVPN",                   // 展示名
  VPN_PITCH: "解锁区域限制内容 · 加密你的下载 · 30 天退款", // 一句话卖点
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

  // VPN 联盟广告位：填了 VPN_AFFILIATE_URL 才渲染
  var ad = document.getElementById("vpnAd");
  if (ad && cfg.VPN_AFFILIATE_URL && cfg.VPN_AFFILIATE_URL !== "#") {
    var name = cfg.VPN_NAME || "VPN";
    var pitch = cfg.VPN_PITCH || "";
    ad.innerHTML =
      '<span class="vpn-tag">推荐</span>' +
      '<div class="vpn-body"><strong>' + name + '</strong>' +
      (pitch ? '<span>' + pitch + '</span>' : '') + '</div>' +
      '<a class="btn btn-primary" href="' + cfg.VPN_AFFILIATE_URL + '" target="_blank" rel="nofollow sponsored noopener">了解一下</a>';
    ad.hidden = false;
  }
})();
