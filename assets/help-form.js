(function () {
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  var form = document.getElementById("feedbackForm");
  if (!form) return;

  function msg(key) {
    return window.FluxGrabI18n ? FluxGrabI18n.t(FluxGrabI18n.getLang(), key) : key;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var status = document.getElementById("feedbackStatus");
    var email = form.email.value.trim();
    var message = form.message.value.trim();
    status.hidden = false;
    status.textContent = msg("help.form.sending");
    status.className = "feedback-status";
    fetch("https://api.fluxgrab.com/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "feedback",
        path: location.pathname + location.hash,
        referrer: document.referrer || "",
        lang: document.documentElement.lang || "",
        meta: { email: email, message: message },
      }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok) {
          status.textContent = msg("help.form.ok");
          status.classList.add("ok");
          form.reset();
        } else {
          status.textContent = (res.d && res.d.error) || msg("help.form.err");
          status.classList.add("err");
        }
      })
      .catch(function () {
        status.textContent = msg("help.form.net");
        status.classList.add("err");
      });
  });
})();
