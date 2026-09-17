/* 시럽. 몸통 윗면(ANCHOR.topCenter) 기준으로 그린다.
   윗면을 시럽으로 덮고, 앞쪽 가장자리에서 옆면으로 방울이 흘러내린다. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING || (global.PUDDING = {});
  var B = PUDDING.BODY;
  var color = PUDDING.color;
  var TAU = Math.PI * 2;

  var SYRUPS = {
    caramel:    { base: '#cb8b3c', dark: '#a2661f' },
    choco:      { base: '#70492f', dark: '#4e3020' },
    strawberry: { base: '#e76a85', dark: '#c44465' }
  };

  /* 흘러내리는 방울의 위치와 크기.
     t: 윗면 앞쪽 호를 따라가는 위치(0=오른쪽 끝, 1=왼쪽 끝)
     len/w: 기본 길이·폭에 곱할 비율 */
  var DRIPS = [
    { t: 0.14, len: 0.80, w: 0.95 },
    { t: 0.26, len: 1.30, w: 1.12 },
    { t: 0.50, len: 0.58, w: 0.85 },
    { t: 0.74, len: 1.10, w: 1.02 },
    { t: 0.86, len: 0.85, w: 1.00 }
  ];

  // 모양별 기본값. tip/neck은 폭에 대한 비율.
  var SHAPES = {
    drip: { len: 32, w: 9, tip: 0.5, neck: 0.42 },    // 길게 흘러내리고 끝이 방울처럼 맺힘
    pool: { len: 15, w: 11.5, tip: 0.72, neck: 0.72 } // 짧고 둥글게
  };

  var LIP_DY = 2;  // 시럽 두께: 윗면 타원을 이만큼 내려 한 번 더 그린다

  /* 방울 하나.
     붙은 자리는 넓고, 중간에서 한 번 잘록해졌다가, 끝에 방울이 맺힌다. */
  function dripPath(ctx, x, y, w, len, tip, neck) {
    var ny = y + len * 0.45;        // 잘록해지는 높이
    var ty = y + len - tip;         // 끝 방울의 중심
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.bezierCurveTo(x - w, y + len * 0.2, x - neck, ny - len * 0.12, x - neck, ny);
    ctx.bezierCurveTo(x - neck, ty - (ty - ny) * 0.3, x - tip, ty - tip * 0.8, x - tip, ty);
    ctx.arc(x, ty, tip, Math.PI, 0, true);
    ctx.bezierCurveTo(x + tip, ty - tip * 0.8, x + neck, ty - (ty - ny) * 0.3, x + neck, ny);
    ctx.bezierCurveTo(x + neck, ny - len * 0.12, x + w, y + len * 0.2, x + w, y);
    ctx.closePath();
  }

  function drawSyrup(ctx, state) {
    var c = SYRUPS[state.syrup] || SYRUPS.caramel;
    var shape = SHAPES[state.syrupShape] || SHAPES.drip;
    var lipY = B.TOP_Y + LIP_DY;

    ctx.save();

    // 몸통 밖으로 삐져나가지 않게
    PUDDING.bodyPath(ctx);
    ctx.clip();

    // 흘러내리는 방울 (윗면 앞쪽 호에 매달린다).
    // 위는 밝고 끝으로 갈수록 어둡게 해서 입체감을 준다.
    for (var i = 0; i < DRIPS.length; i++) {
      var d = DRIPS[i];
      var a = Math.PI * d.t;
      var x = B.TOP_HW * Math.cos(a);
      var y = lipY + B.TOP_RY * Math.sin(a);
      var w = shape.w * d.w;
      var len = shape.len * d.len;

      var g = ctx.createLinearGradient(0, y, 0, y + len);
      g.addColorStop(0, color.lighten(c.dark, 0.14));
      g.addColorStop(1, c.dark);
      ctx.fillStyle = g;
      dripPath(ctx, x, y, w, len, w * shape.tip, w * shape.neck);
      ctx.fill();

      // 방울 왼쪽에 얇은 광택
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - w * 0.5, y + len * 0.18);
      ctx.quadraticCurveTo(x - w * 0.38, y + len * 0.45, x - w * 0.3, y + len * 0.68);
      ctx.stroke();
    }

    // 시럽 두께(앞쪽 턱)
    ctx.beginPath();
    ctx.ellipse(0, lipY, B.TOP_HW, B.TOP_RY, 0, 0, TAU);
    ctx.fillStyle = c.dark;
    ctx.fill();

    // 윗면
    var grad = ctx.createLinearGradient(0, B.TOP_Y - B.TOP_RY, 0, B.TOP_Y + B.TOP_RY);
    grad.addColorStop(0, color.lighten(c.base, 0.12));
    grad.addColorStop(0.55, c.base);
    grad.addColorStop(1, color.darken(c.base, 0.1));
    ctx.beginPath();
    ctx.ellipse(0, B.TOP_Y, B.TOP_HW, B.TOP_RY, 0, 0, TAU);
    ctx.fillStyle = grad;
    ctx.fill();

    // 윗면 흰 하이라이트
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(0, B.TOP_Y, B.TOP_HW * 0.62, B.TOP_RY * 0.55, 0, Math.PI * 1.06, Math.PI * 1.46);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, B.TOP_Y, B.TOP_HW * 0.62, B.TOP_RY * 0.55, 0, Math.PI * 1.56, Math.PI * 1.74);
    ctx.stroke();

    ctx.restore();
  }

  PUDDING.SYRUPS = ['caramel', 'choco', 'strawberry'];
  PUDDING.SYRUP_SHAPES = ['drip', 'pool'];
  PUDDING.drawSyrup = drawSyrup;
})(window);
