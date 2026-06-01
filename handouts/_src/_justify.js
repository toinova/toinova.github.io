/*
 * Justified Gallery layout（高さ充填・均等分割版）.
 * 各 .page--grid .body の .grid-item を、画像のアスペクト比を保ったまま（トリミングなし）
 * 行に分割し、各行を body 幅にぴったり揃える。
 *
 * 行数 R を 1..N で変え、各 R について「行ごとのアスペクト比合計が均等になる連続分割」を
 * DP（分散最小）で求める。行を増やすほど各画像は大きくなり総高さも増えるため、
 * body 高さに収まる範囲で総高さが最大になる R を採用する＝余白を最小化し画像を最大化。
 * どの R でも収まらない場合は、最も収まりに近い R を等倍縮小して収める。
 */
(function () {
  var GAP = 11; // px ≒ 3mm

  function sumRow(row, aspects) {
    var s = 0;
    for (var i = 0; i < row.length; i++) s += aspects[row[i]];
    return s;
  }

  // 連続分割で各行のアスペクト比合計を均等化（分散最小）する DP。
  // 行内画像数は固定幅に対して justified されるため、合計が揃う＝行高が揃う。
  function balancedPartition(aspects, R) {
    var n = aspects.length;
    var pre = [0];
    for (var i = 0; i < n; i++) pre.push(pre[i] + aspects[i]);
    var ideal = pre[n] / R;
    var INF = Infinity;
    var dp = [], back = [];
    for (var i = 0; i <= n; i++) {
      dp.push(new Array(R + 1).fill(INF));
      back.push(new Array(R + 1).fill(-1));
    }
    dp[0][0] = 0;
    for (var i = 1; i <= n; i++) {
      var rmax = Math.min(i, R);
      for (var r = 1; r <= rmax; r++) {
        for (var j = r - 1; j < i; j++) {
          if (dp[j][r - 1] === INF) continue;
          var s = pre[i] - pre[j];
          var d = s - ideal;
          var cost = dp[j][r - 1] + d * d;
          if (cost < dp[i][r]) { dp[i][r] = cost; back[i][r] = j; }
        }
      }
    }
    var rows = [];
    var ii = n, rr = R;
    while (rr > 0) {
      var j = back[ii][rr];
      var row = [];
      for (var k = j; k < ii; k++) row.push(k);
      rows.unshift(row);
      ii = j; rr--;
    }
    return rows;
  }

  function rowHeightsFor(rows, aspects, containerW) {
    return rows.map(function (row) {
      var s = sumRow(row, aspects);
      return (containerW - (row.length - 1) * GAP) / s;
    });
  }

  function totalOf(heights, rowCount) {
    var t = 0;
    for (var i = 0; i < heights.length; i++) t += heights[i];
    return t + (rowCount - 1) * GAP;
  }

  // アスペクト比配列を containerW × containerH に充填する最良レイアウト
  // （収まる範囲で総高さ最大の R を採用。どれも収まらなければ等倍縮小）を返す。
  function chooseFill(aspects, containerW, containerH) {
    var n = aspects.length;
    if (n === 0) return { rows: [], hs: [] };
    var best = null;      // 収まる中で総高さ最大
    var fallback = null;  // どれも収まらない場合の最小オーバーフロー
    for (var R = 1; R <= n; R++) {
      var rows = balancedPartition(aspects, R);
      var hs = rowHeightsFor(rows, aspects, containerW);
      var total = totalOf(hs, R);
      if (total <= containerH) {
        if (!best || total > best.total) best = { rows: rows, hs: hs, total: total };
      } else {
        if (!fallback || total < fallback.total) fallback = { rows: rows, hs: hs, total: total };
      }
    }
    if (!best) {
      var scale = containerH / fallback.total;
      best = { rows: fallback.rows, hs: fallback.hs.map(function (h) { return h * scale; }), total: containerH };
    }
    return best;
  }

  function applyLayout(body, items, aspects) {
    var containerW = body.clientWidth;
    var containerH = body.clientHeight;

    // data-maxh（px）を持つ要素は通常の充填フローから外し、最下段に小さく配置する。
    // （例：daylight house の「before」写真を大きく扱わないようにするため）
    var flow = [];      // フロー対象の items インデックス
    var capped = [];    // { i, maxh, h }
    items.forEach(function (item, i) {
      var mh = parseFloat(item.getAttribute('data-maxh'));
      if (!isNaN(mh) && mh > 0) capped.push({ i: i, maxh: mh });
      else flow.push(i);
    });

    // 最下段（capped）の高さ＝各要素を maxh に制限した最大値
    var cappedRowH = 0;
    capped.forEach(function (c) {
      c.h = Math.min(c.maxh, containerW / aspects[c.i]);
      if (c.h > cappedRowH) cappedRowH = c.h;
    });
    var reserved = capped.length ? (cappedRowH + GAP) : 0;
    var availH = Math.max(1, containerH - reserved);

    // フロー画像を availH に充填
    var aspF = flow.map(function (idx) { return aspects[idx]; });
    var layout = chooseFill(aspF, containerW, availH);
    var heights = layout.hs;
    var layoutRows = layout.rows;

    var rowYs = [];
    var y = 0;
    heights.forEach(function (h) { rowYs.push(y); y += h + GAP; });
    var totalContentH = y - (heights.length > 0 ? GAP : 0);
    var yOffset = Math.max(0, (availH - totalContentH) / 2);

    layoutRows.forEach(function (row, ri) {
      var actualH = heights[ri];
      // 等倍縮小時は行幅が containerW 未満になり得るため水平方向も中央寄せ
      var rowW = (row.length - 1) * GAP;
      row.forEach(function (li) { rowW += aspF[li] * actualH; });
      var xOffset = Math.max(0, (containerW - rowW) / 2);
      var x = 0;
      row.forEach(function (li) {
        var w = aspF[li] * actualH;
        var item = items[flow[li]];
        item.style.left = (x + xOffset) + 'px';
        item.style.top = (rowYs[ri] + yOffset) + 'px';
        item.style.width = w + 'px';
        item.style.height = actualH + 'px';
        x += w + GAP;
      });
    });

    // capped 行：最下段に右寄せ・下端揃えで配置
    if (capped.length) {
      var totalCapW = (capped.length - 1) * GAP;
      capped.forEach(function (c) { totalCapW += aspects[c.i] * c.h; });
      var cx = Math.max(0, containerW - totalCapW);
      capped.forEach(function (c) {
        var w = aspects[c.i] * c.h;
        var item = items[c.i];
        item.style.left = cx + 'px';
        item.style.top = (containerH - c.h) + 'px';
        item.style.width = w + 'px';
        item.style.height = c.h + 'px';
        cx += w + GAP;
      });
    }
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
