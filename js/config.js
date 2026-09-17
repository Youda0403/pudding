/* 캔버스 크기, 푸딩 좌표 기준 상수.
   모든 부위는 "푸딩 바닥 타원의 중심"을 원점(0,0)으로 하는 로컬 좌표를 쓴다.
   y는 위로 갈수록 음수(캔버스 기본 방향). */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING || (global.PUDDING = {});

  var CANVAS = {
    SIZE: 320,
    // 캔버스 안에서 로컬 원점이 놓이는 위치
    ORIGIN_X: 160,
    ORIGIN_Y: 206
  };

  // 몸통 크기 (동물 종류와 상관없이 고정)
  var BODY_H = 104;   // 바닥 중심에서 윗면 중심까지 높이
  var TOP_HW = 62;    // 윗면 반폭
  var BOT_HW = 82;    // 바닥 반폭
  var TOP_RY = 15;    // 윗면 타원의 세로 반지름(원근감)
  var BOT_RY = 17;    // 바닥 타원의 세로 반지름
  var SIDE_BOW = 8;   // 옆면이 바깥으로 살짝 불룩한 정도

  var TOP_Y = -BODY_H;
  var BOT_Y = 0;

  var BODY = {
    H: BODY_H,
    TOP_HW: TOP_HW,
    BOT_HW: BOT_HW,
    TOP_RY: TOP_RY,
    BOT_RY: BOT_RY,
    SIDE_BOW: SIDE_BOW,
    TOP_Y: TOP_Y,
    BOT_Y: BOT_Y
  };

  // 부위들이 공유하는 기준점.
  // 눈/시럽/글씨/귀는 전부 여기에 맞춰 그린다.
  var ANCHOR = {
    topCenter: { x: 0, y: TOP_Y },          // 윗면 중심
    faceCenter: { x: 0, y: TOP_Y + 52 },    // 얼굴 중심 (옆면 가운데보다 살짝 위)
    eyeDx: 23,                              // 얼굴 중심에서 눈까지 좌우 거리
    eyeDy: 0,
    cheekDx: 43,                            // 볼터치 위치
    cheekDy: 12,
    mouthDy: 16,                            // 얼굴 중심에서 입까지
    // 귀가 붙는 높이. 윗면 타원의 뒤쪽 가장자리보다 살짝 아래에 두어야
    // 귀 밑동이 몸통에 가려지면서 위로는 충분히 드러난다.
    earY: TOP_Y - 8,
    earDx: 38,                              // 귀 중심의 좌우 거리
    tail: { x: BOT_HW - 6, y: -24 },        // 꼬리가 붙는 위치
    // 접시 윗면 타원의 중심. 푸딩의 최저점(BOT_RY)과 거의 같은 높이로 두어야
    // 푸딩이 접시 면에 닿아 보인다. 2px 아래로 두어 살짝 내려앉은 느낌을 준다.
    plateY: BOT_RY - 2,
    textY: BOT_RY + 46                      // 접시 앞쪽 글씨 기준선
  };

  // 몸통 높이 h(로컬 y)에서의 반폭. 옆면 위에 무언가를 붙일 때 쓴다.
  function halfWidthAt(y) {
    var t = (y - TOP_Y) / (BOT_Y - TOP_Y); // 윗면 0 → 바닥 1
    if (t < 0) { t = 0; }
    if (t > 1) { t = 1; }
    return TOP_HW + (BOT_HW - TOP_HW) * t;
  }

  PUDDING.CANVAS = CANVAS;
  PUDDING.BODY = BODY;
  PUDDING.ANCHOR = ANCHOR;
  PUDDING.halfWidthAt = halfWidthAt;
})(window);
