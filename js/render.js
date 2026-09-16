/* 한 프레임 그리기.
   미리보기도 GIF도 모두 이 함수를 쓴다.
   pose: 탱글 변형 값 { skewX, scaleX, scaleY }. 없으면 정지 상태. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING || (global.PUDDING = {});
  var CANVAS = PUDDING.CANVAS;

  var REST_POSE = { skewX: 0, scaleX: 1, scaleY: 1 };

  /* 바닥 중심을 고정한 채 위로 갈수록 크게 흔들리는 변형 */
  function applyPose(ctx, pose) {
    ctx.transform(pose.scaleX, 0, -pose.skewX, pose.scaleY, 0, 0);
  }

  function render(ctx, state, pose) {
    var p = pose || REST_POSE;

    ctx.save();
    // 캔버스가 고해상도(devicePixelRatio)로 잡혀 있어도 좌표는 항상 320 기준으로 쓴다
    var scale = ctx.canvas.width / CANVAS.SIZE;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // 배경
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, CANVAS.SIZE, CANVAS.SIZE);

    // 이후 모든 좌표는 푸딩 바닥 중심 기준
    ctx.translate(CANVAS.ORIGIN_X, CANVAS.ORIGIN_Y);

    // 고정 부위
    PUDDING.drawPlate(ctx, state);
    PUDDING.drawShadow(ctx, state, 1 + (p.scaleX - 1) * 0.6);

    // 탱글 변형이 적용되는 부위
    ctx.save();
    applyPose(ctx, p);
    PUDDING.drawBody(ctx, state);
    ctx.restore();

    if (PUDDING.DEBUG) {
      drawGuides(ctx);
    }

    ctx.restore();
  }

  /* ?debug=1 일 때 기준점을 표시해 좌표가 어긋나는지 눈으로 확인한다. */
  function drawGuides(ctx) {
    var A = PUDDING.ANCHOR;
    var B = PUDDING.BODY;

    ctx.save();
    ctx.strokeStyle = 'rgba(220, 70, 90, 0.7)';
    ctx.fillStyle = 'rgba(220, 70, 90, 0.7)';
    ctx.lineWidth = 1;

    // 중심선과 바닥선
    ctx.beginPath();
    ctx.moveTo(0, B.TOP_Y - 60);
    ctx.lineTo(0, B.BOT_Y + 60);
    ctx.moveTo(-140, 0);
    ctx.lineTo(140, 0);
    ctx.stroke();

    function dot(x, y, label) {
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '9px sans-serif';
      ctx.fillText(label, x + 5, y - 4);
    }

    dot(A.topCenter.x, A.topCenter.y, 'top');
    dot(A.faceCenter.x, A.faceCenter.y, 'face');
    dot(-A.eyeDx, A.faceCenter.y + A.eyeDy, 'eye');
    dot(A.eyeDx, A.faceCenter.y + A.eyeDy, '');
    dot(-A.earDx, A.earY, 'ear');
    dot(A.earDx, A.earY, '');
    dot(A.tail.x, A.tail.y, 'tail');
    dot(0, A.plateY, 'plate');
    dot(0, A.textY, 'text');

    ctx.restore();
  }

  PUDDING.REST_POSE = REST_POSE;
  PUDDING.applyPose = applyPose;
  PUDDING.render = render;
})(window);
