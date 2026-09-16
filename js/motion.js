/* 움직임 정의와 프레임별 변형값 계산.
   모든 움직임은 프레임 f와 전체 프레임 수 N으로만 계산한다(t = f / N).
   미리보기와 GIF가 같은 값을 쓰기 때문에, 화면에서 본 느낌이 그대로 GIF가 된다. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING || (global.PUDDING = {});
  var TAU = Math.PI * 2;

  // delay는 GIF가 10ms 단위로만 저장하므로 10의 배수로 둔다.
  var MOTIONS = {
    // 대기: 숨 쉬듯 말랑말랑 (60프레임 × 50ms = 3.0초, 20fps)
    idle: { frames: 60, delay: 50 },
    // 탱글: 톡 쳤을 때의 감쇠 진동 (60프레임 × 40ms = 2.4초, 25fps)
    jiggle: { frames: 60, delay: 40 }
  };

  // 대기 루프 안에서 눈을 깜빡이는 구간 (프레임 번호)
  var BLINK_FROM = 44;
  var BLINK_TO = 48;

  // 대기 동작 세기
  var IDLE_SQUASH = 0.03;   // 위아래로 눌렸다 늘어나는 정도
  var IDLE_SWAY = 0.012;    // 좌우로 기우는 정도

  // 탱글 동작 세기
  var JIGGLE_SWAY = 0.2;    // 기울기 최대치
  var JIGGLE_SQUASH = 0.11; // 납작/늘어남 최대치
  var JIGGLE_DAMP = 3.4;    // 감쇠 (클수록 빨리 멎는다)
  var JIGGLE_CYCLES = 4.5;  // 흔들리는 횟수 (0.5의 배수여야 마지막에 0으로 끝난다)
  var JIGGLE_ACTIVE = 0.8;  // 앞쪽 80%만 흔들리고 나머지는 정지 → 루프가 이어진다

  /* 부피가 유지되는 느낌을 주려고 세로로 늘면 가로로 줄인다. */
  function squashPose(squash, skewX, blink) {
    return {
      skewX: skewX,
      scaleX: 1 - squash * 0.6,
      scaleY: 1 + squash,
      blink: !!blink
    };
  }

  function idlePose(t, f) {
    var w = Math.sin(TAU * t);
    var blink = f >= BLINK_FROM && f < BLINK_TO;
    return squashPose(IDLE_SQUASH * w, IDLE_SWAY * w, blink);
  }

  /* dir: 1이면 오른쪽으로 먼저 기울고, -1이면 왼쪽으로 먼저 기운다. */
  function jigglePose(t, dir) {
    if (t >= JIGGLE_ACTIVE) {
      return PUDDING.REST_POSE;
    }
    var u = t / JIGGLE_ACTIVE;
    var decay = Math.exp(-JIGGLE_DAMP * u);
    // 기울기: 감쇠 진동. u=0과 u=1에서 모두 0이라 정지 구간과 매끄럽게 이어진다.
    var sway = decay * Math.sin(TAU * JIGGLE_CYCLES * u);
    // 납작/늘어남: 기울기의 두 배 빠르기로 오르내린다.
    var squash = decay * Math.sin(TAU * JIGGLE_CYCLES * 2 * u);
    return squashPose(-JIGGLE_SQUASH * squash, JIGGLE_SWAY * sway * (dir || 1));
  }

  /* 움직임 이름과 프레임 번호로 변형값을 얻는다. */
  function poseFor(motion, f, dir) {
    var m = MOTIONS[motion];
    if (!m) { return PUDDING.REST_POSE; }
    var t = (f % m.frames) / m.frames;
    var n = f % m.frames;
    return motion === 'jiggle' ? jigglePose(t, dir) : idlePose(t, n);
  }

  PUDDING.MOTIONS = MOTIONS;
  PUDDING.poseFor = poseFor;
})(window);
