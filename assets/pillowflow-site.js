(function () {
  "use strict";

  var LANG_KEY = "pillowflow.lang";
  var EXPLICIT_KEY = "pillowflow.lang.explicit";

  var NAV = [
    {
      group: "Product",
      groupEs: "Producto",
      items: [
        { label: "Overview", labelEs: "Descripción general", href: "/#product", hrefEs: "/es/#product", desktop: true },
        { label: "Why PillowFlow", labelEs: "Por qué PillowFlow", href: "/#value", hrefEs: "/es/#value" },
        { label: "Business Case", labelEs: "Caso de negocio", href: "/#scope", hrefEs: "/es/#scope", desktop: true },
        { label: "Fleet Pilot", labelEs: "Piloto de flota", href: "/#apply", hrefEs: "/es/#apply", desktop: true },
        { label: "Pilot Steps", labelEs: "Pasos piloto", href: "/#pilots", hrefEs: "/es/#pilots", desktop: true },
        { label: "Evaluation Scope", labelEs: "Alcance de evaluación", href: "/#scope", hrefEs: "/es/#scope", desktop: true },
        { label: "Research & Evidence", labelEs: "Investigación y evidencia", href: "/#sources", hrefEs: "/es/#sources" }
      ]
    },
    {
      group: "Company",
      groupEs: "Compañía",
      items: [
        { label: "About", labelEs: "Acerca de", href: "/#company", hrefEs: "/es/#company", desktop: true },
        { label: "Contact", labelEs: "Contacto", href: "mailto:connect@pillowflow.com", hrefEs: "mailto:connect@pillowflow.com" },
        { label: "Shop PillowFlow", labelEs: "Tienda PillowFlow", href: "https://pillowflow.com", hrefEs: "https://pillowflow.com", external: true },
        { label: "Refer a Fleet", labelEs: "Referir una flota", href: "/referral.html", hrefEs: "/es/referral.html" }
      ]
    },
    {
      group: "Resources",
      groupEs: "Recursos",
      items: [
        { label: "Sources", labelEs: "Fuentes", href: "/#sources", hrefEs: "/es/#sources" },
        { label: "Legal Disclaimer", labelEs: "Aviso legal", href: "/#sources", hrefEs: "/es/#sources" }
      ]
    },
    {
      group: "Contact",
      groupEs: "Contacto",
      items: [
        { label: "Apply for Pilot", labelEs: "Solicitar piloto", href: "/#apply", hrefEs: "/es/#apply", cta: true },
        { label: "Refer a Fleet", labelEs: "Referir una flota", href: "/referral.html", hrefEs: "/es/referral.html" },
        { label: "Email", labelEs: "Correo", href: "mailto:connect@pillowflow.com", hrefEs: "mailto:connect@pillowflow.com" },
        { label: "Phone", labelEs: "Teléfono", href: "tel:+14157247080", hrefEs: "tel:+14157247080" }
      ]
    }
  ];

  window.PillowFlowNavigation = NAV;

  function isSpanish() {
    return document.documentElement.lang.toLowerCase().indexOf("es") === 0;
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      document.cookie = key + "=" + encodeURIComponent(value) + ";path=/;max-age=31536000;SameSite=Lax";
    }
  }

  function normalizeLang(value) {
    return value === "es" || value === "en" ? value : "";
  }

  function currentLang() {
    return isSpanish() ? "es" : "en";
  }

  function hrefFor(item) {
    return isSpanish() ? item.hrefEs || item.href : item.href;
  }

  function labelFor(item) {
    return isSpanish() ? item.labelEs || item.label : item.label;
  }

  function groupLabel(group) {
    return isSpanish() ? group.groupEs || group.group : group.group;
  }

  function isSamePageHash(url) {
    return url.origin === window.location.origin &&
      url.pathname.replace(/\/index\.html$/i, "/") === window.location.pathname.replace(/\/index\.html$/i, "/") &&
      url.hash;
  }

  function activeFor(href) {
    var url;
    try {
      url = new URL(href, window.location.origin);
    } catch (error) {
      return false;
    }
    var currentPath = window.location.pathname.replace(/\/index\.html$/i, "/");
    var targetPath = url.pathname.replace(/\/index\.html$/i, "/");
    if (targetPath !== currentPath) return false;
    return !url.hash || url.hash === window.location.hash || document.querySelector(url.hash + ".active-section");
  }

  function renderDesktopNav() {
    var nav = document.querySelector("[data-nav-desktop]");
    if (!nav) return;
    nav.innerHTML = "";
    NAV.forEach(function (group) {
      group.items.forEach(function (item) {
        if (!item.desktop) return;
        var a = document.createElement("a");
        a.href = hrefFor(item);
        a.textContent = labelFor(item);
        if (activeFor(a.href)) a.classList.add("is-current");
        nav.appendChild(a);
      });
    });
  }

  function closeMenu(menu, restoreFocus) {
    if (!menu || !menu.classList.contains("is-open")) return;
    var y = Number(menu.getAttribute("data-scroll-y") || "0");
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("site-menu-open");
    document.body.classList.remove("site-menu-open");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    window.scrollTo(0, y);
    var toggle = document.querySelector("[data-mobile-menu-toggle]");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    if (restoreFocus && toggle) toggle.focus();
  }

  function openMenu(menu) {
    if (!menu || menu.classList.contains("is-open")) return;
    var y = window.scrollY;
    menu.setAttribute("data-scroll-y", String(y));
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("site-menu-open");
    document.body.classList.add("site-menu-open");
    document.body.style.position = "fixed";
    document.body.style.top = "-" + y + "px";
    document.body.style.width = "100%";
    var toggle = document.querySelector("[data-mobile-menu-toggle]");
    if (toggle) toggle.setAttribute("aria-expanded", "true");
    var first = menu.querySelector("a,button");
    if (first) first.focus({ preventScroll: true });
  }

  function renderMobileMenu() {
    if (document.querySelector(".mobile-menu-backdrop")) return;

    var toggle = document.querySelector("[data-mobile-menu-toggle]");
    if (!toggle) return;

    var menu = document.createElement("div");
    menu.className = "mobile-menu-backdrop";
    menu.setAttribute("aria-hidden", "true");
    menu.innerHTML = '<aside class="mobile-menu-panel" role="dialog" aria-modal="true" aria-label="' +
      (isSpanish() ? "Navegación del sitio" : "Site navigation") +
      '"><div class="mobile-menu-head"><div class="mobile-menu-title">PillowFlow</div><button class="mobile-menu-close" type="button" aria-label="' +
      (isSpanish() ? "Cerrar menú" : "Close menu") +
      '">&times;</button></div><div class="mobile-menu-groups"></div><div class="mobile-menu-cta"></div></aside>';

    var groupsWrap = menu.querySelector(".mobile-menu-groups");
    var ctaWrap = menu.querySelector(".mobile-menu-cta");

    NAV.forEach(function (group) {
      var groupEl = document.createElement("section");
      groupEl.className = "mobile-menu-group";
      var heading = document.createElement("h3");
      heading.textContent = groupLabel(group);
      var list = document.createElement("ul");
      group.items.forEach(function (item) {
        if (item.cta) {
          var cta = document.createElement("a");
          cta.href = hrefFor(item);
          cta.textContent = labelFor(item);
          ctaWrap.appendChild(cta);
          return;
        }
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = hrefFor(item);
        a.textContent = labelFor(item);
        if (item.external) {
          a.target = "_blank";
          a.rel = "noopener";
        }
        if (activeFor(a.href)) {
          a.classList.add("is-current");
          a.setAttribute("aria-current", "page");
        }
        li.appendChild(a);
        list.appendChild(li);
      });
      groupEl.appendChild(heading);
      groupEl.appendChild(list);
      groupsWrap.appendChild(groupEl);
    });

    document.body.appendChild(menu);

    toggle.addEventListener("click", function () {
      openMenu(menu);
    });

    menu.addEventListener("click", function (event) {
      if (event.target === menu || event.target.closest(".mobile-menu-close")) {
        closeMenu(menu, true);
      }
    });

    menu.addEventListener("click", function (event) {
      var link = event.target.closest("a");
      if (!link) return;
      var url = new URL(link.getAttribute("href"), window.location.href);
      closeMenu(menu, false);
      if (isSamePageHash(url)) {
        event.preventDefault();
        var target = document.querySelector(url.hash);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.pushState(null, "", url.hash);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu(menu, true);
    });

    var startX = 0;
    var startY = 0;
    var pointerStartX = 0;
    var pointerStartY = 0;
    menu.addEventListener("touchstart", function (event) {
      var touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    }, { passive: true });
    menu.addEventListener("touchmove", function (event) {
      var touch = event.touches[0];
      var dx = touch.clientX - startX;
      var dy = Math.abs(touch.clientY - startY);
      if (dx > 52 && dy < 44) closeMenu(menu, false);
    }, { passive: true });
    menu.addEventListener("pointerdown", function (event) {
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
    });
    menu.addEventListener("pointerup", function (event) {
      var dx = event.clientX - pointerStartX;
      var dy = Math.abs(event.clientY - pointerStartY);
      if (dx > 52 && dy < 44) closeMenu(menu, false);
    });
  }

  function bindLanguage() {
    Array.prototype.slice.call(document.querySelectorAll(".language-control a[lang]")).forEach(function (link) {
      var lang = normalizeLang(link.getAttribute("lang"));
      if (!lang) return;
      if (lang === currentLang()) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      } else {
        link.classList.remove("active");
        link.removeAttribute("aria-current");
      }
      link.addEventListener("click", function (event) {
        storageSet(LANG_KEY, lang);
        storageSet(EXPLICIT_KEY, "1");
        event.preventDefault();
        window.location.assign(link.href);
      });
    });
  }

  function initActiveSections() {
    var sections = Array.prototype.slice.call(document.querySelectorAll("main section[id], footer [id]"));
    if (!sections.length || !("IntersectionObserver" in window)) return;
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle("active-section", entry.isIntersecting);
      });
      renderDesktopNav();
    }, { rootMargin: "-35% 0px -55% 0px", threshold: 0 });
    sections.forEach(function (section) {
      sectionObserver.observe(section);
    });
  }

  function bindVideo() {
    var video = document.getElementById("installation-video");
    var play = document.getElementById("installation-video-play");
    if (!video || !play || play.getAttribute("data-bound") === "true") return;
    play.setAttribute("data-bound", "true");
    var frame = video.closest(".video-frame");
    play.addEventListener("click", function () {
      video.play().catch(function () {
        if (frame) frame.classList.remove("is-playing");
      });
    });
    video.addEventListener("play", function () {
      if (frame) frame.classList.add("is-playing");
    });
    video.addEventListener("pause", function () {
      if (frame) frame.classList.remove("is-playing");
    });
    video.addEventListener("ended", function () {
      if (frame) frame.classList.remove("is-playing");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindLanguage();
    renderDesktopNav();
    renderMobileMenu();
    initActiveSections();
    bindVideo();
  });
})();
