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
  var EYE_R = 8;              // 기본 눈 반지름 (round 눈과 같은 크기)

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

  /* 둥근 눈을 직선으로 잘라낸 모양.
     cutAngle: 자르는 선의 기울기 (왼쪽 눈 기준, 오른쪽 눈은 좌우 대칭)
     cutRatio: 중심에서 자르는 선까지의 거리 (반지름 대비)
     잘린 모서리는 같은 색으로 한 번 더 그어(lineJoin: round) 살짝 둥글린다. */
  function cutEye(ctx, x, y, side, cutAngle, cutRatio, color, glint) {
    var round = 1.5;                       // 모서리 둥글기
    var r = EYE_R - round;                 // 선 두께의 절반만큼 미리 줄여 그린다
    var d = EYE_R * cutRatio - round;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-side * cutAngle);

    ctx.beginPath();
    if (d >= r) {
      ctx.arc(0, 0, r, 0, TAU);
    } else {
      var h = Math.sqrt(r * r - d * d);    // 잘린 면의 반쪽 길이
      var a = Math.atan2(d, h);
      ctx.arc(0, 0, r, -a, Math.PI + a, false);
      ctx.closePath();
    }
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = round * 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.fill();
    ctx.restore();

    // 반사점은 기울기와 상관없이 항상 왼쪽 위 (다른 눈들과 빛 방향을 맞춘다)
    ctx.fillStyle = GLINT;
    ctx.beginPath();
    ctx.arc(x + glint[0] * EYE_R, y + glint[1] * EYE_R, glint[2] * EYE_R, 0, TAU);
    ctx.fill();
  }

  /* 눈 종류. (ctx, x, y, side, color) */
  var EYE_STYLES = {
    round: function (ctx, x, y, side, c) {
      pupil(ctx, x, y, EYE_R, c, [[-0.32, -0.34, 0.3]]);
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
    upturned: function (ctx, x, y, side, c) {   // 올라간 눈: 안쪽 위를 비스듬히 자름
      cutEye(ctx, x, y, side, 0.28, 0.712, c, [-0.30, -0.26, 0.26]);
    },
    downturned: function (ctx, x, y, side, c) { // 내려간 눈: 바깥쪽 위를 비스듬히 자름
      cutEye(ctx, x, y, side, -0.38, 0.765, c, [-0.30, -0.26, 0.26]);
    },
    half: function (ctx, x, y, side, c) {       // 반 눈: 위를 수평으로 자름
      cutEye(ctx, x, y, side, 0, 0.5, c, [-0.30, -0.12, 0.23]);
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
