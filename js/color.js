/* 색 계산 유틸. 몸통 그라데이션과 그림자 색을 본체 색에서 파생시킨다. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING || (global.PUDDING = {});

  function clamp255(v) {
    return v < 0 ? 0 : (v > 255 ? 255 : Math.round(v));
  }

  function toRgb(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function toHex(rgb) {
    var n = (clamp255(rgb.r) << 16) | (clamp255(rgb.g) << 8) | clamp255(rgb.b);
    return '#' + ('000000' + n.toString(16)).slice(-6);
  }

  // amount: -1(검정) ~ 1(흰색)
  function shade(hex, amount) {
    var c = toRgb(hex);
    var target = amount >= 0 ? 255 : 0;
    var k = Math.abs(amount);
    return toHex({
      r: c.r + (target - c.r) * k,
      g: c.g + (target - c.g) * k,
      b: c.b + (target - c.b) * k
    });
  }

  function lighten(hex, amount) { return shade(hex, Math.abs(amount)); }
  function darken(hex, amount) { return shade(hex, -Math.abs(amount)); }

  function rgba(hex, alpha) {
    var c = toRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }

  PUDDING.color = {
    toRgb: toRgb,
    toHex: toHex,
    shade: shade,
    lighten: lighten,
    darken: darken,
    rgba: rgba
  };
})(window);
