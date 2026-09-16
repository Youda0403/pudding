/* 미리보기 캔버스 초기화, 대기 동작 재생, 누르면 탱글 반응 */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING;
  var CANVAS = PUDDING.CANVAS;

  var state = PUDDING.createState();
  var canvas = document.getElementById('preview');
  var ctx = canvas.getContext('2d');

  // 재생 중인 움직임
  var motion = 'idle';
  var frame = 0;
  var dir = 1;      // 탱글이 먼저 기우는 방향 (1: 오른쪽)
  var lastTime = 0;
  var carry = 0;    // 프레임을 넘기고 남은 시간(ms)

  PUDDING.DEBUG = /(^|[?&])debug=1(&|$)/.test(location.search);

  function setupCanvas() {
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    canvas.width = CANVAS.SIZE * dpr;
    canvas.height = CANVAS.SIZE * dpr;
    // 화면상 크기는 CSS가 정한다 (좁은 화면에서 비율 유지)
  }

  function draw() {
    PUDDING.render(ctx, state, PUDDING.poseFor(motion, frame, dir));
  }

  function playJiggle(fromDir) {
    motion = 'jiggle';
    frame = 0;
    dir = fromDir;
    carry = 0;
    draw();
  }

  function tick(now) {
    var m = PUDDING.MOTIONS[motion];
    if (!lastTime) { lastTime = now; }
    carry += now - lastTime;
    lastTime = now;

    var moved = false;
    while (carry >= m.delay) {
      carry -= m.delay;
      frame += 1;
      moved = true;
      if (motion === 'jiggle' && frame >= m.frames) {
        // 탱글을 한 번 재생하고 대기로 복귀
        motion = 'idle';
        frame = 0;
        m = PUDDING.MOTIONS.idle;
      }
    }
    if (moved) { draw(); }
    global.requestAnimationFrame(tick);
  }

  // 누른 위치가 왼쪽이면 오른쪽으로, 오른쪽이면 왼쪽으로 먼저 기운다
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width;
    playJiggle(x < 0.5 ? 1 : -1);
  });

  setupCanvas();
  draw();
  global.requestAnimationFrame(tick);

  // 개발용: 콘솔에서 상태를 만져보고 다시 그릴 수 있게 열어둔다
  PUDDING.app = {
    state: state,
    draw: draw,
    playJiggle: playJiggle,
    canvas: canvas,
    ctx: ctx,
    setMotion: function (name, f) { motion = name; frame = f || 0; draw(); }
  };
})(window);
