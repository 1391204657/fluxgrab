/* Premium page — Stripe Checkout Session (supports WeChat Pay QR) */
(function () {
  var cfg = window.FLUXGRAB_CONFIG || {};
  var paymentLink =
    cfg.PAYMENT_LINK_URL || "https://buy.stripe.com/6oU9AUb9Z1DRd0U5dv0x201";
  var checkoutApi = (cfg.CHECKOUT_API || "").replace(/\/$/, "");

  function t(key) {
    if (!window.FluxGrabI18n) return key;
    return FluxGrabI18n.t(key);
  }

  function currentLang() {
    try {
      var q = new URLSearchParams(location.search).get("lang");
      if (q) return q;
    } catch (e) { /* ignore */ }
    if (window.FluxGrabI18n && FluxGrabI18n.getLang) return FluxGrabI18n.getLang();
    try {
      return localStorage.getItem("fluxgrab_lang") || "en";
    } catch (e2) {
      return "en";
    }
  }

  function openCheckout(method) {
    if (window.FluxGrabAnalytics) {
      FluxGrabAnalytics.track("buy_click", { method: method || "auto" });
    }
    if (!checkoutApi) {
      window.location.href = paymentLink;
      return;
    }
    var btn = document.getElementById("paymentBtn");
    if (btn) btn.classList.add("is-loading");
    fetch(checkoutApi, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ lang: currentLang(), method: method || "auto" }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { ok: r.ok, data: d };
        });
      })
      .then(function (res) {
        if (res.ok && res.data && res.data.url) {
          window.location.href = res.data.url;
          return;
        }
        throw new Error((res.data && res.data.error) || "checkout");
      })
      .catch(function () {
        window.location.href = paymentLink;
      })
      .finally(function () {
        if (btn) btn.classList.remove("is-loading");
      });
  }

  function bind() {
    var paymentBtn = document.getElementById("paymentBtn");
    if (paymentBtn) {
      paymentBtn.addEventListener("click", function (e) {
        e.preventDefault();
        openCheckout("auto");
      });
    }

    document.querySelectorAll(".pay-item[data-pay]").forEach(function (el) {
      function activate() {
        if (el.hasAttribute("data-pay-pending")) {
          alert(t("premium.pay.pendingAlert"));
          return;
        }
        openCheckout(el.getAttribute("data-pay"));
      }
      el.addEventListener("click", activate);
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
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
