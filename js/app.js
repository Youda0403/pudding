/* 사이트. 셰이더 장면(js/sdf/scene.js)에 UI 를 붙이고, 저장할 때
   한 바퀴 도는 GIF 를 만든다(js/gif.js).

   화면에 보이는 것과 GIF 가 어긋나지 않도록, 두 경우 모두 같은 scene 객체를
   같은 draw() 로 그린다. GIF 는 캔버스 크기와 방위각만 바꿔 가며 뽑는다. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING;
  var I18N = global.PUDDING_I18N;

  var ANIMALS = ['고양이', '강아지', '토끼', '롭이어', '곰', '쥐', '여우', '햄스터'];
  var EYES    = ['동글', '올라간', '내려간', '반', '웃는'];
  var MOUTHS  = ['ω', '^', '一', '웃는', '·', '활짝'];

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
    syrupCol: ['#99501f', '#70492f', '#e76a85', '#8faf57', '#9b72c4', '#4f9bc7'],
    bg:       ['#e5d6c3', '#f0dfe2', '#dbe7d5', '#d6e0ec', '#e6dcef', '#c9bdb0']
  };
  var MARKS = [
    {key:'mole',label:'점 1'}, {key:'mole2',label:'점 2'}, {key:'blush',label:'홍조'},
    {key:'scar',label:'흉터'}, {key:'freckles',label:'주근깨'}
  ];
  var COLOR_ROWS = [
    { key: 'body',     name: '푸딩' },
    { key: 'ink',      name: '눈·입' },
    { key: 'syrupCol', name: '시럽' },
    { key: 'bg',       name: '배경' }
  ];

  var canvas = document.getElementById('view');
  var scene;
  try {
    scene = PUDDING.createScene(canvas);
  } catch (err) {
    var stage = document.querySelector('.stage');
    stage.dataset.i18n = 'errors.webgl';
    stage.textContent = I18N.t('errors.webgl');
    return;
  }

  /* 정지 상태에서는 다시 그리지 않는다. 터치 후 실제 경과 시간으로
     감쇠시켜 느린 기기에서도 첫 동작이 수초 동안 늘어지지 않는다. */
  var exporting = false;
  var dirty = true;
  var bounceStart = null;
  var lastDraw = 0;
  var previewLimit = 360;
  var slowFrames = 0;
  var motionMode = 'rotate';
  var reducedMotion = global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var frameRequest = 0;
  function requestFrame(){
    if(!frameRequest && !exporting && !document.hidden)frameRequest=global.requestAnimationFrame(frame);
  }
  function invalidate(){dirty=true;requestFrame();}
  function bounce() {
    if (exporting) return;
    bounceStart = reducedMotion ? null : performance.now();
    lastDraw = 0;
    invalidate();
  }
  function fit() {
    var size = Math.min(Math.round(canvas.clientWidth * Math.min(global.devicePixelRatio || 1, 1.25)) || 300, previewLimit);
    if (canvas.width !== size) { canvas.width = size; canvas.height = size; invalidate(); }
  }
  function poseAt(seconds) {
    // 최대 기울기보다 복원감이 중심인, 3초 안에 끝나는 뾰잉.
    if (seconds >= 2.0) return {time: 0, amp: 0};
    var tail=Math.max(0,Math.min(1,(seconds-1.6)/0.3));
    return {time:seconds*3.5,amp:4.8*Math.exp(-seconds*1.9)*Math.pow(1-seconds/2.8,2)*(1-tail*tail*(3-2*tail))};
  }
  function frame(now) {
    frameRequest=0;
    if (exporting || document.hidden) return;
    fit();
    var active = bounceStart !== null;
    if (!dirty && !active) return;
    if (now-lastDraw < 1000/30) {requestFrame();return;}
    // RAF의 타임스탬프는 첫 셰이더 준비 작업보다 앞설 수도 있다.
    var elapsed = active ? Math.max(0,(performance.now()-bounceStart)/1000) : 3;
    var pose = poseAt(elapsed);
    if (elapsed >= 2.0) bounceStart = null;
    scene.jiggle = pose.amp;
    scene.quality = 0;
    scene.draw(pose.time);
    if (active && lastDraw) {
      var frameCost = now-lastDraw;
      if (frameCost > 65) slowFrames++; else slowFrames = Math.max(0,slowFrames-1);
      if (slowFrames >= 3 && previewLimit > 200) { previewLimit -= 40; slowFrames=0; }
    }
    lastDraw=now;
    dirty=false;
    if(bounceStart!==null)requestFrame();
  }
  global.addEventListener('resize', function(){invalidate();});
  document.addEventListener('visibilitychange', function(){
    bounceStart=null;invalidate();lastDraw=0;
  });

  /* ---------------------------------------------------------------
     드래그로 돌리기 · 누르면 통통
     --------------------------------------------------------------- */
  var drag = null;
  canvas.addEventListener('pointerdown', function (e) {
    if (exporting) return;
    drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    bounce();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag || exporting) return;
    invalidate();
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
      b.dataset.i18n = hostId + '.' + i;
      b.textContent = I18N.t(b.dataset.i18n);
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
      b.dataset.i18n = hostId + '.' + item.key;
      b.textContent = I18N.t(b.dataset.i18n);
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
      name.dataset.i18n = 'color.' + row.key;
      name.textContent = I18N.t(name.dataset.i18n);
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
      pick.dataset.i18nAria = 'colorPick.' + row.key;
      pick.setAttribute('aria-label', I18N.t(pick.dataset.i18nAria));
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

  function buildPositions(){
    var host=document.getElementById('markPositions');
    var fields=[];
    [{key:'mole',name:'점 1'},{key:'mole2',name:'점 2'},{key:'scar',name:'흉터'}].forEach(function(mark){
      var group=document.createElement('fieldset');group.className='position';
      var legend=document.createElement('legend');legend.dataset.i18n='position.'+mark.key;legend.textContent=I18N.t(legend.dataset.i18n);group.appendChild(legend);
      var inputs=[];
      [{axis:'X',name:'좌우',min:-85,max:85,step:1},
       {axis:'Y',name:'높이',min:24,max:65,step:1}].concat(mark.key==='scar'?[{axis:'Angle',name:'회전',min:-180,max:180,step:1}]:[]).forEach(function(item){
        var label=document.createElement('label');
        var title=document.createElement('span');title.dataset.i18n='axis.'+item.axis;title.textContent=I18N.t(title.dataset.i18n);label.appendChild(title);
        var input=document.createElement('input');input.type='range';
        input.id=mark.key+item.axis;input.min=item.min;input.max=item.max;input.step=item.step;
        input.dataset.i18nAria='position.aria.'+mark.key+'.'+item.axis;input.setAttribute('aria-label',I18N.t(input.dataset.i18nAria));
        input.addEventListener('input',function(){scene[mark.key+item.axis]=Number(input.value)/(item.axis==='Angle'?1:100);invalidate();});
        label.appendChild(input);group.appendChild(label);inputs.push({input:input,key:mark.key+item.axis,scale:item.axis==='Angle'?1:100});
      });
      var reset=document.createElement('button');reset.type='button';reset.className='position-reset';reset.dataset.i18n='position.reset';reset.textContent=I18N.t(reset.dataset.i18n);
      reset.addEventListener('click',function(){inputs.forEach(function(x){scene[x.key]=PUDDING.SDF_DEFAULTS[x.key];});sync();});
      group.appendChild(reset);host.appendChild(group);fields.push({group:group,key:mark.key,inputs:inputs});
    });
    return function(){fields.forEach(function(f){f.group.hidden=!scene[f.key];f.inputs.forEach(function(x){x.input.value=scene[x.key]*x.scale;});});};
  }

  var refreshers = [
    buildChips('animals', ANIMALS, 'animal'),
    buildChips('eyes', EYES, 'eye'),
    buildChips('mouths', MOUTHS, 'mouth'),
    buildChips('plates', ['기본', '꽃잎', '네잎클로버', '둥근 사각'], 'plateStyle'),
    buildToggles('toppings', TOPPINGS),
    buildToggles('faceDecor', MARKS),
    buildPositions(),
    buildChips('bgPatterns', ['민무늬','둥근 별','하트','스트라이프'], 'bgPattern'),
    buildColors()
  ];
  function sync() { invalidate(); refreshers.forEach(function (f) { f(); }); }

  /* GIF는 별도 장면으로 고정된 설정을 캡처한다. 인코딩은 worker에서
     수행하고, 완료/실패 어느 쪽이든 버튼과 미리보기를 복원한다. */
  var GIF_SIZE = 480;
  var GIF_DITHER = 6;
  var busy = document.getElementById('busy');
  var busyBar = document.getElementById('busyBar');
  var busyText = document.getElementById('busyText');
  var saveBtn = document.getElementById('save');
  var notice = document.getElementById('notice');
  function clearNotice() { notice.textContent = ''; notice.removeAttribute('data-i18n'); }
  function showNotice(key) { notice.dataset.i18n = key; notice.textContent = I18N.t(key); }
  function showError(err, fallback) {
    var key = I18N.errorKey(err && err.message);
    if (key) showNotice(key);
    else if (err && err.message) { clearNotice(); notice.textContent = err.message; }
    else showNotice(fallback);
  }
  var modeButtons = Array.prototype.slice.call(document.querySelectorAll('[data-motion]'));
  modeButtons.forEach(function(b){
    b.addEventListener('click',function(){
      motionMode=b.dataset.motion;
      modeButtons.forEach(function(el){el.setAttribute('aria-pressed',String(el===b));});
    });
  });

  function progress(ratio, text) {
    busyBar.style.width = Math.round(ratio * 100) + '%';
    if(text) { busyText.dataset.i18n = text; busyText.textContent = I18N.t(text); }
  }
  function encodeFrames(frames, delay) {
    var opts={width:GIF_SIZE,height:GIF_SIZE,frames:frames,delay:delay,dither:GIF_DITHER,loop:0};
    return new Promise(function(resolve,reject){
      var worker;
      try {worker=new Worker('js/gif-worker.js');}
      catch(e){reject(new Error('GIF 저장을 시작하지 못했어요. 새로고침 후 다시 시도해 주세요.'));return;}
      var timer=setTimeout(function(){worker.terminate();reject(new Error('저장 시간이 너무 길어졌어요. 다시 시도해 주세요.'));},90000);
      function end(){clearTimeout(timer);worker.terminate();}
      worker.onmessage=function(e){
        end();
        if(e.data.error) reject(new Error(e.data.error)); else resolve(new Uint8Array(e.data.bytes));
      };
      worker.onerror=function(){end();reject(new Error('GIF를 만들지 못했어요. 다시 시도해 주세요.'));};
      worker.postMessage(opts,frames.map(function(f){return f.buffer;}));
    });
  }
  function nextTask(){return new Promise(function(resolve){setTimeout(resolve,0);});}

  function downloadBlob(blob,name){
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=url;a.download=name;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},30000);
  }

  async function savePng(){
    if(exporting)return;
    exporting=true;
    clearNotice();busy.hidden=false;progress(0,'progress.pngPreparing');
    var controls=Array.prototype.slice.call(document.querySelectorAll('button,input'));
    controls.forEach(function(el){el.disabled=true;});
    // 마지막으로 화면에 그린 시점과 흔들림을 그대로 복사한다.
    var time=scene.lastTime || 0;
    var shot;
    try {
      var output=document.createElement('canvas');output.width=output.height=960;
      shot=PUDDING.createScene(output);
      Object.keys(PUDDING.SDF_DEFAULTS).forEach(function(k){shot[k]=scene[k];});
      // 미리보기와 조명 설정까지 같게 유지하고, 픽셀 수만 늘린다.
      shot.draw(time);
      var copy=document.createElement('canvas');copy.width=copy.height=960;
      copy.getContext('2d').drawImage(output,0,0);
      progress(0.8,'progress.pngSaving');
      var blob=await new Promise(function(resolve,reject){copy.toBlob(function(b){if(b)resolve(b);else reject(new Error('PNG를 만들지 못했어요.'));},'image/png');});
      downloadBlob(blob,'tangle-pudding.png');showNotice('notice.pngSaved');
      return blob;
    }catch(err){console.error(err);showError(err,'errors.pngSave');return null;}
    finally{
      if(shot){var ext=shot.gl.getExtension('WEBGL_lose_context');if(ext)ext.loseContext();}
      exporting=false;busy.hidden=true;controls.forEach(function(el){el.disabled=false;});
      invalidate();lastDraw=0;
    }
  }

  async function saveGif(done) {
    if(exporting) return;
    exporting=true;
    clearNotice();
    var controls=Array.prototype.slice.call(document.querySelectorAll('button,input'));
    controls.forEach(function(el){el.disabled=true;});
    busy.hidden=false;
    progress(0,'progress.gifPreparing');
    var outputCanvas=document.createElement('canvas');
    outputCanvas.width=outputCanvas.height=GIF_SIZE;
    var outputScene;
    try {
      outputScene=PUDDING.createScene(outputCanvas);
      Object.keys(PUDDING.SDF_DEFAULTS).forEach(function(k){outputScene[k]=scene[k];});
      outputScene.quality=1;
      var startAz=scene.az;
      var rotate=motionMode==='rotate';
      // 회전 4.8초/80프레임. 뾰잉은 미리보기와 같은 시간축으로 2초/40프레임.
      var count=rotate?80:40;
      var delay=rotate?6:5;
      var tmp=document.createElement('canvas');tmp.width=tmp.height=GIF_SIZE;
      var ctx=tmp.getContext('2d',{willReadFrequently:true});
      var frames=[];
      for(var i=0;i<count;i++){
        var pose=rotate?{time:i/count*Math.PI*4/2.4,amp:0.32}:poseAt(i*delay/100);
        outputScene.az=startAz+(rotate?i/count*Math.PI*2:0);
        outputScene.jiggle=pose.amp;
        outputScene.draw(pose.time);
        ctx.drawImage(outputCanvas,0,0);
        frames.push(ctx.getImageData(0,0,GIF_SIZE,GIF_SIZE).data);
        progress((i+1)/count*0.8,'progress.gifFrames');
        await nextTask();
      }
      progress(0.85,'progress.gifSaving');
      var bytes=await encodeFrames(frames,delay);
      var blob=new Blob([bytes],{type:'image/gif'});
      downloadBlob(blob,rotate?'tangle-pudding-rotate.gif':'tangle-pudding-bounce.gif');
      showNotice('notice.gifSaved');
      if(done) done(bytes);
      return bytes;
    } catch(err){
      console.error(err);
      showError(err,'errors.save');
      return null;
    } finally {
      if(outputScene) {var ext=outputScene.gl.getExtension('WEBGL_lose_context');if(ext)ext.loseContext();}
      exporting=false;busy.hidden=true;
      controls.forEach(function(el){el.disabled=false;});
      bounceStart=null;invalidate();lastDraw=0;
    }
  }

  document.getElementById('savePng').addEventListener('click',function(){savePng();});
  saveBtn.addEventListener('click', function () { saveGif(); });

  sync();
  fit();
  requestFrame();

  // 헤드리스 점검용
  global.PUDDING_APP = { scene: scene, saveGif: saveGif, savePng: savePng, bounce: bounce, redraw: function(){invalidate();} };
})(window);
