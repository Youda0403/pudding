/* 시럽. 몸통 윗면(ANCHOR.topCenter) 기준으로 그린다.
   윗면을 시럽으로 덮고, 앞쪽 가장자리에서 옆면으로 방울이 흘러내린다. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING || (global.PUDDING = {});
  var B = PUDDING.BODY;
  var color = PUDDING.color;
  var TAU = Math.PI * 2;

  // 종류별 기본 색. 실제로 쓰는 색은 state.syrupColor 이고, 없으면 여기서 가져온다.
  var SYRUPS = {
    caramel:    '#cb8b3c',
    choco:      '#70492f',
    strawberry: '#e76a85'
  };

  // 시럽 색 고르기용 기본 목록
  var SYRUP_COLORS = [
    '#cb8b3c', // 카라멜
    '#70492f', // 초코
    '#e76a85', // 딸기
    '#8faf57', // 말차
    '#f0ddc2', // 우유
    '#9b72c4', // 포도
    '#4f9bc7', // 소다
    '#d9534f'  // 체리
  ];

  /* 흘러내리는 방울의 위치와 크기.
     t: 윗면 앞쪽 호를 따라가는 위치(0=오른쪽 끝, 1=왼쪽 끝)
     len/w: 기본 길이·폭에 곱할 비율
     고정값이라 같은 상태면 항상 같은 그림이 나온다(GIF 프레임 간 흔들림 방지). */
  var DRIPS = [
    { t: 0.14, len: 0.85, w: 0.95 },
    { t: 0.26, len: 1.15, w: 1.12 },
    { t: 0.50, len: 0.70, w: 0.88 },
    { t: 0.74, len: 1.05, w: 1.02 },
    { t: 0.86, len: 0.90, w: 1.00 }
  ];

  // 모양별 기본값. neck/tip은 폭에 대한 비율.
  var SHAPES = {
    drip: { len: 26, w: 9.5, neck: 0.68, tip: 0.82 },  // 도톰하게 흘러내림
    pool: { len: 13, w: 12, neck: 0.82, tip: 0.78 }    // 짧고 둥글게
  };

  var LIP_DY = 2;  // 시럽 두께: 윗면 타원을 이만큼 내려 한 번 더 그린다

  /* 방울 하나.
     topY: 시럽 타원 *안쪽*에서 시작하는 높이. 여기서 시작해야 윗면과 이어져 보인다.
     edgeY: 시럽 가장자리 높이. 눈에 보이는 길이는 여기서부터 잰다. */
  function dripPath(ctx, x, topY, edgeY, w, len, neck, tip) {
    var ny = edgeY + len * 0.42;   // 잘록해지는 높이
    var ty = edgeY + len - tip;    // 끝 방울의 중심
    var up = ny - topY;
    var down = ty - ny;

    ctx.beginPath();
    ctx.moveTo(x - w, topY);
    ctx.bezierCurveTo(x - w, topY + up * 0.45, x - neck, ny - up * 0.35, x - neck, ny);
    ctx.bezierCurveTo(x - neck, ny + down * 0.7, x - tip, ty - tip * 0.8, x - tip, ty);
    ctx.arc(x, ty, tip, Math.PI, 0, true);
    ctx.bezierCurveTo(x + tip, ty - tip * 0.8, x + neck, ny + down * 0.7, x + neck, ny);
    ctx.bezierCurveTo(x + neck, ny - up * 0.35, x + w, topY + up * 0.45, x + w, topY);
    ctx.closePath();
  }

  function drawSyrup(ctx, state) {
    var base = state.syrupColor || SYRUPS[state.syrup] || SYRUPS.caramel;
    var dark = color.darken(base, 0.2);
    var shape = SHAPES[state.syrupShape] || SHAPES.drip;
    var lipY = B.TOP_Y + LIP_DY;

    ctx.save();

    // 몸통 밖으로 삐져나가지 않게
    PUDDING.bodyPath(ctx);
    ctx.clip();

    // 흘러내리는 방울.
    // 타원 안쪽(lipY)에서 시작해 아래 타원에 덮이게 하면 이음새가 생기지 않는다.
    for (var i = 0; i < DRIPS.length; i++) {
      var d = DRIPS[i];
      var a = Math.PI * d.t;
      var x = B.TOP_HW * Math.cos(a);
      var edgeY = lipY + B.TOP_RY * Math.sin(a);
      var w = shape.w * d.w;
      var len = shape.len * d.len;

      var tipR = w * shape.tip;
      var ty = edgeY + len - tipR;   // 끝 방울의 중심

      var g = ctx.createLinearGradient(0, edgeY, 0, edgeY + len);
      g.addColorStop(0, color.lighten(dark, 0.14));
      g.addColorStop(1, dark);
      ctx.fillStyle = g;
      dripPath(ctx, x, lipY, edgeY, w, len, w * shape.neck, tipR);
      ctx.fill();

      // 끝 방울에만 작은 광택 한 점 (긴 선을 그으면 긁힌 자국처럼 보인다)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.beginPath();
      ctx.ellipse(x - tipR * 0.4, ty - tipR * 0.35, tipR * 0.3, tipR * 0.22, -0.5, 0, TAU);
      ctx.fill();
    }

    // 시럽 두께(앞쪽 턱)
    ctx.beginPath();
    ctx.ellipse(0, lipY, B.TOP_HW, B.TOP_RY, 0, 0, TAU);
    ctx.fillStyle = dark;
    ctx.fill();

    // 윗면
    var top = ctx.createLinearGradient(0, B.TOP_Y - B.TOP_RY, 0, B.TOP_Y + B.TOP_RY);
    top.addColorStop(0, color.lighten(base, 0.12));
    top.addColorStop(0.55, base);
    top.addColorStop(1, color.darken(base, 0.1));
    ctx.beginPath();
    ctx.ellipse(0, B.TOP_Y, B.TOP_HW, B.TOP_RY, 0, 0, TAU);
    ctx.fillStyle = top;
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
  PUDDING.SYRUP_BASE = SYRUPS;
  PUDDING.SYRUP_COLORS = SYRUP_COLORS;
  PUDDING.SYRUP_SHAPES = ['drip', 'pool'];
  PUDDING.drawSyrup = drawSyrup;
})(window);
