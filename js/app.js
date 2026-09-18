/* 사이트. 셰이더 장면(js/sdf/scene.js)에 UI 를 붙이고, 저장할 때
   한 바퀴 도는 GIF 를 만든다(js/gif.js).

   화면에 보이는 것과 GIF 가 어긋나지 않도록, 두 경우 모두 같은 scene 객체를
   같은 draw() 로 그린다. GIF 는 캔버스 크기와 방위각만 바꿔 가며 뽑는다. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING;

  var ANIMALS = ['고양이', '강아지', '토끼', '롭이어', '곰', '쥐', '여우', '햄스터'];
  var EYES    = ['동글', '올라간', '내려간', '반', '웃는'];
  var MOUTHS  = ['ω', '^', '一', '웃는'];

  // 꾸미기는 서로 배타적이지 않다 — 체리와 생크림을 같이 올릴 수 있다.
  // 그래서 하나만 고르는 chip 이 아니라 각자 켜고 끄는 토글이다.
  var TOPPINGS = [
    { key: 'syrup',    label: '시럽 웅덩이' },
    { key: 'cherry',   label: '체리' },
    { key: 'cream',    label: '생크림' },
    { key: 'sprinkle', label: '스프링클' }
  ];

  // 고르기 쉬우라고 두는 기본 색. 색동그라미 말고 옆의 버튼을 누르면
  // 아무 색이나 직접 고를 수 있다.
  // 눈 목록은 2D 판(js/parts/eyes.js)과 같은 색이다.
  // 한 줄에 여섯 개까지만 둔다. 여덟 개를 두면 폰 가로폭에서 '직접 고르기'
  // 가 다음 줄로 밀려 색 한 줄이 세 줄을 차지한다.
  var SWATCHES = {
    body:     ['#f6e7c7', '#f8d3d8', '#d7e7bf', '#e0bb93', '#cfe4f0', '#ddd0ee'],
    ink:      ['#675347', '#3a2f2a', '#4a6fb0', '#7a5aa8', '#c0566a', '#3f8a63'],
    syrupCol: ['#cb8b3c', '#70492f', '#e76a85', '#8faf57', '#9b72c4', '#4f9bc7'],
    bg:       ['#e5d6c3', '#f0dfe2', '#dbe7d5', '#d6e0ec', '#e6dcef', '#c9bdb0']
  };
  var COLOR_ROWS = [
    { key: 'body',     name: '푸딩' },
    { key: 'ink',      name: '눈' },
    { key: 'syrupCol', name: '시럽' },
    { key: 'bg',       name: '배경' }
  ];

  var canvas = document.getElementById('view');
  var scene;
  try {
    scene = PUDDING.createScene(canvas);
  } catch (err) {
    document.querySelector('.stage').textContent = 'WebGL2를 쓸 수 없는 브라우저예요.';
    return;
  }

  /* ---------------------------------------------------------------
     흔들림

     셰이더의 흔들림은 세기(uJiggle)와 시각(uTime) 두 개로 정해진다.
     세기는 눌린 직후가 가장 크고 지수적으로 잦아든다. 시각은 누를 때마다
     0 으로 되돌린다 — 셰이더가 sin(t·2.4) 로 기울이므로, 되돌리지 않으면
     하필 sin 이 0 인 순간에 눌렸을 때 아무 일도 안 일어난 것처럼 보인다.
     0 에서 시작하면 늘 '기울었다가 반대로 넘어갔다가' 잦아든다.

     페이지를 열 때도 시계가 0 이라 한 번 통통 튀면서 나타난다.
     --------------------------------------------------------------- */
  var IDLE = 0.10;      // 가만히 있을 때
  var TAP  = 3.40;      // 눌렀을 때 더해지는 세기
  var FALL = 1.10;      // 잦아드는 속도 (시계 단위)
  var SPEED = 3.0;      // 초 → 시계. 셰이더의 sin(t*2.4) 가 이만큼 빨라진다

  var clock = 0;
  var last = (global.performance || Date).now();
  var exporting = false;

  function bounce() { clock = 0; }

  function fit() {
    if (exporting) return;
    // 레이마칭이라 픽셀 수가 곧 비용이다. 선명하되 너무 커지지 않게 640 에서 끊는다.
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = Math.min(Math.round(canvas.clientWidth * dpr) || 640, 640);
    if (canvas.width !== w) { canvas.width = w; canvas.height = w; }
  }

  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!exporting) {
      clock += dt * SPEED;
      scene.jiggle = IDLE + TAP * Math.exp(-clock * FALL);
      fit();
      scene.draw(clock);
    }
    global.requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------
     드래그로 돌리기 · 누르면 통통
     --------------------------------------------------------------- */
  var drag = null;
  canvas.addEventListener('pointerdown', function (e) {
    drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    bounce();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag) return;
    scene.az -= (e.clientX - drag.x) * 0.007;
    scene.el = Math.max(-0.20, Math.min(0.95, scene.el + (e.clientY - drag.y) * 0.005));
    drag = { x: e.clientX, y: e.clientY };
  });
  function endDrag() { drag = null; }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  /* ---------------------------------------------------------------
     선택 UI
     --------------------------------------------------------------- */
  function buildChips(hostId, labels, key) {
    var host = document.getElementById(hostId);
    var buttons = labels.map(function (label, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = label;
      b.addEventListener('click', function () {
        scene[key] = i;
        sync();
        bounce();
      });
      host.appendChild(b);
      return b;
    });
    return function () {
      buttons.forEach(function (b, i) {
        b.setAttribute('aria-pressed', scene[key] === i ? 'true' : 'false');
      });
    };
  }

  /* 서로 배타적이지 않은 켜고 끄는 토글. 값은 scene[key] 에 0/1 로 들어간다
     (셰이더가 float 로 uSyrup/uCherry/uCream/uSprinkle 을 받으므로 그대로 넘긴다). */
  function buildToggles(hostId, items) {
    var host = document.getElementById(hostId);
    var buttons = items.map(function (item) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = item.label;
      b.addEventListener('click', function () {
        scene[item.key] = scene[item.key] ? 0 : 1;
        sync();
        bounce();
      });
      host.appendChild(b);
      return { el: b, key: item.key };
    });
    return function () {
      buttons.forEach(function (b) {
        b.el.setAttribute('aria-pressed', scene[b.key] ? 'true' : 'false');
      });
    };
  }

  function buildColors() {
    var host = document.getElementById('colors');
    var refresh = [];
    COLOR_ROWS.forEach(function (row) {
      var el = document.createElement('div');
      el.className = 'row';

      var name = document.createElement('span');
      name.className = 'name';
      name.textContent = row.name;
      el.appendChild(name);

      // 색동그라미와 '직접 고르기' 는 한 줄로 묶어 두고, 좁으면 줄바꿈시킨다
      var sws_box = document.createElement('div');
      sws_box.className = 'sws';
      el.appendChild(sws_box);

      var sws = SWATCHES[row.key].map(function (hex) {
        // 누르는 영역은 38×44, 보이는 동그라미는 그 안의 30px.
        // 폰에서 동그라미 크기 그대로 두면 옆 색이 눌린다.
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sw';
        b.title = hex;
        var dot = document.createElement('i');
        dot.style.setProperty('--c', hex);
        b.appendChild(dot);
        b.addEventListener('click', function () {
          scene[row.key] = hex;
          sync();
        });
        sws_box.appendChild(b);
        return { el: b, hex: hex };
      });

      var pick = document.createElement('input');
      pick.type = 'color';
      pick.className = 'pick';
      pick.value = scene[row.key];
      pick.addEventListener('input', function () {
        scene[row.key] = pick.value;
        sync();
      });
      sws_box.appendChild(pick);

      host.appendChild(el);
      refresh.push(function () {
        sws.forEach(function (s) {
          s.el.setAttribute('aria-pressed',
            s.hex.toLowerCase() === String(scene[row.key]).toLowerCase() ? 'true' : 'false');
        });
        pick.value = scene[row.key];
      });
    });
    return function () { refresh.forEach(function (f) { f(); }); };
  }

  var refreshers = [
    buildChips('animals', ANIMALS, 'animal'),
    buildChips('eyes', EYES, 'eye'),
    buildChips('mouths', MOUTHS, 'mouth'),
    buildToggles('toppings', TOPPINGS),
    buildColors()
  ];
  function sync() { refreshers.forEach(function (f) { f(); }); }

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  document.getElementById('random').addEventListener('click', function () {
    scene.animal = Math.floor(Math.random() * ANIMALS.length);
    scene.eye    = Math.floor(Math.random() * EYES.length);
    scene.mouth  = Math.floor(Math.random() * MOUTHS.length);
    // 꾸미기는 다 같이 켜면 정신없으니 하나씩 확률을 낮게 둔다.
    TOPPINGS.forEach(function (t) { scene[t.key] = Math.random() < 0.32 ? 1 : 0; });
    COLOR_ROWS.forEach(function (row) { scene[row.key] = pick(SWATCHES[row.key]); });
    sync();
    bounce();
  });

  /* ---------------------------------------------------------------
     GIF 저장

     방위각을 한 바퀴 돌리면서 프레임을 모은다. 흔들림은 한 바퀴에 정확히
     두 번 진동하도록 시각을 넣어 주므로 첫 프레임과 끝 프레임이 이어진다.
     (셰이더가 sin(t*2.4) 를 쓰므로 t 는 2π·2/2.4 까지 간다)

     한 프레임씩 그리고 setTimeout 으로 넘겨 화면이 멈추지 않게 한다.
     --------------------------------------------------------------- */
  // 크기·프레임 수·dither 는 그대로 용량이 된다. 지금 값이 대략 500KB 다.
  // (dither 0 이면 396KB 지만 배경에 동심원 띠가 보이고, 3 이면 600KB)
  var GIF_FRAMES = 24;
  var GIF_SIZE = 300;
  var GIF_DELAY = 6;          // 1/100초 단위 → 24 × 60ms = 1.44초
  var GIF_DITHER = 2;

  var busy = document.getElementById('busy');
  var busyBar = document.getElementById('busyBar');
  var busyText = document.getElementById('busyText');
  var saveBtn = document.getElementById('save');

  function progress(ratio, text) {
    busyBar.style.width = Math.round(ratio * 100) + '%';
    if (text) busyText.textContent = text;
  }

  function saveGif(done) {
    if (exporting) return;
    exporting = true;
    saveBtn.disabled = true;
    busy.hidden = false;
    progress(0, 'GIF 만드는 중…');

    var keep = { w: canvas.width, h: canvas.height, az: scene.az, jiggle: scene.jiggle };
    canvas.width = GIF_SIZE;
    canvas.height = GIF_SIZE;

    var tmp = document.createElement('canvas');
    tmp.width = GIF_SIZE;
    tmp.height = GIF_SIZE;
    var ctx = tmp.getContext('2d', { willReadFrequently: true });

    var frames = [];
    var i = 0;

    function shoot() {
      var t = i / GIF_FRAMES;
      scene.az = keep.az + t * Math.PI * 2;
      scene.jiggle = 0.55;
      scene.draw(t * Math.PI * 2 * 2 / 2.4);
      ctx.drawImage(canvas, 0, 0);
      frames.push(ctx.getImageData(0, 0, GIF_SIZE, GIF_SIZE).data);
      i++;
      progress(i / GIF_FRAMES * 0.75);
      if (i < GIF_FRAMES) return global.setTimeout(shoot, 0);
      global.setTimeout(encode, 0);
    }

    function encode() {
      progress(0.8, '색 고르는 중…');
      global.setTimeout(function () {
        var bytes = PUDDING.encodeGif({
          width: GIF_SIZE, height: GIF_SIZE,
          frames: frames, delay: GIF_DELAY, dither: GIF_DITHER, loop: 0
        });
        progress(1, '받는 중…');

        canvas.width = keep.w;
        canvas.height = keep.h;
        scene.az = keep.az;
        scene.jiggle = keep.jiggle;
        exporting = false;
        saveBtn.disabled = false;
        busy.hidden = true;

        var blob = new Blob([bytes], { type: 'image/gif' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'tangle-pudding.gif';
        document.body.appendChild(a);
        a.click();
        a.remove();
        global.setTimeout(function () { URL.revokeObjectURL(url); }, 5000);

        if (done) done(bytes);
      }, 30);
    }

    shoot();
  }

  saveBtn.addEventListener('click', function () { saveGif(); });

  sync();
  fit();
  global.requestAnimationFrame(frame);

  // 헤드리스 점검용
  global.PUDDING_APP = { scene: scene, saveGif: saveGif, bounce: bounce };
})(window);
