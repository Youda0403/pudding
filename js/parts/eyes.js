/* 눈·볼터치·입. 전부 얼굴 중심(ANCHOR.faceCenter) 기준으로 그린다.
   몸통 종류가 바뀌어도 위치가 어긋나지 않는다. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING || (global.PUDDING = {});
  var ANCHOR = PUDDING.ANCHOR;
  var TAU = Math.PI * 2;

  var INK = '#4b3423';        // 입 색 (눈 색과 별개)
  var BLUSH = 'rgba(240, 143, 146, 0.45)';
  var GLINT = '#ffffff';

  // 눈 색 고르기용 기본 목록
  var EYE_COLORS = [
    '#4b3423', // 기본 갈색
    '#2f2b28', // 먹색
    '#4a6fb0', // 파랑
    '#7a5aa8', // 보라
    '#c0566a', // 붉은
    '#3f8a63'  // 초록
  ];

  /* ---------- 눈 그리기 조각들 ---------- */

  /* 동그란 눈동자 + 흰 반사점 */
  function pupil(ctx, x, y, r, color, highlights) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();

    ctx.fillStyle = GLINT;
    for (var i = 0; i < highlights.length; i++) {
      var h = highlights[i];
      ctx.beginPath();
      ctx.arc(x + h[0] * r, y + h[1] * r, h[2] * r, 0, TAU);
      ctx.fill();
    }
  }

  /* 선으로 그리는 눈 (곡선 방향만 다르다) */
  function curveEye(ctx, x, y, rx, ry, up, color) {
    ctx.strokeStyle = color;
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

  /* 기울어진 둥근 눈.
     tilt > 0 이면 바깥쪽 끝이 올라가고, < 0 이면 내려간다.
     side: -1 왼쪽 눈, 1 오른쪽 눈
     (ctx.rotate는 화면 기준 시계방향이라 왼쪽 눈은 +tilt, 오른쪽 눈은 -tilt) */
  function tiltedEye(ctx, x, y, side, tilt, rx, ry, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-side * tilt);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* 반 눈: 둥근 눈의 위쪽을 수평으로 잘라낸 모양 */
  function halfEye(ctx, x, y, color) {
    var rx = 8.3;
    var ry = 7.8;
    var cut = y - ry * 0.61; // 잘리는 높이

    ctx.save();
    ctx.beginPath();
    ctx.rect(x - rx - 1, cut, rx * 2 + 2, ry + 3);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* 눈 종류. (ctx, x, y, side, color) */
  var EYE_STYLES = {
    round: function (ctx, x, y, side, c) {
      pupil(ctx, x, y, 8, c, [[-0.32, -0.34, 0.3]]);
    },
    sparkle: function (ctx, x, y, side, c) {
      pupil(ctx, x, y, 9.2, c, [[-0.33, -0.33, 0.34], [0.28, 0.32, 0.18]]);
    },
    smile: function (ctx, x, y, side, c) {
      curveEye(ctx, x, y, 7.2, 5.4, true, c);
    },
    sleepy: function (ctx, x, y, side, c) {
      curveEye(ctx, x, y, 6.4, 4.2, false, c);
    },
    upturned: function (ctx, x, y, side, c) {   // 올라간 눈
      tiltedEye(ctx, x, y, side, 0.30, 8.15, 6.85, c);
    },
    downturned: function (ctx, x, y, side, c) { // 내려간 눈
      tiltedEye(ctx, x, y, side, -0.40, 8.15, 7.3, c);
    },
    half: function (ctx, x, y, side, c) {       // 반 눈
      halfEye(ctx, x, y, c);
    }
  };

  /* ---------- 입 ---------- */

  /* ω(3을 눕힌) 모양 */
  function mouthThree(ctx, y) {
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

  /* ^ 모양. 곡선으로 그리면 찡그린 입처럼 보여서 꺾인 선으로 그린다. */
  function mouthCaret(ctx, y) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-5.2, y + 2.8);
    ctx.lineTo(0, y - 2.2);
    ctx.lineTo(5.2, y + 2.8);
    ctx.stroke();
  }

  /* . 모양 (작고 동그란 입) */
  function mouthDot(ctx, y) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(0, y + 0.8, 3, 3.5, 0, 0, TAU);
    ctx.fill();
  }

  var MOUTH_STYLES = {
    three: mouthThree,
    caret: mouthCaret,
    dot: mouthDot
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

  /* pose.blink 가 true면 눈 종류와 상관없이 감은 눈으로 그린다. */
  function drawEyes(ctx, state, pose) {
    var y = ANCHOR.faceCenter.y + ANCHOR.eyeDy;
    var style = EYE_STYLES[state.eyes] || EYE_STYLES.round;
    var color = state.eyeColor || EYE_COLORS[0];
    var mouth = MOUTH_STYLES[state.mouth] || MOUTH_STYLES.three;
    var blinking = pose && pose.blink;

    ctx.save();
    drawCheeks(ctx);

    for (var s = -1; s <= 1; s += 2) {
      var x = s * ANCHOR.eyeDx;
      if (blinking) {
        // 깜빡일 때는 눈 종류와 상관없이 납작한 선 한 줄
        curveEye(ctx, x, y, 7.6, 1.8, false, color);
      } else {
        style(ctx, x, y, s, color);
      }
    }

    mouth(ctx, ANCHOR.faceCenter.y + ANCHOR.mouthDy);
    ctx.restore();
  }

  PUDDING.EYE_STYLES = ['round', 'sparkle', 'smile', 'sleepy', 'upturned', 'downturned', 'half'];
  PUDDING.MOUTH_STYLES = ['three', 'caret', 'dot'];
  PUDDING.EYE_COLORS = EYE_COLORS;
  PUDDING.drawEyes = drawEyes;
})(window);
