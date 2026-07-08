/* Premium page — Stripe Payment Link checkout */
(function () {
  var cfg = window.FLUXGRAB_CONFIG || {};
  var paymentLink =
    cfg.PAYMENT_LINK_URL || "https://buy.stripe.com/6oU9AUb9Z1DRd0U5dv0x201";

  function t(key) {
    if (!window.FluxGrabI18n) return key;
    return FluxGrabI18n.t(key);
  }

  function openCheckout(method) {
    if (window.FluxGrabAnalytics) {
      FluxGrabAnalytics.track("buy_click", { method: method || "stripe" });
    }
    window.location.href = paymentLink;
  }

  function bind() {
    var paymentBtn = document.getElementById("paymentBtn");
    if (paymentBtn) {
      paymentBtn.addEventListener("click", function (e) {
        e.preventDefault();
        openCheckout("cta");
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
