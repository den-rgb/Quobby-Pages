(function () {
  var ORIGIN_RE = /\/embed\.js(\?.*)?$/;
  var scripts = document.querySelectorAll(
    'script[src*="qurator.quobby.com/embed.js"], script[src$="/embed.js"][data-tutorial]'
  );

  for (var i = 0; i < scripts.length; i++) {
    var s = scripts[i];
    var id = s.getAttribute('data-tutorial');
    if (!id) continue;

    var height = s.getAttribute('data-height') || 'auto';
    var theme = s.getAttribute('data-theme') || 'dark';
    var startStep = s.getAttribute('data-start-step') || '';
    var origin = s.src.replace(ORIGIN_RE, '');

    var wrapper = document.createElement('div');
    wrapper.style.cssText =
      'position:relative;width:100%;overflow:hidden;border-radius:12px;' +
      'background:#0a0a14;' +
      (height === 'auto' ? 'min-height:300px;' : '');

    var iframe = document.createElement('iframe');
    var src = origin + '/embed/' + id + '?theme=' + encodeURIComponent(theme);
    if (startStep) src += '&step=' + encodeURIComponent(startStep);
    iframe.src = src;
    iframe.width = '100%';
    iframe.style.cssText =
      'border:none;display:block;width:100%;' +
      (height === 'auto' ? 'height:500px;' : 'height:' + height + 'px;');
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('title', 'Qurator Tutorial');

    wrapper.appendChild(iframe);
    s.parentNode.replaceChild(wrapper, s);

    if (height === 'auto') {
      (function (frame) {
        window.addEventListener('message', function (e) {
          if (e.source !== frame.contentWindow) return;
          var d = e.data;
          if (d && d.type === 'qurator:resize' && typeof d.height === 'number') {
            frame.style.height = d.height + 'px';
          }
        });
      })(iframe);
    }
  }
})();
