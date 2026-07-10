/* FluxGrab SEO — hreflang, meta, JSON-LD */
window.FluxGrabSEO = (function () {
  var SITE = "https://fluxgrab.com";

  var HREFLANG = [
    { hreflang: "en", code: "en" },
    { hreflang: "zh-CN", code: "zh" },
    { hreflang: "zh-TW", code: "zh-TW" },
    { hreflang: "es", code: "es" },
    { hreflang: "ja", code: "ja" },
    { hreflang: "de", code: "de" },
    { hreflang: "fr", code: "fr" },
    { hreflang: "pt", code: "pt" },
  ];

  var HOME_META = {
    en: {
      title: "FluxGrab — Personal media backup for Windows",
      description:
        "Desktop software to keep offline copies of media you own or are licensed to keep. TikTok, X, Instagram online; YouTube & 4K via the Windows app.",
    },
    zh: {
      title: "FluxGrab — Windows 个人媒体离线备份软件",
      description:
        "桌面软件，用于备份你拥有或已获授权的内容。TikTok、X、Instagram 在线解析；YouTube、4K 请用 Windows 版。",
    },
    "zh-TW": {
      title: "FluxGrab — Windows 個人媒體離線備份軟體",
      description:
        "桌面軟體，用於備份你擁有或已獲授權的內容。TikTok、X、Instagram 線上解析；YouTube、4K 請用 Windows 版。",
    },
    es: {
      title: "FluxGrab — Copia de seguridad de medios para Windows",
      description:
        "Software de escritorio para copias offline de contenido que posees o tienes licencia. TikTok, X, Instagram online; YouTube y 4K en la app.",
    },
    ja: {
      title: "FluxGrab — Windows 向け個人メディアバックアップ",
      description:
        "所有または利用許諾のあるメディアをオフライン保存するデスクトップソフト。TikTok・X・Instagram はオンライン、YouTube・4K は Windows 版。",
    },
    de: {
      title: "FluxGrab — Persönliche Mediensicherung für Windows",
      description:
        "Desktop-Software für Offline-Kopien von Medien, die du besitzt oder lizenziert hast. TikTok, X, Instagram online; YouTube & 4K per App.",
    },
    fr: {
      title: "FluxGrab — Sauvegarde média personnelle pour Windows",
      description:
        "Logiciel de bureau pour copies hors ligne de contenus que vous possédez ou êtes autorisé à garder. TikTok, X, Instagram en ligne; YouTube & 4K via l'app.",
    },
    pt: {
      title: "FluxGrab — Backup de mídia pessoal para Windows",
      description:
        "Software desktop para cópias offline de mídia que você possui ou tem licença. TikTok, X, Instagram online; YouTube e 4K no app Windows.",
    },
  };

  function langFromUrl() {
    var m = location.search.match(/[?&]lang=([^&]+)/);
    if (!m) return null;
    var code = decodeURIComponent(m[1]);
    return HOME_META[code] ? code : null;
  }

  function pageUrl(path, lang) {
    var p = path || "/";
    if (p.indexOf("http") === 0) return p;
    var url = SITE + (p.charAt(0) === "/" ? p : "/" + p);
    if (!lang || lang === "en") return url;
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + "lang=" + encodeURIComponent(lang);
  }

  function setMeta(attr, name, content) {
    var sel =
      attr === "property"
        ? 'meta[property="' + name + '"]'
        : 'meta[name="' + name + '"]';
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement("meta");
      if (attr === "property") el.setAttribute("property", name);
      else el.setAttribute("name", name);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  function applyPage(opts) {
    if (!opts) return;
    if (opts.title) {
      document.title = opts.title;
      setMeta("property", "og:title", opts.title);
      setMeta("name", "twitter:title", opts.title);
    }
    if (opts.description) {
      setMeta("name", "description", opts.description);
      setMeta("property", "og:description", opts.description);
      setMeta("name", "twitter:description", opts.description);
    }
    var img = opts.image || SITE + "/assets/og.png";
    setMeta("property", "og:image", img);
    setMeta("name", "twitter:image", img);
    if (opts.url) setMeta("property", "og:url", opts.url);
    if (opts.canonical) {
      var link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = opts.canonical;
    }
  }

  function applyHomeMeta(lang) {
    var pack = HOME_META[lang] || HOME_META.en;
    applyPage({
      title: pack.title,
      description: pack.description,
      canonical: pageUrl("/", lang === "en" ? null : lang),
      url: pageUrl("/", lang === "en" ? null : lang),
    });
  }

  function syncUrlLang(lang) {
    if (!document.body.classList.contains("page-home-tool") || !history.replaceState) return;
    var url = new URL(location.href);
    if (lang === "en") url.searchParams.delete("lang");
    else url.searchParams.set("lang", lang);
    history.replaceState({}, "", url.pathname + url.search + url.hash);
  }

  function injectJsonLd(data) {
    var el = document.getElementById("json-ld");
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = "json-ld";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }

  function homeJsonLd() {
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": SITE + "/#website",
          name: "FluxGrab",
          url: SITE + "/",
          description: HOME_META.en.description,
          inLanguage: ["en", "zh-CN", "zh-TW", "es", "ja", "de", "fr", "pt"],
        },
        {
          "@type": "SoftwareApplication",
          "@id": SITE + "/#app",
          name: "FluxGrab",
          applicationCategory: "MultimediaApplication",
          operatingSystem: "Windows, macOS",
          offers: [
            {
              "@type": "Offer",
              name: "Free",
              price: "0",
              priceCurrency: "USD",
            },
            {
              "@type": "Offer",
              name: "Pro Lifetime",
              price: "19.9",
              priceCurrency: "USD",
            },
          ],
          description: HOME_META.en.description,
          url: SITE + "/",
          downloadUrl: "https://github.com/1391204657/fluxgrab/releases/latest/download/FluxGrab-Windows.zip",
        },
        {
          "@type": "WebApplication",
          "@id": SITE + "/#webapp",
          name: "FluxGrab Online Downloader",
          applicationCategory: "MultimediaApplication",
          browserRequirements: "Requires JavaScript",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          url: SITE + "/",
        },
      ],
    };
  }

  function faqJsonLd(items) {
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: items.map(function (item) {
        return {
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        };
      }),
    };
  }

  function breadcrumbJsonLd(items) {
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map(function (item, i) {
        return {
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          item: item.url,
        };
      }),
    };
  }

  return {
    SITE: SITE,
    HREFLANG: HREFLANG,
    HOME_META: HOME_META,
    langFromUrl: langFromUrl,
    pageUrl: pageUrl,
    applyPage: applyPage,
    applyHomeMeta: applyHomeMeta,
    syncUrlLang: syncUrlLang,
    injectJsonLd: injectJsonLd,
    homeJsonLd: homeJsonLd,
    faqJsonLd: faqJsonLd,
    breadcrumbJsonLd: breadcrumbJsonLd,
  };
})();
