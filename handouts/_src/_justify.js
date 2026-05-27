/*
 * Justified Gallery layout.
 * 各 .page--grid .body の中身（.grid-item）を画像のアスペクト比に応じて行に詰め、
 * 各行を body 幅にぴったり合わせて高さを揃える。トリミングなし。
 *
 * 行高ターゲットを 1px 刻みで線形探索し、body 高さに収まる最大値を採用する。
 * 最終行は他行との比で扱いを変える：
 *   - stretchedH ≤ prevH * 1.5  → そのまま伸長（行内は隙間ゼロ）
 *   - stretchedH > prevH * 1.5  → prevH に揃えてレターボックス（右側に余白）
 */
(function () {
  var GAP = 11; // px ≒ 3mm

  function sumAspects(row, aspects) {
    var s = 0;
    for (var i = 0; i < row.length; i++) s += aspects[row[i]];
    return s;
  }

  function packRows(aspects, containerW, targetH, gap) {
    var rows = [];
    var i = 0;
    while (i < aspects.length) {
      var row = [i];
      var asum = aspects[i];
      i++;
      while (i < aspects.length) {
        var newSum = asum + aspects[i];
        var newCount = row.length + 1;
        var fillW = newSum * targetH + (newCount - 1) * gap;
        var prevW = asum * targetH + (row.length - 1) * gap;
        if (Math.abs(fillW - containerW) < Math.abs(prevW - containerW)) {
          asum = newSum;
          row.push(i);
          i++;
          if (fillW >= containerW) break;
        } else {
          break;
        }
      }
      rows.push(row);
    }
    return rows;
  }

  function rowHeights(rows, aspects, containerW, gap) {
    // 非最終行は stretchedH（行幅を container にぴったり）
    var heights = rows.map(function (row, ri) {
      var asum = sumAspects(row, aspects);
      return (containerW - (row.length - 1) * gap) / asum;
    });
    // 最終行のみ補正
    if (rows.length > 1) {
      var last = rows[rows.length - 1];
      var lastAsum = sumAspects(last, aspects);
      var lastStretched = (containerW - (last.length - 1) * gap) / lastAsum;
      var prevH = heights[rows.length - 2];
      if (lastStretched > prevH * 1.5) {
        // 最終行が前行の 1.5 倍を超える → 前行高さに揃えてレターボックス（右に余白）
        heights[rows.length - 1] = prevH;
      } else {
        // それ以外はそのまま伸長
        heights[rows.length - 1] = lastStretched;
      }
    }
    return heights;
  }

  function totalHeight(rows, aspects, containerW, gap) {
    var hs = rowHeights(rows, aspects, containerW, gap);
    var t = 0;
    for (var i = 0; i < hs.length; i++) t += hs[i];
    t += (rows.length - 1) * gap;
    return t;
  }

  function applyLayout(body, items, aspects) {
    var containerW = body.clientWidth;
    var containerH = body.clientHeight;

    // 線形探索：body に収まる範囲で「画像面積（= containerW × 行高合計）」が最大になるレイアウトを採用
    var bestTotal = 0;
    var bestRows = null;
    for (var h = 50; h <= 700; h += 1) {
      var rows = packRows(aspects, containerW, h, GAP);
      // 1要素だけの行は見た目が悪いので、複数行ある時は単独行を含むレイアウトを除外
      var hasSingleton = false;
      if (rows.length > 1) {
        for (var ri = 0; ri < rows.length; ri++) {
          if (rows[ri].length === 1) { hasSingleton = true; break; }
        }
      }
      if (hasSingleton) continue;
      var total = totalHeight(rows, aspects, containerW, GAP);
      if (total <= containerH && total > bestTotal) {
        bestTotal = total;
        bestRows = rows;
      }
    }
    if (!bestRows) {
      // フォールバック：最小ターゲットで詰める
      bestRows = packRows(aspects, containerW, 50, GAP);
    }

    var heights = rowHeights(bestRows, aspects, containerW, GAP);
    // まず top=0 から積み上げて合計高さを算出
    var rowYs = [];
    var y = 0;
    heights.forEach(function (h, ri) {
      rowYs.push(y);
      y += h + GAP;
    });
    var totalContentH = y - (heights.length > 0 ? GAP : 0); // 最後の GAP を除く
    // body 高さからのスラックを上下均等に振り分けるためのオフセット
    var yOffset = Math.max(0, (containerH - totalContentH) / 2);

    bestRows.forEach(function (row, ri) {
      var actualH = heights[ri];
      var x = 0;
      row.forEach(function (i) {
        var w = aspects[i] * actualH;
        var item = items[i];
        item.style.left = x + 'px';
        item.style.top = (rowYs[ri] + yOffset) + 'px';
        item.style.width = w + 'px';
        item.style.height = actualH + 'px';
        x += w + GAP;
      });
    });
  }

  function processBody(body) {
    var items = Array.prototype.slice.call(body.querySelectorAll('.grid-item'));
    if (items.length === 0) return;

    var aspects = new Array(items.length);
    var pending = items.length;

    function onReady(i, ratio) {
      aspects[i] = ratio;
      pending--;
      if (pending === 0) applyLayout(body, items, aspects);
    }

    items.forEach(function (item, i) {
      var img = item.querySelector('img');
      if (!img) { onReady(i, 1.5); return; }
      if (img.complete && img.naturalWidth > 0) {
        onReady(i, img.naturalWidth / img.naturalHeight);
      } else {
        img.addEventListener('load', function () {
          onReady(i, img.naturalWidth / img.naturalHeight || 1.5);
        });
        img.addEventListener('error', function () { onReady(i, 1.5); });
      }
    });
  }

  function init() {
    document.querySelectorAll('.page--grid .body').forEach(processBody);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
