/* 애니메이션 GIF 인코더. 외부 라이브러리 없이 이 파일 하나로 끝난다.

   GIF 는 한 프레임에 256색까지만 쓸 수 있는데 푸딩은 그라데이션이 많아서,
   색을 고르는 방법이 결과물의 거의 전부다. 그래서 두 단계로 나눴다.

     1. 팔레트  모든 프레임의 색을 15비트(5:5:5) 히스토그램에 모은 뒤
                median cut 으로 256칸까지 쪼갠다. 칸마다 그 안에 든 픽셀의
                (개수로 가중한) 평균색이 팔레트 한 칸이 된다.
     2. 칠하기  픽셀마다 가장 가까운 팔레트 색을 찾는다. 8×8 Bayer 로
                아주 약하게 흔들어(dither) 배경 그라데이션에 띠가 지는 걸 막는다.

   프레임 전체가 같은 팔레트를 쓰므로(global color table) 회전하는 동안
   색이 깜빡이지 않는다. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING || (global.PUDDING = {});

  /* ---------- 바이트 버퍼 ---------- */

  function Bytes() {
    this.buf = new Uint8Array(1 << 16);
    this.len = 0;
  }
  Bytes.prototype.need = function (n) {
    if (this.len + n <= this.buf.length) return;
    var cap = this.buf.length;
    while (cap < this.len + n) cap *= 2;
    var next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  };
  Bytes.prototype.u8 = function (v) {
    this.need(1);
    this.buf[this.len++] = v & 255;
  };
  Bytes.prototype.u16 = function (v) {          // GIF 는 리틀엔디언
    this.need(2);
    this.buf[this.len++] = v & 255;
    this.buf[this.len++] = (v >> 8) & 255;
  };
  Bytes.prototype.str = function (s) {
    for (var i = 0; i < s.length; i++) this.u8(s.charCodeAt(i));
  };
  Bytes.prototype.bytes = function (arr) {
    this.need(arr.length);
    this.buf.set(arr, this.len);
    this.len += arr.length;
  };
  Bytes.prototype.done = function () {
    return this.buf.slice(0, this.len);
  };

  /* ---------- 1. 팔레트: 15비트 히스토그램 + median cut ---------- */

  var BINS = 32768;                              // 32 × 32 × 32

  function key15(r, g, b) {
    return ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
  }

  function buildHistogram(frames) {
    var count = new Uint32Array(BINS);
    var sr = new Float64Array(BINS), sg = new Float64Array(BINS), sb = new Float64Array(BINS);
    for (var f = 0; f < frames.length; f++) {
      var px = frames[f];
      for (var i = 0; i < px.length; i += 4) {
        var r = px[i], g = px[i + 1], b = px[i + 2];
        var k = key15(r, g, b);
        count[k]++; sr[k] += r; sg[k] += g; sb[k] += b;
      }
    }
    var used = [];
    for (var k2 = 0; k2 < BINS; k2++) if (count[k2]) used.push(k2);
    return { count: count, sr: sr, sg: sg, sb: sb, used: used };
  }

  /* 한 상자를 가장 넓은 축의 '개수 절반' 자리에서 쪼갠다. */
  function splitBox(box, h) {
    var axis = box.axis;
    var shift = axis === 0 ? 10 : (axis === 1 ? 5 : 0);
    box.keys.sort(function (a, b) {
      return ((a >> shift) & 31) - ((b >> shift) & 31);
    });
    var half = box.total / 2, run = 0, cut = 0;
    for (var i = 0; i < box.keys.length - 1; i++) {
      run += h.count[box.keys[i]];
      if (run >= half) { cut = i + 1; break; }
    }
    if (cut <= 0 || cut >= box.keys.length) cut = box.keys.length >> 1;
    return [makeBox(box.keys.slice(0, cut), h), makeBox(box.keys.slice(cut), h)];
  }

  function makeBox(keys, h) {
    var total = 0, r0 = 32, r1 = -1, g0 = 32, g1 = -1, b0 = 32, b1 = -1;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      total += h.count[k];
      var r = (k >> 10) & 31, g = (k >> 5) & 31, b = k & 31;
      if (r < r0) r0 = r; if (r > r1) r1 = r;
      if (g < g0) g0 = g; if (g > g1) g1 = g;
      if (b < b0) b0 = b; if (b > b1) b1 = b;
    }
    // 사람 눈에 민감한 순서(초록 > 빨강 > 파랑)로 폭에 가중치를 준다
    var dr = (r1 - r0) * 1.0, dg = (g1 - g0) * 1.3, db = (b1 - b0) * 0.7;
    var axis = (dg >= dr && dg >= db) ? 1 : (dr >= db ? 0 : 2);
    return {
      keys: keys, total: total, axis: axis,
      spread: Math.max(dr, dg, db),
      splittable: keys.length > 1
    };
  }

  function buildPalette(frames, maxColors) {
    var h = buildHistogram(frames);
    var boxes = [makeBox(h.used, h)];

    while (boxes.length < maxColors) {
      // 가장 넓고 픽셀이 많은 상자부터 쪼갠다
      var best = -1, bestScore = 0;
      for (var i = 0; i < boxes.length; i++) {
        if (!boxes[i].splittable) continue;
        var score = boxes[i].spread * Math.sqrt(boxes[i].total);
        if (score > bestScore) { bestScore = score; best = i; }
      }
      if (best < 0) break;
      var pair = splitBox(boxes[best], h);
      boxes.splice(best, 1, pair[0], pair[1]);
    }

    var pal = new Uint8Array(maxColors * 3);
    for (var bi = 0; bi < boxes.length; bi++) {
      var keys = boxes[bi].keys, n = 0, ar = 0, ag = 0, ab = 0;
      for (var j = 0; j < keys.length; j++) {
        var k = keys[j];
        n += h.count[k]; ar += h.sr[k]; ag += h.sg[k]; ab += h.sb[k];
      }
      if (!n) n = 1;
      pal[bi * 3] = Math.round(ar / n);
      pal[bi * 3 + 1] = Math.round(ag / n);
      pal[bi * 3 + 2] = Math.round(ab / n);
    }
    return { table: pal, size: Math.max(boxes.length, 2) };
  }

  /* ---------- 2. 칠하기 ---------- */

  // 8×8 Bayer. -0.5 ~ +0.5 로 정규화해서 쓴다.
  var BAYER = (function () {
    var m = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
             12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
             3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
             15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
    var out = new Float32Array(64);
    for (var i = 0; i < 64; i++) out[i] = m[i] / 64 - 0.5;
    return out;
  })();

  /* 가장 가까운 팔레트 색 찾기의 캐시.
     히스토그램은 15비트면 충분하지만 캐시까지 15비트로 잡으면 안 된다 —
     칸 하나가 8단계라서 ±6 짜리 dither 가 반올림으로 통째로 사라진다.
     그래서 캐시는 18비트(칸 4단계)로 둔다. 팔레트가 하나뿐이므로
     모든 프레임이 이 캐시를 같이 쓴다. */
  var CACHE_BITS = 18;
  var CACHE_BINS = 1 << CACHE_BITS;

  function key18(r, g, b) {
    return ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
  }

  function quantize(px, w, h, pal, palSize, dither, cache) {
    var idx = new Uint8Array(w * h);
    var table = pal;

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var p = (y * w + x) * 4;
        var r = px[p], g = px[p + 1], b = px[p + 2];
        if (dither) {
          var d = BAYER[(y & 7) * 8 + (x & 7)] * dither;
          r += d; g += d; b += d;
          r = r < 0 ? 0 : (r > 255 ? 255 : r);
          g = g < 0 ? 0 : (g > 255 ? 255 : g);
          b = b < 0 ? 0 : (b > 255 ? 255 : b);
        }
        var k = key18(r, g, b);
        var best = cache[k];
        if (best < 0) {
          // 캐시에 없을 때만 256칸을 다 재 본다
          var bd = 1e9;
          for (var c = 0; c < palSize; c++) {
            var dr = r - table[c * 3], dg = g - table[c * 3 + 1], db = b - table[c * 3 + 2];
            var dist = dr * dr * 2 + dg * dg * 4 + db * db;   // 눈 민감도 가중
            if (dist < bd) { bd = dist; best = c; }
          }
          cache[k] = best;
        }
        idx[y * w + x] = best;
      }
    }
    return idx;
  }

  /* ---------- 3. LZW ---------- */

  function lzw(minCodeSize, idx, out) {
    var clearCode = 1 << minCodeSize;
    var eoiCode = clearCode + 1;
    var codeSize = minCodeSize + 1;
    var next = eoiCode + 1;
    var dict = new Map();

    // 비트는 아래 자리부터 채워 넣고, 255바이트짜리 덩어리로 끊어 쓴다
    var block = new Uint8Array(255), blockLen = 0;
    var acc = 0, accBits = 0;

    function flushBlock() {
      if (!blockLen) return;
      out.u8(blockLen);
      out.bytes(block.subarray(0, blockLen));
      blockLen = 0;
    }
    function emit(code) {
      acc |= code << accBits;
      accBits += codeSize;
      while (accBits >= 8) {
        block[blockLen++] = acc & 255;
        acc >>= 8; accBits -= 8;
        if (blockLen === 255) flushBlock();
      }
    }

    emit(clearCode);
    var prefix = idx[0];
    for (var i = 1; i < idx.length; i++) {
      var ch = idx[i];
      var k = (prefix << 8) | ch;
      var found = dict.get(k);
      if (found !== undefined) {
        prefix = found;
        continue;
      }
      emit(prefix);
      if (next < 4096) {
        dict.set(k, next);
        next++;
        // 방금 넣은 코드가 지금 비트수로 표현이 안 되면 한 비트 늘린다.
        // 디코더도 같은 자리에서 늘리기 때문에 순서가 어긋나면 안 된다.
        if (next > (1 << codeSize) && codeSize < 12) codeSize++;
      } else {
        // 12비트로도 모자라면 사전을 비우고 다시 시작한다
        emit(clearCode);
        dict.clear();
        codeSize = minCodeSize + 1;
        next = eoiCode + 1;
      }
      prefix = ch;
    }
    emit(prefix);
    emit(eoiCode);

    // 남은 비트 밀어내기
    while (accBits > 0) {
      block[blockLen++] = acc & 255;
      acc >>= 8; accBits -= 8;
      if (blockLen === 255) flushBlock();
    }
    flushBlock();
    out.u8(0);              // 덩어리 끝
  }

  /* ---------- 4. 조립 ---------- */

  /* opts = { width, height, frames: [RGBA Uint8ClampedArray, ...],
             delay: 1/100초 단위, loop: 0(무한), colors: 256, dither: 6 } */
  function encodeGif(opts) {
    var w = opts.width, h = opts.height;
    var frames = opts.frames;
    var colors = Math.min(opts.colors || 256, 256);
    var dither = opts.dither === undefined ? 3 : opts.dither;
    var delay = opts.delay === undefined ? 4 : opts.delay;

    var pal = buildPalette(frames, colors);
    var cache = new Int16Array(CACHE_BINS).fill(-1);
    var out = new Bytes();

    out.str('GIF89a');
    out.u16(w); out.u16(h);
    out.u8(0xF7);           // 전역 팔레트 있음 · 256칸
    out.u8(0); out.u8(0);

    var table = new Uint8Array(256 * 3);
    table.set(pal.table.subarray(0, Math.min(pal.table.length, 768)));
    out.bytes(table);

    // 반복 재생 (NETSCAPE2.0)
    out.u8(0x21); out.u8(0xFF); out.u8(0x0B);
    out.str('NETSCAPE2.0');
    out.u8(0x03); out.u8(0x01); out.u16(opts.loop || 0); out.u8(0);

    for (var i = 0; i < frames.length; i++) {
      out.u8(0x21); out.u8(0xF9); out.u8(0x04);
      out.u8(0x04);         // 처리 방식 1(그대로 두기) · 투명 없음
      out.u16(delay);
      out.u8(0); out.u8(0);

      out.u8(0x2C);
      out.u16(0); out.u16(0); out.u16(w); out.u16(h);
      out.u8(0);            // 지역 팔레트 없음 · 인터레이스 없음

      out.u8(8);            // LZW 최소 코드 크기
      lzw(8, quantize(frames[i], w, h, pal.table, pal.size, dither, cache), out);
    }

    out.u8(0x3B);
    return out.done();
  }

  PUDDING.encodeGif = encodeGif;
})(typeof window !== 'undefined' ? window : globalThis);
