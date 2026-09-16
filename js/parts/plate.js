/* 접시와 바닥 그림자. 탱글 변형의 영향을 받지 않는 고정 부위. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING || (global.PUDDING = {});
  var ANCHOR = PUDDING.ANCHOR;
  var color = PUDDING.color;
  var TAU = Math.PI * 2;

  var PLATE_RX = 127;
  var PLATE_RY = 33;
  var PLATE_THICK = 8;
  var SHADOW_HUE = '#9a6f42';

  /* 중심이 진하고 가장자리로 갈수록 투명해지는 타원 그림자 */
  function softEllipse(ctx, cx, cy, rx, ry, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    var g = ctx.createRadialGradient(0, 0, rx * 0.25, 0, 0, rx);
    g.addColorStop(0, color.rgba(SHADOW_HUE, alpha));
    g.addColorStop(0.65, color.rgba(SHADOW_HUE, alpha * 0.55));
    g.addColorStop(1, color.rgba(SHADOW_HUE, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawPlate(ctx, state) {
    var cy = ANCHOR.plateY;
    var base = state.plateColor;

    ctx.save();

    // 접시가 바닥에 놓인 그림자
    softEllipse(ctx, 0, cy + PLATE_THICK + 8, PLATE_RX * 0.98, PLATE_RY * 0.45, 0.16);

    // 접시 옆면(두께)
    ctx.fillStyle = color.darken(base, 0.16);
    ctx.beginPath();
    ctx.ellipse(0, cy + PLATE_THICK, PLATE_RX, PLATE_RY, 0, 0, TAU);
    ctx.fill();

    // 접시 윗면: 뒤쪽이 살짝 어둡고 앞쪽이 밝은 도자기 느낌
    var top = ctx.createLinearGradient(0, cy - PLATE_RY, 0, cy + PLATE_RY);
    top.addColorStop(0, color.darken(base, 0.07));
    top.addColorStop(0.45, base);
    top.addColorStop(1, color.lighten(base, 0.03));
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.ellipse(0, cy, PLATE_RX, PLATE_RY, 0, 0, TAU);
    ctx.fill();

    // 접시 가장자리(림)와 오목한 안쪽 면의 경계
    ctx.strokeStyle = color.darken(base, 0.1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, cy + 1, PLATE_RX - 17, PLATE_RY - 7, 0, 0, TAU);
    ctx.stroke();

    // 림 안쪽에 얇게 도는 그늘 (뒤쪽 반만)
    ctx.strokeStyle = color.rgba(SHADOW_HUE, 0.12);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, cy + 2, PLATE_RX - 19, PLATE_RY - 8, 0, Math.PI, TAU);
    ctx.stroke();

    // 앞쪽 왼편 유약 광택
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(0, cy, PLATE_RX - 8, PLATE_RY - 4, 0, Math.PI * 0.58, Math.PI * 0.92);
    ctx.stroke();

    ctx.restore();
  }

  /* 푸딩이 접시에 닿아 생기는 그림자.
     몸통에 가려지지 않고 앞·오른쪽으로 퍼져 나오도록 조금 치우쳐 그린다.
     widthScale: 탱글 변형에 맞춰 그림자 폭을 살짝 바꿀 때 쓴다(기본 1). */
  function drawShadow(ctx, state, widthScale) {
    var k = (typeof widthScale === 'number') ? widthScale : 1;
    var B = PUDDING.BODY;
    var base = B.BOT_Y + B.BOT_RY; // 푸딩이 접시에 닿는 최저점

    ctx.save();

    // 빛이 왼쪽 위에서 온다고 보고 오른쪽 아래로 드리운 그림자.
    // 몸통 옆으로 확실히 빠져나오도록 중심을 오른쪽으로 옮긴다.
    softEllipse(ctx, 36, base + 1, B.BOT_HW * 0.8 * k, 12, 0.16);

    // 닿는 자리의 그늘.
    // 몸통 바닥 타원과 같은 모양을 조금씩 아래로 밀어 겹쳐서,
    // 바닥 곡선을 따라 흐르는 초승달 모양 그늘을 만든다.
    // (위쪽은 몸통에 가려지므로 아래로 삐져나온 부분만 보인다)
    // 닿는 자리의 진한 그늘.
    // 짙은 중심이 몸통 바닥선 아래로 나오도록 중심을 내려 잡는다.
    softEllipse(ctx, 3, base + 4, B.BOT_HW * 0.8 * k, 8, 0.4);

    // 몸통 바닥 곡선을 따라 도는 좁고 진한 그늘(맞닿은 자리)
    ctx.strokeStyle = color.rgba(SHADOW_HUE, 0.26);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(2, B.BOT_Y + 2, B.BOT_HW * k - 3, B.BOT_RY, 0, Math.PI * 0.06, Math.PI * 0.94);
    ctx.stroke();

    ctx.restore();
  }

  PUDDING.drawPlate = drawPlate;
  PUDDING.drawShadow = drawShadow;
  PUDDING.PLATE = { RX: PLATE_RX, RY: PLATE_RY, THICK: PLATE_THICK };
})(window);
