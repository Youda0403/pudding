/* 동물 귀. 몸통보다 먼저 그려서 이음새를 몸통 뒤로 숨긴다.
   귀 하나를 "바깥쪽 = +x, 붙는 자리 = 원점" 좌표로 그리고,
   왼쪽 귀는 좌우를 뒤집어 같은 그림을 쓴다. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING || (global.PUDDING = {});
  var ANCHOR = PUDDING.ANCHOR;
  var color = PUDDING.color;
  var TAU = Math.PI * 2;

  var INNER = '#efa3a9';   // 귀 안쪽 분홍

  /* ---------- 귀 모양 조각들 ---------- */

  /* 뾰족한 삼각 귀. 끝만 둥글게. */
  function pointy(ctx, fill, bw, h, lean, tipR, dy) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(-bw, dy);
    ctx.arcTo(lean, dy - h, bw, dy, tipR);
    ctx.lineTo(bw, dy);
    ctx.closePath();
    ctx.fill();
  }

  /* 동그란 귀 */
  function round(ctx, fill, cx, cy, rx, ry) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.fill();
  }

  /* 길쭉하게 선 귀 (기울여 세운 타원) */
  function upright(ctx, fill, cx, cy, rx, ry, tilt) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* 늘어진 귀. angle이 클수록 바깥으로 눕는다.
     몸통 앞에 그리므로 붙는 자리도 둥글게 마감한다.
     start: 붙는 자리에서 귀 방향으로 밀어내는 거리(안쪽 귀를 그릴 때 쓴다) */
  function droop(ctx, fill, len, wTop, wBot, angle, start) {
    ctx.save();
    ctx.rotate(-angle);          // 바깥쪽(+x)으로 눕힌다
    ctx.translate(0, start || 0);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(0, 0, wTop, 0, Math.PI, true);   // 붙는 자리 둥글게
    ctx.quadraticCurveTo(-wBot * 1.15, len * 0.6, -wBot, len - wBot);
    ctx.arc(0, len - wBot, wBot, Math.PI, 0, true);
    ctx.quadraticCurveTo(wBot * 1.15, len * 0.6, wTop, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* ---------- 동물별 정의 ----------
     dx/dy: 귀가 붙는 자리 (ANCHOR.earY 기준)
     front: 늘어진 귀처럼 몸통 *앞에* 그려야 하는 경우 true
     draw : 귀 하나를 그린다 (바깥쪽 = +x) */
  var ANIMALS = {
    cat: {
      dx: 37, dy: 2,
      draw: function (ctx, c) {
        pointy(ctx, c.outer, 17, 38, 6, 7, 6);
        pointy(ctx, c.inner, 9, 22, 4, 5, 2);
      }
    },
    fox: {
      dx: 40, dy: 2,
      draw: function (ctx, c) {
        pointy(ctx, c.outer, 16, 42, 10, 4.5, 4);
        pointy(ctx, c.inner, 8.5, 26, 6, 3.5, 1);
      }
    },
    rabbit: {                       // 올라간 토끼 귀
      dx: 30, dy: 0,
      draw: function (ctx, c) {
        upright(ctx, c.outer, 5, -26, 10.5, 28, 0.14);
        upright(ctx, c.inner, 5.5, -26, 5.5, 20, 0.14);
      }
    },
    lop: {                          // 롭이어 토끼
      dx: 47, dy: 4, front: true,
      draw: function (ctx, c) {
        droop(ctx, c.outer, 58, 13, 16, 0.42, 0);
        droop(ctx, c.inner, 38, 7, 9.5, 0.42, 14);
      }
    },
    bear: {
      dx: 40, dy: -4,
      draw: function (ctx, c) {
        round(ctx, c.outer, 0, -8, 14, 13);
        round(ctx, c.inner, 1, -8, 7.5, 7);
      }
    },
    mouse: {
      dx: 44, dy: -2,
      draw: function (ctx, c) {
        round(ctx, c.outer, 0, -9, 18, 17);
        round(ctx, c.inner, 1.5, -8, 11, 10.5);
      }
    },
    dog: {
      dx: 48, dy: 2, front: true,
      draw: function (ctx, c) {
        droop(ctx, c.outer, 50, 16, 11, 0.32, 0);
        droop(ctx, c.inner, 32, 9, 6, 0.32, 13);
      }
    },
    squirrel: {                     // 다람쥐·햄스터
      dx: 34, dy: 0,
      draw: function (ctx, c) {
        pointy(ctx, c.outer, 15, 30, 3, 10, 5);
        pointy(ctx, c.inner, 7.5, 15, 2, 6, 2);
      }
    }
  };

  /* front: true면 몸통 앞에 그리는 귀만, 아니면 몸통 뒤에 그리는 귀만 그린다. */
  function drawEars(ctx, state, front) {
    var animal = ANIMALS[state.animal] || ANIMALS.cat;
    if (!animal.front !== !front) { return; }

    // 몸통보다 살짝 어둡게 해서 앞뒤 구분이 되게 한다
    var c = {
      outer: color.darken(state.bodyColor, front ? 0.11 : 0.07),
      inner: INNER
    };

    for (var s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.translate(s * animal.dx, ANCHOR.earY + animal.dy);
      ctx.scale(s, 1);              // 왼쪽 귀는 좌우 반전
      animal.draw(ctx, c);
      ctx.restore();
    }
  }

  PUDDING.ANIMALS = ['cat', 'rabbit', 'lop', 'bear', 'mouse', 'dog', 'fox', 'squirrel'];
  PUDDING.drawEars = drawEars;
})(window);
