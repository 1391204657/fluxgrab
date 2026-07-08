/* Premium page — payment method picker + Stripe Checkout */
(function () {
  var cfg = window.FLUXGRAB_CONFIG || {};
  var checkoutApi = cfg.CHECKOUT_API || "https://api.fluxgrab.com/v1/checkout/session";

  function t(key) {
    if (!window.FluxGrabI18n) return key;
    return FluxGrabI18n.t(key);
  }

  function currentLang() {
    if (window.FluxGrabI18n && FluxGrabI18n.lang) return FluxGrabI18n.lang();
    return "en";
  }

  function openCheckout() {
    var btn = document.getElementById("payModalGo");
    var prevLabel = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = t("premium.pay.modal.loading") || "Opening checkout…";
    }

    fetch(checkoutApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: currentLang() }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (res) {
        if (res.ok && res.data && res.data.url) {
          window.location.href = res.data.url;
          return;
        }
        var msg =
          (res.data && res.data.error) ||
          t("premium.pay.modal.error") ||
          "Checkout is temporarily unavailable. Email support@fluxgrab.com.";
        alert(msg);
      })
      .catch(function () {
        alert(
          t("premium.pay.modal.error") ||
            "Checkout is temporarily unavailable. Email support@fluxgrab.com."
        );
      })
      .finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prevLabel || t("premium.pay.modal.btn");
        }
      });
  }

  function closeModal() {
    var modal = document.getElementById("payModal");
    if (modal) modal.hidden = true;
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
      unionpay: ["assets/pay/unionpay.png"],
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
    var paymentBtn = document.getElementById("paymentBtn");
    if (paymentBtn) {
      paymentBtn.addEventListener("click", function (e) {
        var target = document.getElementById("payment");
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }

    document.querySelectorAll(".pay-item[data-pay]").forEach(function (el) {
      function activate() {
        openPayModal(el.getAttribute("data-pay"));
      }
      el.addEventListener("click", activate);
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
    });

    var go = document.getElementById("payModalGo");
    if (go)
      go.addEventListener("click", function () {
        openCheckout();
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
        var method = modal.getAttribute("data-active-pay");
        if (method) openPayModal(method);
      }
    });

    if (location.hash === "#payment") {
      var paySection = document.getElementById("payment");
      if (paySection) {
        setTimeout(function () {
          paySection.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
