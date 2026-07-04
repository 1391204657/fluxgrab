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
  var API = (cfg.COBALT_API_URL || "").trim();

  var urlInput = document.getElementById("url");
  var clearBtn = document.getElementById("clearBtn");
  var goBtn = document.getElementById("goBtn");
  var hint = document.getElementById("platformHint");
  var result = document.getElementById("result");

  // 平台识别：host 关键字 -> 分类
  var ONLINE = [
    { k: ["twitter.com", "x.com", "t.co"], name: "X (Twitter)" },
    { k: ["tiktok.com"], name: "TikTok" },
    { k: ["instagram.com", "instagr.am"], name: "Instagram" },
    { k: ["facebook.com", "fb.watch"], name: "Facebook" },
    { k: ["reddit.com", "redd.it"], name: "Reddit" },
    { k: ["twitch.tv"], name: "Twitch" },
    { k: ["tumblr.com"], name: "Tumblr" },
    { k: ["vimeo.com"], name: "Vimeo" }
  ];
  var DESKTOP = [
    { k: ["youtube.com", "youtu.be"], name: "YouTube" },
    { k: ["pornhub.com", "xvideos.com", "xhamster.com", "redtube.com", "youporn.com", "spankbang.com"], name: "该站点" },
    { k: ["bilibili.com", "b23.tv"], name: "哔哩哔哩" }
  ];

  function hostOf(u) {
    try { return new URL(u.trim()).hostname.toLowerCase().replace(/^www\./, ""); }
    catch (e) { return ""; }
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
        return { type: "desktop", name: DESKTOP[j].name };
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
      hint.textContent = "✓ 支持在线下载：" + c.name;
      hint.className = "platform-hint ok";
    } else if (c.type === "desktop") {
      hint.textContent = c.name + " 需要桌面版下载（更快更稳）";
      hint.className = "platform-hint warn";
    } else if (c.type === "invalid") {
      hint.textContent = "请输入有效的视频链接";
      hint.className = "platform-hint warn";
    } else {
      hint.textContent = "未知平台，会尝试在线解析";
      hint.className = "platform-hint";
    }
  }

  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }

  function showDesktopGate(name) {
    var dl = (cfg.DOWNLOAD_WIN_URL && cfg.DOWNLOAD_WIN_URL !== "#") ? cfg.DOWNLOAD_WIN_URL : "index.html#download";
    result.hidden = false;
    result.className = "result gate";
    result.innerHTML =
      '<div class="gate-ico">🖥️</div>' +
      '<h3>' + esc(name) + ' 需要用桌面版下载</h3>' +
      '<p>为绕过平台限制、保证速度与稳定，' + esc(name) + '、成人站及 1080p/4K 由桌面版本地下载。<br>' +
      '<strong>免费版每天可下载 2 次</strong>，专业版无限制。</p>' +
      '<div class="gate-actions">' +
      '<a class="btn btn-primary btn-lg" href="' + dl + '">⬇ 下载 Windows 桌面版</a>' +
      '<a class="btn btn-ghost btn-lg" href="index.html#pricing">查看价格</a>' +
      '</div>';
  }

  function showLoading(name) {
    result.hidden = false;
    result.className = "result loading";
    result.innerHTML = '<div class="spinner"></div><p>正在解析 ' + esc(name || "链接") + '…</p>';
  }

  function showError(msg) {
    result.hidden = false;
    result.className = "result err";
    result.innerHTML = '<p>解析失败：' + esc(msg) + '</p>';
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
    result.hidden = false;
    result.className = "result ready";
    var html = '<h3>解析成功，选择下载：</h3><div class="dl-list">';
    items.forEach(function (it) {
      html += '<button class="dl-item" data-url="' + esc(it.url) + '" data-name="' + esc(it.filename || "") + '">' +
        '<span class="dl-q">' + esc(it.label || "下载") + '</span>' +
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

  // cobalt API v10 契约：POST { url } -> { status, url, filename, picker[] }
  function parseOnline(u, name) {
    if (!API) {
      result.hidden = false;
      result.className = "result soon";
      result.innerHTML =
        '<div class="gate-ico">⚡</div>' +
        '<h3>在线解析即将上线</h3>' +
        '<p>' + esc(name) + ' 的在线下载功能正在部署中。<br>现在你可以先用桌面版下载任意平台的视频。</p>' +
        '<div class="gate-actions"><a class="btn btn-primary btn-lg" href="index.html#download">⬇ 先用桌面版</a></div>';
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
          showError((d && d.error && (d.error.code || d.error.text)) || "无法解析该链接");
          return;
        }
        if (d.status === "tunnel" || d.status === "redirect") {
          showReady([{ label: "下载视频 (720p)", url: d.url, filename: d.filename }]);
        } else if (d.status === "picker" && Array.isArray(d.picker)) {
          showReady(d.picker.map(function (p, i) {
            return { label: (p.type || "文件") + " " + (i + 1), url: p.url, filename: p.filename };
          }));
        } else {
          showError("返回了未知的结果类型");
        }
      })
      .catch(function (e) { showError(e && e.message ? e.message : "网络错误"); });
  }

  function run() {
    var u = urlInput.value.trim();
    if (!u) { urlInput.focus(); return; }
    var c = classify(u);
    if (c.type === "invalid") { showError("请输入有效的视频链接"); return; }
    if (c.type === "desktop") { showDesktopGate(c.name); return; }
    parseOnline(u, c.name || "链接");
  }

  urlInput.addEventListener("input", setHint);
  urlInput.addEventListener("keydown", function (e) { if (e.key === "Enter") run(); });
  clearBtn.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    urlInput.value = "";
    result.hidden = true;
    setHint();
    urlInput.focus();
  });
  goBtn.addEventListener("click", run);
  setHint();
})();
