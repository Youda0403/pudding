/* 눈·볼터치·입. 전부 얼굴 중심(ANCHOR.faceCenter) 기준으로 그린다.
   몸통 종류가 바뀌어도 위치가 어긋나지 않는다. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING || (global.PUDDING = {});
  var ANCHOR = PUDDING.ANCHOR;
  var TAU = Math.PI * 2;

  var INK = '#4b3423';        // 눈·입 색
  var BLUSH = 'rgba(240, 143, 146, 0.45)';

  /* 눈동자: 검은 원 + 흰 반사점 */
  function pupil(ctx, x, y, r, highlights) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    for (var i = 0; i < highlights.length; i++) {
      var h = highlights[i];
      ctx.beginPath();
      ctx.arc(x + h[0] * r, y + h[1] * r, h[2] * r, 0, TAU);
      ctx.fill();
    }
  }

  /* 선으로 그리는 눈 (곡선 방향만 다르다) */
  function curveEye(ctx, x, y, rx, ry, up) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (up) {
      ctx.ellipse(x, y + ry * 0.5, rx, ry, 0, Math.PI, TAU);   // 위로 볼록 (^)
    } else {
      ctx.ellipse(x, y - ry * 0.5, rx, ry, 0, 0, Math.PI);      // 아래로 볼록 (∪)
    }
    ctx.stroke();
  }

  var EYE_STYLES = {
    round: function (ctx, x, y) {
      pupil(ctx, x, y, 8, [[-0.32, -0.34, 0.3]]);
    },
    sparkle: function (ctx, x, y) {
      pupil(ctx, x, y, 9.2, [[-0.33, -0.33, 0.34], [0.28, 0.32, 0.18]]);
    },
    smile: function (ctx, x, y) {
      curveEye(ctx, x, y, 7.2, 5.4, true);
    },
    sleepy: function (ctx, x, y) {
      curveEye(ctx, x, y, 6.4, 4.2, false);
    }
  };

  function drawCheeks(ctx) {
    var y = ANCHOR.faceCenter.y + ANCHOR.cheekDy;
    ctx.fillStyle = BLUSH;
    for (var s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.ellipse(s * ANCHOR.cheekDx, y, 9, 5.6, 0, 0, TAU);
      ctx.fill();
    }
  }

  /* ω 모양 입 */
  function drawMouth(ctx) {
    var y = ANCHOR.faceCenter.y + ANCHOR.mouthDy;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-6.6, y);
    ctx.quadraticCurveTo(-3.3, y + 4.6, 0, y);
    ctx.quadraticCurveTo(3.3, y + 4.6, 6.6, y);
    ctx.stroke();
  }

  /* pose.blink 가 true면 눈 종류와 상관없이 감은 눈으로 그린다. */
  function drawEyes(ctx, state, pose) {
    var y = ANCHOR.faceCenter.y + ANCHOR.eyeDy;
    var style = EYE_STYLES[state.eyes] || EYE_STYLES.round;
    var blinking = pose && pose.blink;

    ctx.save();
    drawCheeks(ctx);

    for (var s = -1; s <= 1; s += 2) {
      var x = s * ANCHOR.eyeDx;
      if (blinking) {
        // 깜빡일 때는 눈 종류와 상관없이 납작한 선 한 줄
        curveEye(ctx, x, y, 7.6, 1.8, false);
      } else {
        style(ctx, x, y);
      }
    }

    drawMouth(ctx);
    ctx.restore();
  }

  PUDDING.EYE_STYLES = ['round', 'sparkle', 'smile', 'sleepy'];
  PUDDING.drawEyes = drawEyes;
})(window);
