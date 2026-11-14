(function () {
  // 縦横比がこの値以上の画像・動画は、ギャラリーの 2 コマ分を使って表示する。
  // 値を上げれば対象は減り、下げれば増える（例: 2.0 にすると 2:1 の写真も幅広扱いになる）。
  var WIDE_RATIO = 2.4;

  function getGap() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--gallery-gap').trim();
    var px = parseInt(v, 10);
    return isNaN(px) ? 8 : px;
  }

  // item の中の画像／動画の縦横比を返す（読み込み前は 0）
  function mediaRatio(item) {
    var el = (item.tagName === 'IMG' || item.tagName === 'VIDEO')
      ? item
      : item.querySelector('img, video');
    if (!el) return 0;
    var w = el.naturalWidth || el.videoWidth || 0;
    var h = el.naturalHeight || el.videoHeight || 0;
    return h ? w / h : 0;
  }

  // 極端に横長のものに .wide を付ける（幅は CSS 側で 2 コマ分になる）。
  // 読み込み済みのものだけを判定するので、何度呼んでも結果は変わらない。
  function markWide(gallery) {
    Array.prototype.forEach.call(
      gallery.querySelectorAll('.gallery-item'),
      function (item) {
        var r = mediaRatio(item);
        if (!r) return;
        item.classList.toggle('wide', r >= WIDE_RATIO);
      }
    );
  }

  function initGallery(gallery) {
    Array.prototype.forEach.call(gallery.children, function (child) {
      child.classList.add('gallery-item');
    });

    // 列幅の基準。幅広の item が先頭に来ても列幅がずれないよう、
    // 1 コマ幅だけを持つ高さ 0 の要素を基準にする（gallery-item は付けない）。
    var sizer = document.createElement('div');
    sizer.className = 'grid-sizer';
    gallery.insertBefore(sizer, gallery.firstChild);

    var masonry = new Masonry(gallery, {
      itemSelector: '.gallery-item',
      columnWidth: '.grid-sizer',
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
        markWide(gallery);
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
        if (child === sizer) return;
        ro.observe(child);
      });
      gallery._masonryRO = ro;
    }
  }

  function reflowAll() {
    document.querySelectorAll('.image-gallery').forEach(function (gallery) {
      if (gallery._masonry) {
        gallery._masonry.options.gutter = getGap();
        markWide(gallery);
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
