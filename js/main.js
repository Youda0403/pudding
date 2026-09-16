/* 미리보기 캔버스 초기화와 그리기 */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING;
  var CANVAS = PUDDING.CANVAS;

  var state = PUDDING.createState();
  var canvas = document.getElementById('preview');
  var ctx = canvas.getContext('2d');

  PUDDING.DEBUG = /(^|[?&])debug=1(&|$)/.test(location.search);

  function setupCanvas() {
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    canvas.width = CANVAS.SIZE * dpr;
    canvas.height = CANVAS.SIZE * dpr;
    // 화면상 크기는 CSS가 정한다 (좁은 화면에서 비율 유지)
  }

  function draw() {
    PUDDING.render(ctx, state);
  }

  setupCanvas();
  draw();

  // 개발용: 콘솔에서 상태를 만져보고 다시 그릴 수 있게 열어둔다
  PUDDING.app = { state: state, draw: draw, canvas: canvas, ctx: ctx };
})(window);
