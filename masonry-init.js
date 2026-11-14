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

    // Re-layout on any pending layout request (debounced via rAF to coalesce bursts)
    var rafId = null;
    function scheduleLayout() {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(function () {
        rafId = null;
        masonry.layout();
      });
    }

    // Images
    imagesLoaded(gallery, scheduleLayout).on('progress', scheduleLayout);

    // Videos: imagesLoaded does not handle <video>. Listen for metadata/data ready
    // so the gallery reflows once the actual video dimensions are known.
    var videos = gallery.querySelectorAll('video');
    Array.prototype.forEach.call(videos, function (video) {
      // If metadata already available
      if (video.readyState >= 1) {
        scheduleLayout();
      }
      video.addEventListener('loadedmetadata', scheduleLayout);
      video.addEventListener('loadeddata', scheduleLayout);
      video.addEventListener('canplay', scheduleLayout);
    });

    // ResizeObserver catches any other late-changing item size (lazy media, font swap, etc.)
    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(scheduleLayout);
      Array.prototype.forEach.call(gallery.children, function (child) {
        ro.observe(child);
      });
      gallery._masonryRO = ro;
    }
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
