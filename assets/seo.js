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
      title: "FluxGrab — Download videos from TikTok, X, Instagram & 1,000+ sites",
      description:
        "Paste a link to download videos online from TikTok, X, Instagram and more. Free desktop app for YouTube, 4K and 1,000+ sites.",
    },
    zh: {
      title: "FluxGrab — TikTok、X、Instagram 等视频下载工具",
      description:
        "粘贴链接即可在线下载 TikTok、X、Instagram 等视频。桌面版支持 YouTube、4K 及上千个网站，免费可用。",
    },
    "zh-TW": {
      title: "FluxGrab — TikTok、X、Instagram 等影片下載工具",
      description:
        "貼上連結即可線上下載 TikTok、X、Instagram 等影片。桌面版支援 YouTube、4K 及上千個網站。",
    },
    es: {
      title: "FluxGrab — Descargar videos de TikTok, X, Instagram y más",
      description:
        "Pega un enlace para descargar videos de TikTok, X, Instagram y más. App de escritorio gratis para YouTube y 4K.",
    },
    ja: {
      title: "FluxGrab — TikTok・X・Instagram 動画ダウンロード",
      description:
        "リンクを貼るだけで TikTok、X、Instagram などの動画をダウンロード。YouTube・4K 対応の無料デスクトップアプリ。",
    },
    de: {
      title: "FluxGrab — Videos von TikTok, X, Instagram & mehr laden",
      description:
        "Link einfügen und Videos von TikTok, X, Instagram u. a. herunterladen. Kostenlose Desktop-App für YouTube und 4K.",
    },
    fr: {
      title: "FluxGrab — Télécharger des vidéos TikTok, X, Instagram et plus",
      description:
        "Collez un lien pour télécharger des vidéos TikTok, X, Instagram et plus. Application gratuite pour YouTube et 4K.",
    },
    pt: {
      title: "FluxGrab — Baixar vídeos do TikTok, X, Instagram e mais",
      description:
        "Cole um link para baixar vídeos do TikTok, X, Instagram e mais. App gratuito para YouTube e 4K.",
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
