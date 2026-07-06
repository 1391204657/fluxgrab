/* Premium page — payment method picker + checkout modal */
(function () {
  var cfg = window.FLUXGRAB_CONFIG || {};
  var buyUrl = cfg.BUY_URL || "";

  function t(key) {
    if (!window.FluxGrabI18n) return key;
    return FluxGrabI18n.t(FluxGrabI18n.getLang(), key);
  }

  function openCheckout(method) {
    if (!buyUrl || buyUrl === "#") return;
    var panel = document.querySelector(".pay-modal-panel");
    var wallet = method === "alipay" || method === "wechat";
    if (panel) panel.classList.toggle("pay-modal-wide", wallet);

    var frame = document.getElementById("payCheckoutFrame");
    var wrap = document.getElementById("payModalIframeWrap");
    if (wallet && frame && wrap) {
      frame.src = buyUrl;
      wrap.hidden = false;
      wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    if (window.LemonSqueezy && window.LemonSqueezy.Url && LemonSqueezy.Url.Open) {
      LemonSqueezy.Url.Open(buyUrl);
      return;
    }
    if (frame && wrap) {
      frame.src = buyUrl;
      wrap.hidden = false;
      return;
    }
    window.open(buyUrl, "_blank", "noopener,noreferrer");
  }

  function closeModal() {
    var modal = document.getElementById("payModal");
    var frame = document.getElementById("payCheckoutFrame");
    var wrap = document.getElementById("payModalIframeWrap");
    if (modal) modal.hidden = true;
    if (frame) frame.src = "about:blank";
    if (wrap) wrap.hidden = true;
    document.body.classList.remove("pay-modal-open");
  }

  function openPayModal(method) {
    var modal = document.getElementById("payModal");
    var icon = document.getElementById("payModalIcon");
    var title = document.getElementById("payModalTitle");
    var body = document.getElementById("payModalBody");
    var qr = document.getElementById("payModalQrHint");
    var btn = document.getElementById("payModalGo");
    if (!modal) return;

    var iconMap = {
      card: ["assets/pay/visa.svg", "assets/pay/mastercard.svg"],
      paypal: ["assets/pay/paypal.svg"],
      apple: ["assets/pay/apple-pay.svg"],
      google: ["assets/pay/google-pay.png"],
      alipay: ["assets/pay/alipay.png"],
      wechat: ["assets/pay/wechat-pay.svg"],
      unionpay: ["assets/pay/unionpay.svg"],
    };

    if (icon) {
      icon.innerHTML = "";
      (iconMap[method] || []).forEach(function (src) {
        var img = document.createElement("img");
        img.src = src;
        img.alt = "";
        img.width = 48;
        img.height = 32;
        if (src.indexOf(".png") !== -1) img.className = "pay-icon-square";
        icon.appendChild(img);
      });
    }

    var base = "premium.pay.modal." + method;
    if (title) title.textContent = t(base + ".title");
    if (body) body.textContent = t(base + ".body");
    if (qr) {
      var wallet = method === "alipay" || method === "wechat";
      qr.hidden = !wallet;
      if (wallet) qr.textContent = t("premium.pay.modal.qrHint");
    }
    if (btn) btn.textContent = t("premium.pay.modal.btn");

    modal.hidden = false;
    document.body.classList.add("pay-modal-open");
    modal.setAttribute("data-active-pay", method);

    if (window.FluxGrabAnalytics) FluxGrabAnalytics.track("buy_click", { method: method });
  }

  function bind() {
    document.querySelectorAll(".pay-item[data-pay]").forEach(function (el) {
      function activate() { openPayModal(el.getAttribute("data-pay")); }
      el.addEventListener("click", activate);
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
      });
    });

    var go = document.getElementById("payModalGo");
    if (go) go.addEventListener("click", function () {
      var modal = document.getElementById("payModal");
      var method = modal && modal.getAttribute("data-active-pay");
      openCheckout(method);
    });

    document.querySelectorAll("[data-pay-close]").forEach(function (el) {
      el.addEventListener("click", closeModal);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });

    document.addEventListener("fluxgrab:lang", function () {
      var modal = document.getElementById("payModal");
      if (modal && !modal.hidden) {
        var active = document.querySelector(".pay-item[data-pay].active-method");
        if (active) openPayModal(active.getAttribute("data-pay"));
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
