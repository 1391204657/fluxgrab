/* NordVPN affiliate banner helpers (HasOffers / go.nordvpn.net) */
window.FluxGrabVpnAd = (function () {
  var DEFAULT_OFFER_ID = 15;
  var DEFAULT_AFF_ID = 152040;
  var configCache = null;

  function cfgIds(cfg) {
    cfg = cfg || {};
    return {
      offerId: cfg.offer_id || DEFAULT_OFFER_ID,
      affId: cfg.affiliate_id || DEFAULT_AFF_ID,
    };
  }

  function pickFileId(cfg, lang) {
    var banners = (cfg && cfg.banners) || {};
    var code = (lang || "en").trim();
    if (banners[code] && banners[code].file_id) return String(banners[code].file_id);
    var base = code.split("-")[0];
    if (banners[base] && banners[base].file_id) return String(banners[base].file_id);
    if (banners.en && banners.en.file_id) return String(banners.en.file_id);
    if (cfg && cfg.default_file_id) return String(cfg.default_file_id);
    return "";
  }

  function pickDirectSrc(cfg, lang) {
    var banners = (cfg && cfg.banners) || {};
    var code = (lang || "en").trim();
    if (banners[code] && banners[code].src) return banners[code].src;
    var base = code.split("-")[0];
    if (banners[base] && banners[base].src) return banners[base].src;
    if (banners.en && banners.en.src) return banners.en.src;
    return "";
  }

  function assetPrefix(cfg) {
    if (cfg && cfg.asset_prefix != null) return String(cfg.asset_prefix);
    if (typeof window !== "undefined" && window.FLUXGRAB_VPN_ASSET_PREFIX != null) {
      return String(window.FLUXGRAB_VPN_ASSET_PREFIX);
    }
    return "";
  }

  function resolveAssetPath(cfg, rel) {
    if (!rel) return "";
    if (/^https?:\/\//i.test(rel)) return rel;
    var prefix = assetPrefix(cfg);
    return prefix + String(rel).replace(/^\//, "");
  }

  /** Official tracked banner image (728×90 etc.) from Nord affiliate creatives. */
  function bannerImageUrl(cfg, fileId) {
    if (!fileId) return "";
    var ids = cfgIds(cfg);
    return (
      "https://go.nordvpn.net/aff_i?offer_id=" +
      encodeURIComponent(ids.offerId) +
      "&aff_id=" +
      encodeURIComponent(ids.affId) +
      "&file_id=" +
      encodeURIComponent(fileId)
    );
  }

  function resolveBanner(cfg, lang) {
    cfg = cfg || {};
    var fileId = pickFileId(cfg, lang);
    var src = pickDirectSrc(cfg, lang);
    if (src) src = resolveAssetPath(cfg, src);
    if (!src && cfg.default_src) src = resolveAssetPath(cfg, cfg.default_src);
    if (!src && fileId) src = bannerImageUrl(cfg, fileId);
    if (!src && cfg.default_file_id) src = bannerImageUrl(cfg, cfg.default_file_id);
    return { fileId: fileId, src: src || "" };
  }

  function loadConfig(url) {
    if (configCache) return Promise.resolve(configCache);
    return fetch(url)
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .then(function (data) {
        configCache = data && typeof data === "object" ? data : {};
        return configCache;
      })
      .catch(function () {
        configCache = {};
        return configCache;
      });
  }

  function clearCache() {
    configCache = null;
  }

  return {
    loadConfig: loadConfig,
    clearCache: clearCache,
    pickFileId: pickFileId,
    bannerImageUrl: bannerImageUrl,
    resolveBanner: resolveBanner,
    clickUrl: function (cfg, sub, lang) {
      var ids = cfgIds(cfg);
      var banners = (cfg && cfg.banners) || {};
      var code = (lang || "").trim();
      var entry = code && banners[code] ? banners[code] : null;
      if (entry && entry.click_url) return String(entry.click_url);
      var tag = sub || "fluxgrab";
      if (code && (!sub || sub.indexOf("fluxgrab") === 0)) tag = "fluxgrab-" + code;
      return (
        "https://go.nordvpn.net/aff_c?offer_id=" +
        encodeURIComponent(ids.offerId) +
        "&aff_id=" +
        encodeURIComponent(ids.affId) +
        "&aff_sub=" +
        encodeURIComponent(tag)
      );
    },
  };
})();
