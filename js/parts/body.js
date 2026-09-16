/* 푸딩 몸통. 윗면이 조금 좁은 사다리꼴에 위아래를 타원으로 둥글린 모양. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING || (global.PUDDING = {});
  var B = PUDDING.BODY;
  var color = PUDDING.color;
  var TAU = Math.PI * 2;

  /* 몸통 실루엣 경로.
     윗면 타원의 뒤쪽 반 → 오른쪽 옆면 → 바닥 타원의 앞쪽 반 → 왼쪽 옆면.
     옆면은 위아래 타원과 접선이 맞도록 세로 방향 제어점을 써서 어깨를 둥글게 잇는다. */
  function bodyPath(ctx) {
    var cpTopY = B.TOP_Y + B.H * 0.42;
    var cpBotY = B.BOT_Y - B.H * 0.42;

    ctx.beginPath();
    // 윗면 타원의 위쪽 반 (-TOP_HW → +TOP_HW)
    ctx.ellipse(0, B.TOP_Y, B.TOP_HW, B.TOP_RY, 0, Math.PI, TAU);
    // 오른쪽 옆면
    ctx.bezierCurveTo(
      B.TOP_HW + B.SIDE_BOW, cpTopY,
      B.BOT_HW + B.SIDE_BOW * 0.3, cpBotY,
      B.BOT_HW, B.BOT_Y
    );
    // 바닥 타원의 아래쪽 반 (+BOT_HW → -BOT_HW)
    ctx.ellipse(0, B.BOT_Y, B.BOT_HW, B.BOT_RY, 0, 0, Math.PI);
    // 왼쪽 옆면
    ctx.bezierCurveTo(
      -(B.BOT_HW + B.SIDE_BOW * 0.3), cpBotY,
      -(B.TOP_HW + B.SIDE_BOW), cpTopY,
      -B.TOP_HW, B.TOP_Y
    );
    ctx.closePath();
  }

  function drawBody(ctx, state) {
    var base = state.bodyColor;

    ctx.save();

    // 옆면: 위는 밝고 아래로 갈수록 살짝 어둡게
    var grad = ctx.createLinearGradient(0, B.TOP_Y, 0, B.BOT_Y + B.BOT_RY);
    grad.addColorStop(0, color.lighten(base, 0.12));
    grad.addColorStop(0.6, base);
    grad.addColorStop(1, color.darken(base, 0.12));

    bodyPath(ctx);
    ctx.fillStyle = grad;
    ctx.fill();

    // 몸통 안쪽으로만 칠하도록 클립
    ctx.save();
    bodyPath(ctx);
    ctx.clip();

    // 바닥 근처에 은은한 그늘
    var bottomShade = ctx.createLinearGradient(0, B.BOT_Y - 26, 0, B.BOT_Y + B.BOT_RY);
    bottomShade.addColorStop(0, color.rgba(color.darken(base, 0.35), 0));
    bottomShade.addColorStop(1, color.rgba(color.darken(base, 0.35), 0.18));
    ctx.fillStyle = bottomShade;
    ctx.fillRect(-B.BOT_HW, B.BOT_Y - 26, B.BOT_HW * 2, B.BOT_RY + 26);

    // 접시에서 올라오는 반사광: 바닥 가장자리를 살짝 밝게 해
    // 몸통과 그림자가 한 덩어리로 보이지 않게 한다.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, B.BOT_Y, B.BOT_HW - 2, B.BOT_RY - 2, 0, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();

    // 오른쪽 아래 모서리 그늘
    var sideShade = ctx.createLinearGradient(B.BOT_HW - 46, 0, B.BOT_HW, 0);
    sideShade.addColorStop(0, color.rgba(color.darken(base, 0.3), 0));
    sideShade.addColorStop(1, color.rgba(color.darken(base, 0.3), 0.2));
    ctx.fillStyle = sideShade;
    ctx.fillRect(B.BOT_HW - 46, B.TOP_Y, 46, B.H + B.BOT_RY);

    // 왼쪽 위 흰 광택 (몸통 안쪽으로만 보이게)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-B.TOP_HW + 20, B.TOP_Y + 26);
    ctx.quadraticCurveTo(-B.TOP_HW + 6, B.TOP_Y + 40, -B.TOP_HW + 3, B.TOP_Y + 52);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-B.TOP_HW + 30, B.TOP_Y + 30);
    ctx.quadraticCurveTo(-B.TOP_HW + 21, B.TOP_Y + 40, -B.TOP_HW + 20, B.TOP_Y + 50);
    ctx.stroke();

    ctx.restore();

    // 윗면 타원: 옆면보다 밝게
    ctx.beginPath();
    ctx.ellipse(0, B.TOP_Y, B.TOP_HW, B.TOP_RY, 0, 0, TAU);
    ctx.fillStyle = color.lighten(base, 0.2);
    ctx.fill();

    // 윗면 뒤쪽 가장자리에만 얇은 그늘 (앞쪽은 그리지 않아 컵 테두리처럼 보이지 않게)
    ctx.beginPath();
    ctx.ellipse(0, B.TOP_Y, B.TOP_HW - 1.5, B.TOP_RY - 1.5, 0, Math.PI, TAU);
    ctx.strokeStyle = color.rgba(color.darken(base, 0.18), 0.35);
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  PUDDING.bodyPath = bodyPath;
  PUDDING.drawBody = drawBody;
})(window);
