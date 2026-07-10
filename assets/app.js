/*
 * FluxGrab site config.
 */
window.FLUXGRAB_CONFIG = {
  WEB_APP_URL: "/",
  PAYMENT_LINK_URL: "https://buy.stripe.com/6oU9AUb9Z1DRd0U5dv0x201",
  CHECKOUT_API: "https://api.fluxgrab.com/v1/checkout/session",
  PREMIUM_URL: "/premium.html",
  DOWNLOAD_WIN_URL: "https://github.com/1391204657/fluxgrab/releases/latest/download/FluxGrab-Windows.zip",
  COBALT_API_URL: "https://api.fluxgrab.com/",
  MEDIA_PARSE_URL: "https://api.fluxgrab.com/v1/media/parse",
  // Fallback if API /v1/ads is unreachable
  VPN_AFFILIATE_URL: "https://go.nordvpn.net/aff_c?offer_id=15&aff_id=152040&aff_sub=fluxgrab",
  VPN_NAME: "NordVPN",
};

(function () {
  var cfg = window.FLUXGRAB_CONFIG || {};
  var sponsorUrl = "";
  var vpnBannerCfg = null;

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function t(key) {
    return window.FluxGrabI18n ? FluxGrabI18n.t(key) : key;
  }

  function currentLang() {
    return window.FluxGrabI18n ? FluxGrabI18n.getLang() : "en";
  }

  function apiBase() {
    var api = (cfg.COBALT_API_URL || "").replace(/\/$/, "");
    return api.indexOf("api.") !== -1 ? api : "";
  }

  function fetchSponsorUrl() {
    var base = apiBase();
    if (!base) return Promise.resolve(cfg.VPN_AFFILIATE_URL || "");
    return fetch(base + "/v1/ads")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return (d && d.vpn_url) || cfg.VPN_AFFILIATE_URL || ""; })
      .catch(function () { return cfg.VPN_AFFILIATE_URL || ""; });
  }

  function renderSponsorAd() {
    var wrap = document.getElementById("sponsorAd");
    if (!wrap) return;
    if (!sponsorUrl || sponsorUrl === "#") {
      wrap.hidden = true;
      wrap.innerHTML = "";
      return;
    }
    var banner = window.FluxGrabVpnAd
      ? FluxGrabVpnAd.resolveBanner(vpnBannerCfg, currentLang())
      : { src: "" };
    if (!banner.src) {
      wrap.hidden = true;
      wrap.innerHTML = "";
      return;
    }
    var name = cfg.VPN_NAME || "NordVPN";
    wrap.innerHTML =
      '<a class="sponsor-banner" href="' + esc(sponsorUrl) + '" target="_blank" rel="nofollow sponsored noopener" aria-label="' + esc(name) + '">' +
        '<span class="sponsor-ad-label">' + esc(t("ad.label")) + '</span>' +
        '<img class="sponsor-banner-img" src="' + esc(banner.src) + '" width="728" height="90" alt="' + esc(name) + '" />' +
      '</a>';
    wrap.hidden = false;
  }

  document.querySelectorAll("[data-app-link]").forEach(function (a) {
    if (cfg.WEB_APP_URL && cfg.WEB_APP_URL !== "#") {
      a.href = cfg.WEB_APP_URL;
      a.target = "_blank";
      a.rel = "noopener";
    }
  });

  function premiumPageUrl() {
    var base = (cfg.PREMIUM_URL || "premium.html").replace(/#.*$/, "");
    var lang = "";
    try { lang = localStorage.getItem("fluxgrab_lang") || ""; } catch (e) { /* ignore */ }
    var q = lang && lang !== "en" ? "?lang=" + encodeURIComponent(lang) : "";
    return base + q + "#payment";
  }

  document.querySelectorAll("[data-buy-link]").forEach(function (a) {
    a.href = premiumPageUrl();
    a.removeAttribute("target");
  });

  document.addEventListener("fluxgrab:lang", function () {
    document.querySelectorAll(".refund-shield [data-i18n]").forEach(function (el) {
      if (window.FluxGrabI18n) el.textContent = FluxGrabI18n.t(el.getAttribute("data-i18n"));
    });
    renderSponsorAd();
  });

  document.querySelectorAll("[data-download-win]").forEach(function (a) {
    if (cfg.DOWNLOAD_WIN_URL && cfg.DOWNLOAD_WIN_URL !== "#") {
      a.href = cfg.DOWNLOAD_WIN_URL;
      a.setAttribute("download", "FluxGrab-Windows.zip");
    }
  });

  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  fetchSponsorUrl().then(function (url) {
    sponsorUrl = (url || "").trim();
    var bannerLoad = window.FluxGrabVpnAd
      ? FluxGrabVpnAd.loadConfig("assets/ads/vpn-banners.json").then(function (data) {
          vpnBannerCfg = data;
        })
      : Promise.resolve();
    return bannerLoad.then(renderSponsorAd);
  });
})();
