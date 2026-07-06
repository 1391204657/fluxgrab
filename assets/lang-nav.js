/* Inject language selector into pages that have header.nav but no #langMenu yet */
(function () {
  if (document.getElementById("langMenu")) return;
  var cta = document.querySelector("header.nav .nav-cta");
  if (!cta) return;

  var wrap = document.createElement("div");
  wrap.className = "lang-icon-wrap";
  wrap.innerHTML =
    '<button type="button" class="lang-icon-btn" id="langBtn" aria-label="Language" aria-haspopup="listbox" aria-expanded="false" title="Language">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' +
    "</svg></button><ul id=\"langMenu\" class=\"lang-menu\" role=\"listbox\" aria-label=\"Language\"></ul>";
  cta.insertBefore(wrap, cta.firstChild);
})();
