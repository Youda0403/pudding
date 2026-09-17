/* 시럽. 몸통 윗면(ANCHOR.topCenter) 기준으로 그린다.
   윗면을 시럽 색으로 덮고, 살짝 내린 타원을 한 번 더 그려 두께만 표현한다. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING || (global.PUDDING = {});
  var B = PUDDING.BODY;
  var color = PUDDING.color;
  var TAU = Math.PI * 2;

  // 종류별 기본 색. 실제로 쓰는 색은 state.syrupColor 이고, 없으면 여기서 가져온다.
  var SYRUPS = {
    caramel:    '#cb8b3c',
    choco:      '#70492f',
    strawberry: '#e76a85'
  };

  // 시럽 색 고르기용 기본 목록
  var SYRUP_COLORS = [
    '#cb8b3c', // 카라멜
    '#70492f', // 초코
    '#e76a85', // 딸기
    '#8faf57', // 말차
    '#f0ddc2', // 우유
    '#9b72c4', // 포도
    '#4f9bc7', // 소다
    '#d9534f'  // 체리
  ];

  var LIP_DY = 2;  // 시럽 두께: 윗면 타원을 이만큼 내려 한 번 더 그린다

  function drawSyrup(ctx, state) {
    var base = state.syrupColor || SYRUPS[state.syrup] || SYRUPS.caramel;
    var dark = color.darken(base, 0.2);
    var lipY = B.TOP_Y + LIP_DY;

    ctx.save();

    // 몸통 밖으로 삐져나가지 않게
    PUDDING.bodyPath(ctx);
    ctx.clip();

    // 시럽 두께(앞쪽 턱)
    ctx.beginPath();
    ctx.ellipse(0, lipY, B.TOP_HW, B.TOP_RY, 0, 0, TAU);
    ctx.fillStyle = dark;
    ctx.fill();

    // 윗면
    var top = ctx.createLinearGradient(0, B.TOP_Y - B.TOP_RY, 0, B.TOP_Y + B.TOP_RY);
    top.addColorStop(0, color.lighten(base, 0.12));
    top.addColorStop(0.55, base);
    top.addColorStop(1, color.darken(base, 0.1));
    ctx.beginPath();
    ctx.ellipse(0, B.TOP_Y, B.TOP_HW, B.TOP_RY, 0, 0, TAU);
    ctx.fillStyle = top;
    ctx.fill();

    // 윗면 흰 하이라이트
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(0, B.TOP_Y, B.TOP_HW * 0.62, B.TOP_RY * 0.55, 0, Math.PI * 1.06, Math.PI * 1.46);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, B.TOP_Y, B.TOP_HW * 0.62, B.TOP_RY * 0.55, 0, Math.PI * 1.56, Math.PI * 1.74);
    ctx.stroke();

    ctx.restore();
  }

  PUDDING.SYRUPS = ['caramel', 'choco', 'strawberry'];
  PUDDING.SYRUP_BASE = SYRUPS;
  PUDDING.SYRUP_COLORS = SYRUP_COLORS;
  PUDDING.drawSyrup = drawSyrup;
})(window);
