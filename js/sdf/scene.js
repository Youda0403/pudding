/* WebGL2 장면. 셰이더 컴파일과 유니폼 전달만 한다.
   프로토타입(proto/cat.html)과 사이트가 같은 이 파일을 쓴다. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING || (global.PUDDING = {});

  // 기본값. 사이트의 초기 상태이자 프로토타입이 쓰는 값이다.
  var DEFAULTS = {
    mode: 0,          // 0 완성 / 1 정면 실루엣 / 2 측면 실루엣
    jiggle: 0,        // 흔들림 세기
    animal: 0,        // 0~7
    eye: 0,           // 0~4
    mouth: 0,         // 0~5
    syrup: 0,         // 0 없음 / 1 접시에 웅덩이
    cherry: 0,        // 0/1
    cream: 0,         // 0/1
    sprinkle: 0,      // 0/1
    plateStyle: 0, quality: 0,
    az: 0.40, el: 0.26, dist: 6.00,
    // 예전에 셰이더에 박혀 있던 색들. 조명 계산은 선형 공간에서 하므로
    // 그 선형 값을 sRGB 로 되돌린 값이다 (예: 눈 0.135 → 0x67).
    body:  '#f6e7c7',
    ink:   '#675347',
    syrupCol: '#99501f',
    plate: '#faf9f7',
    bg:    '#e5d6c3'
  };

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src.trim());
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh));
    }
    return sh;
  }

  /* '#rrggbb' → [r, g, b] (0~1). 셰이더 안에서 선형으로 바꾼다. */
  function rgb01(hex) {
    var c = PUDDING.color.toRgb(hex);
    return [c.r / 255, c.g / 255, c.b / 255];
  }

  function createScene(canvas) {
    var gl = canvas.getContext('webgl2', {
      antialias: false,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false   // 저장은 draw 직후 같은 작업에서 캡처한다
    });
    if (!gl) throw new Error('WebGL2를 쓸 수 없습니다.');

    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, PUDDING.VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, PUDDING.FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    ['uRes', 'uTime', 'uMode', 'uCam', 'uJiggle', 'uEye', 'uMouth', 'uAnimal',
     'uBody', 'uInk', 'uSyrupCol', 'uSyrup', 'uCherry', 'uCream', 'uSprinkle',
     'uPlate', 'uBg', 'uPlateStyle', 'uQuality'].forEach(function (name) {
      U[name] = gl.getUniformLocation(prog, name);
    });

    var scene = {};
    Object.keys(DEFAULTS).forEach(function (k) { scene[k] = DEFAULTS[k]; });

    scene.gl = gl;
    scene.canvas = canvas;

    scene.draw = function (t) {
      // 캔버스 크기가 바뀌었을 수 있으니 뷰포트를 매번 맞춘다
      // (안 맞추면 큰 해상도로 뽑을 때 왼쪽 아래 일부만 그려진다)
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, t || 0);
      gl.uniform1f(U.uMode, scene.mode);
      gl.uniform1f(U.uPlateStyle, scene.plateStyle);
      gl.uniform1f(U.uQuality, scene.quality);
      gl.uniform3f(U.uCam, scene.az, scene.el, scene.dist);
      gl.uniform1f(U.uJiggle, scene.jiggle);
      gl.uniform1f(U.uEye, scene.eye);
      gl.uniform1f(U.uMouth, scene.mouth);
      gl.uniform1f(U.uAnimal, scene.animal);
      gl.uniform1f(U.uSyrup, scene.syrup);
      gl.uniform1f(U.uCherry, scene.cherry);
      gl.uniform1f(U.uCream, scene.cream);
      gl.uniform1f(U.uSprinkle, scene.sprinkle);
      gl.uniform3fv(U.uBody, rgb01(scene.body));
      gl.uniform3fv(U.uInk, rgb01(scene.ink));
      gl.uniform3fv(U.uSyrupCol, rgb01(scene.syrupCol));
      gl.uniform3fv(U.uPlate, rgb01(scene.plate));
      gl.uniform3fv(U.uBg, rgb01(scene.bg));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // drawImage/readPixels synchronize only when exporting. Never stall every preview frame.
    };

    return scene;
  }

  PUDDING.SDF_DEFAULTS = DEFAULTS;
  PUDDING.createScene = createScene;
})(typeof window !== 'undefined' ? window : globalThis);
