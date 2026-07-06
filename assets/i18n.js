/* FluxGrab UI translations — homepage & shared nav */
window.FluxGrabI18n = (function () {
  var STORE = "fluxgrab_lang";

  var LANGS = {
    en: "English",
    zh: "简体中文",
    "zh-TW": "繁體中文",
    es: "Español",
    ja: "日本語",
    de: "Deutsch",
    fr: "Français",
    pt: "Português",
  };

  var T = {
    en: {
      "nav.features": "Features",
      "nav.how": "How it works",
      "nav.pricing": "Pricing",
      "nav.faq": "FAQ",
      "nav.get": "Get FluxGrab",
      "hero.badge": "Works on Windows · macOS coming soon",
      "hero.h1a": "Save the videos you love,",
      "hero.h1b": "in one click.",
      "hero.lead":
        "FluxGrab is a fast, ad-free video downloader for keeping offline copies of media you own or are licensed to download — from TikTok, X (Twitter), Instagram and 1,000+ sites.",
      "hero.download": "Download for Windows",
      "hero.subnote": "Free plan available · No account required · One-time Pro, no subscription",
      "hero.mockCaption": "Desktop app preview",
      "dl.title": "Download FluxGrab",
      "dl.p": "Free to start. Upgrade to Pro anytime from inside the app.",
      "dl.note": "Download is free — no license key needed to install. Paste your Pro key inside the app after purchase.",
      "dl.win": "⬇ Windows (.zip)",
      "dl.mac": "macOS — coming soon",
      "dl.sub": "Free plan included · No account required · Upgrade to Pro anytime inside the app.",
      "pricing.freeBtn": "Get started free",
      "foot.product": "Product",
      "foot.legal": "Legal",
      "foot.support": "Support",
      "foot.online": "Online tool",
    },
    zh: {
      "nav.features": "功能",
      "nav.how": "使用方法",
      "nav.pricing": "价格",
      "nav.faq": "常见问题",
      "nav.get": "下载 FluxGrab",
      "hero.badge": "支持 Windows · macOS 即将推出",
      "hero.h1a": "珍藏你喜欢的视频，",
      "hero.h1b": "一键保存。",
      "hero.lead":
        "FluxGrab 是一款快速、无广告的视频下载工具，可保存你拥有或已获授权的内容 —— 支持 TikTok、X (Twitter)、Instagram 等上千个站点。",
      "hero.download": "下载 Windows 版",
      "hero.subnote": "免费版可用 · 无需注册 · Pro 一次性买断",
      "hero.mockCaption": "桌面版界面预览",
      "dl.title": "下载 FluxGrab",
      "dl.p": "免费开始，随时在应用内升级 Pro。",
      "dl.note": "安装完全免费，无需许可证。购买 Pro 后在应用内粘贴密钥即可激活。",
      "dl.win": "⬇ Windows (.zip)",
      "dl.mac": "macOS — 即将推出",
      "dl.sub": "含免费版 · 无需账号 · 应用内随时升级 Pro",
      "pricing.freeBtn": "免费开始",
      "foot.product": "产品",
      "foot.legal": "法律",
      "foot.support": "支持",
      "foot.online": "在线工具",
    },
    "zh-TW": {
      "nav.features": "功能",
      "nav.how": "使用方法",
      "nav.pricing": "價格",
      "nav.faq": "常見問題",
      "nav.get": "下載 FluxGrab",
      "hero.badge": "支援 Windows · macOS 即將推出",
      "hero.h1a": "珍藏你喜歡的影片，",
      "hero.h1b": "一鍵保存。",
      "hero.lead":
        "FluxGrab 是一款快速、無廣告的影片下載工具，可保存你擁有或已獲授權的內容 —— 支援 TikTok、X (Twitter)、Instagram 等上千個站點。",
      "hero.download": "下載 Windows 版",
      "hero.subnote": "免費版可用 · 無需註冊 · Pro 一次性買斷",
      "hero.mockCaption": "桌面版介面預覽",
      "dl.title": "下載 FluxGrab",
      "dl.p": "免費開始，隨時在應用內升級 Pro。",
      "dl.note": "安裝完全免費，無需許可證。購買 Pro 後在應用內貼上金鑰即可啟用。",
      "dl.win": "⬇ Windows (.zip)",
      "dl.mac": "macOS — 即將推出",
      "dl.sub": "含免費版 · 無需帳號 · 應用內隨時升級 Pro",
      "pricing.freeBtn": "免費開始",
      "foot.product": "產品",
      "foot.legal": "法律",
      "foot.support": "支援",
      "foot.online": "線上工具",
    },
    es: {
      "nav.features": "Funciones",
      "nav.how": "Cómo funciona",
      "nav.pricing": "Precios",
      "nav.faq": "FAQ",
      "nav.get": "Obtener FluxGrab",
      "hero.badge": "Windows · macOS pronto",
      "hero.h1a": "Guarda los videos que amas,",
      "hero.h1b": "en un clic.",
      "hero.lead":
        "FluxGrab es un descargador rápido y sin anuncios para guardar contenido que posees o tienes licencia — TikTok, X, Instagram y más de 1.000 sitios.",
      "hero.download": "Descargar para Windows",
      "hero.subnote": "Plan gratis · Sin cuenta · Pro de pago único",
      "hero.mockCaption": "Vista previa de la app de escritorio",
      "dl.title": "Descargar FluxGrab",
      "dl.p": "Empieza gratis. Actualiza a Pro desde la app.",
      "dl.note": "La instalación es gratis. Pega tu clave Pro en la app tras la compra.",
      "dl.win": "⬇ Windows (.zip)",
      "dl.mac": "macOS — pronto",
      "dl.sub": "Plan gratis incluido · Sin cuenta",
      "pricing.freeBtn": "Empezar gratis",
      "foot.product": "Producto",
      "foot.legal": "Legal",
      "foot.support": "Soporte",
      "foot.online": "Herramienta online",
    },
    ja: {
      "nav.features": "機能",
      "nav.how": "使い方",
      "nav.pricing": "料金",
      "nav.faq": "FAQ",
      "nav.get": "FluxGrab を入手",
      "hero.badge": "Windows 対応 · macOS 近日公開",
      "hero.h1a": "お気に入りの動画を、",
      "hero.h1b": "ワンクリックで保存。",
      "hero.lead":
        "FluxGrab は高速・広告なしの動画ダウンローダーです。TikTok、X、Instagram など 1,000 以上のサイトに対応。",
      "hero.download": "Windows 版をダウンロード",
      "hero.subnote": "無料プラン · アカウント不要 · Pro は買い切り",
      "hero.mockCaption": "デスクトップアプリのプレビュー",
      "dl.title": "FluxGrab をダウンロード",
      "dl.p": "無料で開始。アプリ内で Pro にアップグレード。",
      "dl.note": "インストールは無料。購入後、アプリ内でライセンスキーを入力。",
      "dl.win": "⬇ Windows (.zip)",
      "dl.mac": "macOS — 近日公開",
      "dl.sub": "無料プラン付き · アカウント不要",
      "pricing.freeBtn": "無料で始める",
      "foot.product": "製品",
      "foot.legal": "法的情報",
      "foot.support": "サポート",
      "foot.online": "オンラインツール",
    },
    de: {
      "nav.features": "Funktionen",
      "nav.how": "So funktioniert's",
      "nav.pricing": "Preise",
      "nav.faq": "FAQ",
      "nav.get": "FluxGrab holen",
      "hero.badge": "Windows · macOS demnächst",
      "hero.h1a": "Speichere Videos, die du liebst —",
      "hero.h1b": "mit einem Klick.",
      "hero.lead":
        "FluxGrab ist ein schneller, werbefreier Downloader für Inhalte, die du besitzt oder lizenziert hast — TikTok, X, Instagram und über 1.000 Seiten.",
      "hero.download": "Für Windows herunterladen",
      "hero.subnote": "Kostenlos starten · Kein Konto · Pro einmalig",
      "hero.mockCaption": "Desktop-App-Vorschau",
      "dl.title": "FluxGrab herunterladen",
      "dl.p": "Kostenlos starten. Pro jederzeit in der App.",
      "dl.note": "Installation kostenlos. Pro-Schlüssel nach dem Kauf in der App eingeben.",
      "dl.win": "⬇ Windows (.zip)",
      "dl.mac": "macOS — demnächst",
      "dl.sub": "Kostenloser Plan · Kein Konto nötig",
      "pricing.freeBtn": "Kostenlos starten",
      "foot.product": "Produkt",
      "foot.legal": "Rechtliches",
      "foot.support": "Support",
      "foot.online": "Online-Tool",
    },
    fr: {
      "nav.features": "Fonctionnalités",
      "nav.how": "Comment ça marche",
      "nav.pricing": "Tarifs",
      "nav.faq": "FAQ",
      "nav.get": "Obtenir FluxGrab",
      "hero.badge": "Windows · macOS bientôt",
      "hero.h1a": "Sauvegardez les vidéos que vous aimez,",
      "hero.h1b": "en un clic.",
      "hero.lead":
        "FluxGrab est un téléchargeur rapide et sans pub pour les contenus que vous possédez ou êtes autorisé à garder — TikTok, X, Instagram et plus de 1 000 sites.",
      "hero.download": "Télécharger pour Windows",
      "hero.subnote": "Gratuit · Sans compte · Pro en paiement unique",
      "hero.mockCaption": "Aperçu de l'application bureau",
      "dl.title": "Télécharger FluxGrab",
      "dl.p": "Commencez gratuitement. Passez à Pro dans l'app.",
      "dl.note": "Installation gratuite. Collez votre clé Pro dans l'app après l'achat.",
      "dl.win": "⬇ Windows (.zip)",
      "dl.mac": "macOS — bientôt",
      "dl.sub": "Plan gratuit · Sans compte",
      "pricing.freeBtn": "Commencer gratuitement",
      "foot.product": "Produit",
      "foot.legal": "Mentions légales",
      "foot.support": "Assistance",
      "foot.online": "Outil en ligne",
    },
    pt: {
      "nav.features": "Recursos",
      "nav.how": "Como funciona",
      "nav.pricing": "Preços",
      "nav.faq": "FAQ",
      "nav.get": "Baixar FluxGrab",
      "hero.badge": "Windows · macOS em breve",
      "hero.h1a": "Salve os vídeos que você ama,",
      "hero.h1b": "com um clique.",
      "hero.lead":
        "FluxGrab é um baixador rápido e sem anúncios para conteúdo que você possui ou tem licença — TikTok, X, Instagram e mais de 1.000 sites.",
      "hero.download": "Baixar para Windows",
      "hero.subnote": "Plano grátis · Sem conta · Pro pagamento único",
      "hero.mockCaption": "Prévia do app desktop",
      "dl.title": "Baixar FluxGrab",
      "dl.p": "Comece grátis. Atualize para Pro no app.",
      "dl.note": "Instalação grátis. Cole sua chave Pro no app após a compra.",
      "dl.win": "⬇ Windows (.zip)",
      "dl.mac": "macOS — em breve",
      "dl.sub": "Plano grátis · Sem conta",
      "pricing.freeBtn": "Começar grátis",
      "foot.product": "Produto",
      "foot.legal": "Legal",
      "foot.support": "Suporte",
      "foot.online": "Ferramenta online",
    },
  };

  function guessLang() {
    var n = (navigator.language || "en").toLowerCase();
    if (n.startsWith("zh-tw") || n.startsWith("zh-hk")) return "zh-TW";
    if (n.startsWith("zh")) return "zh";
    if (n.startsWith("es")) return "es";
    if (n.startsWith("ja")) return "ja";
    if (n.startsWith("de")) return "de";
    if (n.startsWith("fr")) return "fr";
    if (n.startsWith("pt")) return "pt";
    return "en";
  }

  function t(lang, key) {
    var pack = T[lang] || T.en;
    return pack[key] || T.en[key] || key;
  }

  function htmlLang(lang) {
    if (lang === "zh") return "zh-CN";
    if (lang === "zh-TW") return "zh-TW";
    return lang;
  }

  function apply(lang) {
    if (!T[lang]) lang = "en";
    localStorage.setItem(STORE, lang);
    document.documentElement.lang = htmlLang(lang);
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(lang, el.getAttribute("data-i18n"));
    });
    var sel = document.getElementById("langSelect");
    if (sel) sel.value = lang;
  }

  function buildSelect() {
    var sel = document.getElementById("langSelect");
    if (!sel) return;
    sel.innerHTML = "";
    Object.keys(LANGS).forEach(function (code) {
      var o = document.createElement("option");
      o.value = code;
      o.textContent = LANGS[code];
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      apply(sel.value);
    });
  }

  function init() {
    buildSelect();
    var saved = localStorage.getItem(STORE);
    apply(saved && T[saved] ? saved : guessLang());
  }

  return { init: init, apply: apply, LANGS: LANGS };
})();
