(function () {
  function getGap() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--gallery-gap').trim();
    var px = parseInt(v, 10);
    return isNaN(px) ? 8 : px;
  }

  function initGallery(gallery) {
    Array.prototype.forEach.call(gallery.children, function (child) {
      child.classList.add('gallery-item');
    });

    var masonry = new Masonry(gallery, {
      itemSelector: '.gallery-item',
      columnWidth: '.gallery-item',
      percentPosition: true,
      gutter: getGap(),
      transitionDuration: 0,
      initLayout: false
    });
    gallery._masonry = masonry;

    imagesLoaded(gallery, function () {
      masonry.layout();
    }).on('progress', function () {
      masonry.layout();
    });
  }

  function reflowAll() {
    document.querySelectorAll('.image-gallery').forEach(function (gallery) {
      if (gallery._masonry) {
        gallery._masonry.options.gutter = getGap();
        gallery._masonry.layout();
      }
    });
  }

  function init() {
    if (typeof Masonry === 'undefined' || typeof imagesLoaded === 'undefined') {
      return;
    }
    document.querySelectorAll('.image-gallery').forEach(initGallery);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(reflowAll, 150);
  });
})();
