/* FluxGrab website analytics — sends events to api.fluxgrab.com */
window.FluxGrabAnalytics = (function () {
  var API = "https://api.fluxgrab.com/v1/events";

  function send(event, meta) {
    try {
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: event,
          path: location.pathname + location.search + location.hash,
          referrer: document.referrer || "",
          lang: document.documentElement.lang || navigator.language || "",
          meta: meta || {},
        }),
        keepalive: true,
      });
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      send("pageview");
    });
  } else {
    send("pageview");
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-download-win], [data-buy-link], .sponsor-banner, .ad-slot a");
    if (!el) return;
    if (el.matches("[data-download-win]")) send("download_win");
    else if (el.matches("[data-buy-link]")) send("buy_click");
    else if (el.closest(".sponsor-banner") || el.closest(".ad-slot")) send("ad_click");
  });

  document.querySelectorAll(".sponsor-banner, .ad-slot").forEach(function (node) {
    if (node && !node.hidden) send("ad_impression", { slot: node.className || node.id });
  });

  return { track: send };
})();
