(function () {
  var scripts = document.querySelectorAll('script[src*="qurator.quobby.com/embed.js"], script[src$="/embed.js"][data-tutorial]');
  for (var i = 0; i < scripts.length; i++) {
    var s = scripts[i];
    var id = s.getAttribute('data-tutorial');
    if (!id) continue;

    var height = s.getAttribute('data-height') || '500';
    var origin = s.src.replace(/\/embed\.js(\?.*)?$/, '');

    var iframe = document.createElement('iframe');
    iframe.src = origin + '/embed/' + id;
    iframe.width = '100%';
    iframe.height = height;
    iframe.style.cssText = 'border:none;border-radius:12px;';
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.setAttribute('loading', 'lazy');

    s.parentNode.replaceChild(iframe, s);
  }
})();
