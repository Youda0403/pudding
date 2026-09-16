/* 접시와 바닥 그림자. 탱글 변형의 영향을 받지 않는 고정 부위. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING || (global.PUDDING = {});
  var ANCHOR = PUDDING.ANCHOR;
  var color = PUDDING.color;

  var PLATE_RX = 122;
  var PLATE_RY = 24;
  var PLATE_THICK = 7;

  function drawPlate(ctx, state) {
    var cx = 0;
    var cy = ANCHOR.plateY;
    var base = state.plateColor;

    ctx.save();

    // 접시 옆면(두께)
    ctx.fillStyle = color.darken(base, 0.11);
    ctx.beginPath();
    ctx.ellipse(cx, cy + PLATE_THICK, PLATE_RX, PLATE_RY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 접시 윗면
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.ellipse(cx, cy, PLATE_RX, PLATE_RY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 안쪽 오목한 테두리
    ctx.strokeStyle = color.darken(base, 0.08);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 1, PLATE_RX - 16, PLATE_RY - 5, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  /* 푸딩 바로 밑 반투명 그림자.
     widthScale: 탱글 변형에 맞춰 그림자 폭을 살짝 바꿀 때 쓴다(기본 1). */
  function drawShadow(ctx, state, widthScale) {
    var k = (typeof widthScale === 'number') ? widthScale : 1;
    var rx = PUDDING.BODY.BOT_HW * 0.96 * k;
    var ry = 10;

    ctx.save();
    ctx.fillStyle = 'rgba(122, 92, 66, 0.16)';
    ctx.beginPath();
    ctx.ellipse(0, ANCHOR.plateY - 8, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  PUDDING.drawPlate = drawPlate;
  PUDDING.drawShadow = drawShadow;
  PUDDING.PLATE = { RX: PLATE_RX, RY: PLATE_RY, THICK: PLATE_THICK };
})(window);
