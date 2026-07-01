(function () {
  "use strict";

  var LANG_KEY = "pillowflow.lang";
  var EXPLICIT_KEY = "pillowflow.lang.explicit";

  function cookieValue(name) {
    var match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : "";
  }

  function stored(key) {
    try {
      return window.localStorage.getItem(key) || "";
    } catch (error) {
      return cookieValue(key);
    }
  }

  function normalizeLang(value) {
    return value === "es" || value === "en" ? value : "";
  }

  function targetFor(lang) {
    var path = window.location.pathname;
    var isReferral = /\/(?:es\/)?referral\.html$/i.test(path);
    if (lang === "es") return isReferral ? "/es/referral.html" : "/es/";
    return isReferral ? "/referral.html" : "/";
  }

  var saved = normalizeLang(stored(LANG_KEY));
  var explicit = stored(EXPLICIT_KEY) === "1";
  var current = document.documentElement.lang.toLowerCase().indexOf("es") === 0 ? "es" : "en";

  if (explicit && saved && saved !== current) {
    var target = targetFor(saved);
    if (window.location.pathname !== target) {
      window.location.replace(target + window.location.search + window.location.hash);
    }
  }
})();
