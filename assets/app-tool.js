/*
 * FluxGrab 在线下载页逻辑。
 *
 * 策略（混合模式）：
 *   - X(Twitter) / TikTok / Instagram 等：调用自建的 cobalt 兼容后端在线解析下载。
 *   - YouTube / 成人站 / 需要更高清晰度：引导使用桌面版（免费版每天 2 次）。
 *
 * 后端地址在 assets/app.js 的 FLUXGRAB_CONFIG.COBALT_API_URL 里配置。
 */
(function () {
  var cfg = window.FLUXGRAB_CONFIG || {};

  function L(key, vars) {
    return window.FluxGrabI18n ? FluxGrabI18n.t(key, vars) : key;
  }

  function track(ev, meta) {
    if (window.FluxGrabAnalytics) FluxGrabAnalytics.track(ev, meta || {});
  }

  var API = (cfg.COBALT_API_URL || "").trim();

  var urlInput = document.getElementById("url");
  var clearBtn = document.getElementById("clearBtn");
  var goBtn = document.getElementById("goBtn");
  var hint = document.getElementById("platformHint");
  var result = document.getElementById("result");

  var lastRun = null;

  var ONLINE = [
    { k: ["twitter.com", "x.com", "t.co"], name: "X (Twitter)" },
    { k: ["tiktok.com"], name: "TikTok" },
    { k: ["instagram.com", "instagr.am"], name: "Instagram" },
    { k: ["facebook.com", "fb.watch"], name: "Facebook" },
    { k: ["reddit.com", "redd.it"], name: "Reddit" },
    { k: ["twitch.tv"], name: "Twitch" },
    { k: ["tumblr.com"], name: "Tumblr" },
    { k: ["vimeo.com"], name: "Vimeo" },
    { k: ["dailymotion.com", "dai.ly"], name: "Dailymotion" },
    { k: ["streamable.com"], name: "Streamable" },
    { k: ["soundcloud.com"], name: "SoundCloud" },
    { k: ["bsky.app"], name: "Bluesky" },
    { k: ["snapchat.com"], name: "Snapchat" },
    { k: ["pinterest.com", "pin.it"], name: "Pinterest" }
  ];
  var DESKTOP = [
    { k: ["youtube.com", "youtu.be"], name: "YouTube" },
    { k: ["pornhub.com", "xvideos.com", "xhamster.com", "redtube.com", "youporn.com", "spankbang.com"], generic: true },
    { k: ["bilibili.com", "b23.tv"], name: "Bilibili" }
  ];

  function hostOf(u) {
    try { return new URL(u.trim()).hostname.toLowerCase().replace(/^www\./, ""); }
    catch (e) { return ""; }
  }

  function ytId(u) {
    var m = u.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
    return m ? m[1] : "";
  }

  function classify(u) {
    var host = hostOf(u);
    if (!host) return { type: "invalid" };
    for (var i = 0; i < ONLINE.length; i++) {
      if (ONLINE[i].k.some(function (x) { return host.indexOf(x) !== -1; })) {
        return { type: "online", name: ONLINE[i].name };
      }
    }
    for (var j = 0; j < DESKTOP.length; j++) {
      if (DESKTOP[j].k.some(function (x) { return host.indexOf(x) !== -1; })) {
        return { type: "desktop", name: DESKTOP[j].name || "", generic: !!DESKTOP[j].generic };
      }
    }
    return { type: "unknown", name: host };
  }

  function setHint() {
    var v = urlInput.value.trim();
    clearBtn.style.display = v ? "grid" : "none";
    if (!v) { hint.textContent = ""; hint.className = "platform-hint"; return; }
    var c = classify(v);
    if (c.type === "online") {
      hint.textContent = L("tool.hint.online", { name: c.name });
      hint.className = "platform-hint ok";
    } else if (c.type === "desktop") {
      hint.textContent = L("tool.hint.desktop", { name: displayName(c) });
      hint.className = "platform-hint warn";
    } else if (c.type === "invalid") {
      hint.textContent = L("tool.hint.invalid");
      hint.className = "platform-hint warn";
    } else {
      hint.textContent = L("tool.hint.unknown");
      hint.className = "platform-hint warn";
    }
  }

  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }

  function winDlUrl() {
    return (cfg.DOWNLOAD_WIN_URL && cfg.DOWNLOAD_WIN_URL !== "#") ? cfg.DOWNLOAD_WIN_URL : "#";
  }

  function displayName(c) {
    if (c.type === "unknown" || c.generic || !c.name) return L("tool.hint.unknown");
    return c.name;
  }

  function showDesktopGate(name) {
    var dl = winDlUrl();
    result.hidden = false;
    result.className = "result gate";
    result.innerHTML =
      '<div class="gate-ico">🖥️</div>' +
      '<h3>' + esc(L("tool.gate.title", { name: name })) + '</h3>' +
      '<p>' + esc(L("tool.gate.body", { name: name })) + '</p>' +
      '<div class="gate-actions">' +
      '<a class="btn btn-primary btn-lg" href="' + esc(dl) + '">' + esc(L("tool.gate.download")) + '</a>' +
      '<a class="btn btn-ghost btn-lg" href="#pricing">' + esc(L("tool.gate.pricing")) + '</a>' +
      '</div>';
  }

  function showLoading(name) {
    result.hidden = false;
    result.className = "result loading";
    result.innerHTML = '<div class="spinner"></div><p>' + esc(L("tool.loading", { name: name || "" })) + '</p>';
  }

  function showYouTubePreview(u) {
    var id = ytId(u);
    var dl = winDlUrl();
    showLoading("YouTube");

    function render(title) {
      result.hidden = false;
      result.className = "result gate yt";
      var thumb = "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";
      result.innerHTML =
        '<div class="yt-card">' +
          '<div class="yt-thumb"><img src="' + esc(thumb) + '" alt="video thumbnail" onerror="this.style.display=\'none\'"/><span class="yt-badge">' + esc(L("tool.yt.found")) + '</span></div>' +
          '<div class="yt-meta">' +
            (title ? '<div class="yt-title">' + esc(title) + '</div>' : '') +
            '<div class="yt-quals-label">' + esc(L("tool.yt.desktopQuals")) + '</div>' +
            '<div class="yt-quals"><span>720p<i>' + esc(L("tool.yt.free")) + '</i></span><span class="pro">1080p<i>' + esc(L("tool.yt.pro")) + '</i></span><span class="pro">1440p<i>' + esc(L("tool.yt.pro")) + '</i></span><span class="pro">4K<i>' + esc(L("tool.yt.pro")) + '</i></span></div>' +
          '</div>' +
        '</div>' +
        '<p class="yt-reason">' + esc(L("tool.yt.reason")) + '</p>' +
        '<div class="gate-actions">' +
          '<a class="btn btn-primary btn-lg" href="' + esc(dl) + '">' + esc(L("tool.yt.download")) + '</a>' +
          '<a class="btn btn-ghost btn-lg" href="#pricing">' + esc(L("tool.gate.pricing")) + '</a>' +
        '</div>';
    }

    var done = false;
    var timer = setTimeout(function () { if (!done) { done = true; render(""); } }, 2500);
    fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(u))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (!done) { done = true; clearTimeout(timer); render(d && d.title ? d.title : ""); } })
      .catch(function () { if (!done) { done = true; clearTimeout(timer); render(""); } });
  }

  function showError(msg) {
    track("parse_fail", { msg: msg });
    result.hidden = false;
    result.className = "result err";
    result.innerHTML = '<p>' + esc(L("tool.error.parse", { msg: msg })) + '</p>';
  }

  function triggerDownload(fileUrl, filename) {
    var a = document.createElement("a");
    a.href = fileUrl;
    if (filename) a.download = filename;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function showReady(items) {
    track("parse_ok");
    result.hidden = false;
    result.className = "result ready";
    var html = '<h3>' + esc(L("tool.ready.title")) + '</h3><div class="dl-list">';
    items.forEach(function (it) {
      html += '<button class="dl-item" data-url="' + esc(it.url) + '" data-name="' + esc(it.filename || "") + '">' +
        '<span class="dl-q">' + esc(it.label || L("tool.dl.video")) + '</span>' +
        (it.filename ? '<span class="dl-s">' + esc(it.filename) + '</span>' : '') +
        '</button>';
    });
    html += '</div>';
    result.innerHTML = html;
    result.querySelectorAll(".dl-item").forEach(function (b) {
      b.addEventListener("click", function () {
        triggerDownload(b.getAttribute("data-url"), b.getAttribute("data-name"));
      });
    });
  }

  function parseOnline(u, name) {
    if (!API) {
      var dl = winDlUrl();
      result.hidden = false;
      result.className = "result soon";
      result.innerHTML =
        '<div class="gate-ico">⚡</div>' +
        '<h3>' + esc(L("tool.soon.title")) + '</h3>' +
        '<p>' + esc(L("tool.soon.body", { name: name })) + '</p>' +
        '<div class="gate-actions"><a class="btn btn-primary btn-lg" href="' + esc(dl) + '">' + esc(L("tool.soon.download")) + '</a></div>';
      return;
    }
    showLoading(name);
    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ url: u, videoQuality: "720", filenameStyle: "basic" })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || d.status === "error") {
          showError((d && d.error && (d.error.code || d.error.text)) || "—");
          return;
        }
        if (d.status === "tunnel" || d.status === "redirect") {
          showReady([{ label: L("tool.dl.video"), url: d.url, filename: d.filename }]);
        } else if (d.status === "picker" && Array.isArray(d.picker)) {
          showReady(d.picker.map(function (p, i) {
            return { label: (p.type || L("tool.file")) + " " + (i + 1), url: p.url, filename: p.filename };
          }));
        } else {
          showError(L("tool.error.unknownType"));
        }
      })
      .catch(function (e) { showError(e && e.message ? e.message : "network"); });
  }

  function run() {
    var u = urlInput.value.trim();
    if (!u) { urlInput.focus(); return; }
    var c = classify(u);
    lastRun = { u: u, c: c };
    if (c.type === "invalid") { showError(L("tool.error.invalid")); return; }
    if (c.type === "online") { track("parse_start", { platform: c.name }); parseOnline(u, c.name || ""); return; }
    if (ytId(u)) { showYouTubePreview(u); return; }
    showDesktopGate(displayName(c));
  }

  function refreshDynamic() {
    setHint();
    if (!lastRun || result.hidden) return;
    var u = lastRun.u;
    var c = lastRun.c;
    if (c.type === "online") { parseOnline(u, c.name || ""); return; }
    if (ytId(u)) { showYouTubePreview(u); return; }
    if (c.type === "invalid") { showError(L("tool.error.invalid")); return; }
    showDesktopGate(displayName(c));
  }

  urlInput.addEventListener("input", setHint);
  urlInput.addEventListener("keydown", function (e) { if (e.key === "Enter") run(); });
  clearBtn.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    urlInput.value = "";
    result.hidden = true;
    lastRun = null;
    setHint();
    urlInput.focus();
  });
  goBtn.addEventListener("click", run);
  document.addEventListener("fluxgrab:lang", refreshDynamic);
  setHint();
})();
