/* SDF 셰이더 원본. 프로토타입(proto/cat.html)과 사이트가 같은 이 파일을 쓴다.
   한쪽만 고쳐져 모양이 갈라지는 일이 없도록 소스를 하나로 둔다. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING || (global.PUDDING = {});

  PUDDING.VS = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  PUDDING.FS = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  uRes;
uniform float uTime;
uniform float uMode;     // 0 완성 렌더 / 1 정면 실루엣 / 2 측면 실루엣
uniform vec3  uCam;      // 방위각, 고도, 거리
uniform float uJiggle;   // 흔들림 세기 (0 이면 정지)
uniform float uEye;      // 눈 종류 0 동글 / 1 올라간 / 2 내려간 / 3 반 / 4 웃는
uniform float uMouth;    // 0 ω / 1 ^ / 2 일자 / 3 웃는 / 4 점 / 5 활짝
uniform float uAnimal;   // 0 고양이 1 강아지 2 토끼 3 롭이어 4 곰 5 쥐 6 여우 7 햄스터

// 색은 전부 sRGB(0~1). 조명에 넣기 전에 선형으로 바꾼다.
uniform vec3  uBody;     // 커스터드 색
uniform vec3  uInk;      // 눈과 입의 공통 색
uniform vec3  uSyrupCol; // 시럽(웅덩이) 색
uniform float uSyrup;    // 0 없음 / 1 접시에 웅덩이
uniform float uCherry;   // 0/1 체리
uniform float uCream;    // 0/1 생크림
uniform float uSprinkle; // 0/1 스프링클
uniform float uPlateStyle; // 0 기본 / 1 꽃 / 2 타원 / 3 사각
uniform float uQuality; // 0 미리보기 / 1 저장
uniform vec3  uPlate;    // 접시 색
uniform vec3  uBg;       // 배경 색

/* =====================================================================
   고양이 푸딩 (Cat Pudding) — SDF

   설계 원칙
     · 푸딩은 표면장력이 있는 반고체다. 두 덩어리가 만나는 곳에 접선이
       꺾이는 모서리가 생길 수 없다. 그래서 덩어리를 합칠 때는 전부 smin,
       깎아낼 때는 전부 smax(=opSmoothSub) 를 쓴다. 날것의 min()/max() 는
       도형 하나를 정의하는 안쪽과, 서로 닿지 않는 얼굴 자국들을 모을 때만
       나온다 (닿지 않으므로 섞일 일도 없다).
     · 몸통은 구가 아니라 "틀에서 빼낸 젤리"다. 바닥이 가장 넓고 옆면이
       거의 수직이며, 위로 갈수록 중력에 눌린 돔으로 좁아진다.
     · 귀는 머리에 꽂힌 별개의 뿔이 아니라 머리에서 솟아오른 같은 덩어리다.
       밑동은 머리 속 깊이 묻고, 블렌딩 계수를 '좌우 위치'에 따라 바꿔
       "밑동은 완전히 녹아 붙고 / 두 귀 사이 골은 살아있는" 실루엣을 만든다.
     · 몸통·귀의 치수는 레퍼런스 그림을 픽셀 단위로 재서 맞췄다. 정면과
       측면을 같은 척도로 재면 단면 비율까지 나오므로, 눈대중으로는
       잡히지 않는 "위로 갈수록 앞뒤가 얇아지는" 형태가 드러난다.

   좌표계: 접시면이 y=0, 위가 +y, 카메라 쪽이 +z.
           길이 단위는 몸통 바닥 반폭 0.66 기준 (전체 높이 ≈ 1.15).
   ===================================================================== */

/* ---------------------------------------------------------------------
   1. Smooth minimum 계열 — 말랑함의 핵심

   smin(a,b,k) 는 |a-b| < k 인 구간에서만 두 거리장을 C1 연속으로 섞는다.
   섞이는 동안 결과가 min 보다 최대 k/4 작아지는데(=표면이 그만큼 부풀어
   오른다), 이 부풀음이 바로 물방울이 합쳐질 때 생기는 목(neck)이다.
   --------------------------------------------------------------------- */

// 2차 다항식 smooth min (iq). 기본 결합용.
float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5*(b - a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0 - h);
}

// 3차 다항식 버전. 같은 k 에서 목이 더 길고 완만해 '쫀득하게 늘어난' 이음새에 쓴다.
float sminCubic(float a, float b, float k){
  float h = max(k - abs(a - b), 0.0)/k;
  return min(a, b) - h*h*h*k*(1.0/6.0);
}

/* 지수 smooth min. 다항식 계열은 |a-b| = k 인 경계에서 곡률이 끊겨,
   강한 빛 아래 그 자리에 띠처럼 자국이 보인다(법선을 색으로 뿌려 보면 선이
   그어진다). 지수형은 경계 자체가 없어서 — 영향이 멀리까지 지수적으로
   줄어들 뿐 끊기는 곳이 없다 — 곡률이 어디서도 튀지 않는다. 사포로 간 면.
   값이 항상 min 보다 작아 거리를 과대평가하지 않으므로 레이마칭에도 안전하다.
   d=|a-b| 로 정리해 두면 exp 가 넘칠 일도 없다. */
float sminExp(float a, float b, float k){
  float m = min(a, b);
  return m - k*log2(1.0 + exp2(-abs(a - b)/k));
}

// smooth maximum. 교집합/차집합에서 모서리를 없앨 때.
float smax(float a, float b, float k){
  float h = clamp(0.5 - 0.5*(b - a)/k, 0.0, 1.0);
  return mix(b, a, h) + k*h*(1.0 - h);
}

// 세 연산의 이름 붙인 형태. 합집합/교집합은 smin·smax 를 그대로 쓰고,
// 차집합만 부호가 헷갈리기 쉬워 따로 둔다: d2 에서 d1 을 파낸다.
// 파낸 자리의 테두리도 k 만큼 둥글게 남는다.
float opSmoothUnion(float d1, float d2, float k){ return smin(d1, d2, k); }
float opSmoothInter(float d1, float d2, float k){ return smax(d1, d2, k); }
float opSmoothSub  (float d1, float d2, float k){ return smax(d2, -d1, k); }

/* ---------------------------------------------------------------------
   2. 기본 도형
   --------------------------------------------------------------------- */
float dot2(vec3 v){ return dot(v, v); }
mat2  rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float sdSphere(vec3 p, float r){ return length(p) - r; }

// 타원체. 정확한 거리는 아니지만 바깥에서 보수적으로 과소평가한다.
float sdEllipsoid(vec3 p, vec3 r){
  float k0 = length(p/r);
  float k1 = length(p/(r*r));
  return k0*(k0 - 1.0)/k1;
}

// 두 구 a(r1), b(r2) 의 볼록 껍질 = 끝이 완전히 둥근 원뿔 (iq).
// 어느 방향으로도 세울 수 있어서 귀를 밑동점·끝점으로 바로 기술할 수 있다.
// 뾰족한 꼭짓점이 아예 존재하지 않는 것이 핵심이다.
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3  ba = b - a;
  float l2 = dot(ba, ba);
  float rr = r1 - r2;
  float a2 = l2 - rr*rr;
  float il2 = 1.0/l2;
  vec3  pa = p - a;
  float y = dot(pa, ba);
  float z = y - l2;
  float x2 = dot2(pa*l2 - ba*y);
  float y2 = y*y*l2;
  float z2 = z*z*l2;
  float k = sign(rr)*rr*rr*x2;
  if(sign(z)*a2*z2 > k) return sqrt(x2 + z2)*il2 - r2;
  if(sign(y)*a2*y2 < k) return sqrt(x2 + y2)*il2 - r1;
  return (sqrt(x2*a2*il2) + y*rr)*il2 - r1;
}

// 끝이 둥근 선분 (얼굴 자국의 한 획). 정면에서 본 2D 모양이라 xy 평면에서 쓴다.
float sdCapsule2(vec2 p, vec2 a, vec2 b, float r){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
  return length(pa - ba*h) - r;
}

// 위와 같은 모양의 3D 판. 체리 꼭지 같은 가는 줄기에 쓴다.
float sdCapsule3(vec3 p, vec3 a, vec3 b, float r){
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
  return length(pa - ba*h) - r;
}

// 2D 원호 = 휘어진 캡슐. -y 방향이 각 0 이고 ±half 만큼만 남는다.
// 각을 clamp 하기만 하면 되므로 끝이 저절로 둥글고 거리도 정확하다.
// (짧은 캡슐을 여러 개 이어 붙이면 꺾인 이음매마다 혹이 생긴다. 입은 한 획이어야 한다.)
float sdArc2(vec2 p, float ra, float rb, float half_){
  float a = clamp(atan(p.x, -p.y), -half_, half_);
  return length(p - vec2(ra*sin(a), -ra*cos(a))) - rb;
}

float sdDisc(vec3 p, float r, float h){
  vec2 d = vec2(length(p.xz) - r, abs(p.y) - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

/* ---------------------------------------------------------------------
   3. 공간 왜곡 (domain distortion)

   왜곡은 공간을 늘리거나 조이므로 거리장의 기울기(Lipschitz 상수)가
   1을 넘게 된다. 그대로 두면 레이마칭이 표면을 뚫고 지나가 표면에
   구멍·얼룩이 생긴다. 그래서 "거리에 곱해 줄 보정 계수"를 같이 돌려준다.

   중력으로 아래가 퍼지는 모양은 예전엔 높이에 따라 xz 를 조이는 왜곡으로
   만들었는데 지금은 쓰지 않는다. 몸통 옆선을 레퍼런스에서 직접 재어
   형태 자체에 넣었고(아래 4번), 높이에 따라 변하는 그 왜곡은 애써 맞춘
   '직선'을 도로 휘게 만들기 때문이다.
   --------------------------------------------------------------------- */

// 탱글 흔들림 — 높이의 제곱에 비례하는 전단(윗부분이 더 크게 기운다)
//     + 아주 약한 위아래 숨쉬기. 젤리가 관성으로 출렁이는 모양이다.
vec3 opJiggle(vec3 p, float t, float amp, out float lip){
  float w  = amp*sin(t*2.4);
  float br = 1.0 + amp*0.55*sin(t*4.8); // t=0은 정지 모양, 루프 시작도 튀지 않게
  p.x -= w*p.y*p.y*1.70;
  p.z -= w*p.y*p.y*0.55;
  p.y /= br;
  lip  = 1.0/(1.0 + amp*4.2);         // 전단으로 늘어난 기울기 보정
  return p;
}

/* ---------------------------------------------------------------------
   4. 몸통과 귀의 공통 뼈대 — 바깥 외곽선은 하나의 직선이다

   레퍼런스 고양이 정면 칸에서 바깥 외곽선을 높이별로 재면, y 0.46 에서
   귀 끝 바로 아래 1.04 까지가 완전한 직선이다
   (직선 적합 잔차 rms 0.008 = 레퍼런스 그림에서 0.7px).
       바깥선 : x =  0.748 - 0.317·y
       안쪽선 : x = -0.504 + 0.704·y      (두 귀 사이 골)
   즉 레퍼런스에서 '머리 옆선'과 '귀 바깥선'은 다른 선이 아니라 같은 직선
   하나다. 그래서 귀에서 몸통으로 내려오는 동안 이음매가 보이지 않는다.

   그래서 이 파일은 머리와 귀를 둘 다 이 직선에 '접하게' 만든다.
   두 덩어리가 같은 직선에 접하면 만나는 자리에서 기울기가 꺾일 수 없다.
   턱이 생긴 뒤에 뭉개서 없애는 게 아니라, 생길 수가 없는 구조로 두는 것이다.
   몸통 타원체는 y=0.334, 귀 밑동 구는 y=0.397 에서 이 직선에 닿는다.
   그 사이 구간은 둘 다 직선 안쪽이지만 어긋남이 0.001 이라 눈에 띄지 않는다.

   축 위의 공이 이 직선에 접할 조건:  r = (0.748 - 0.317·yc) / √(1+0.317²)
   --------------------------------------------------------------------- */
const float BODY_ZS   = 0.90;   // 밑동의 깊이/폭
const float BODY_ZS_T = 0.72;   // 머리 위의 깊이/폭
const float FIELD_LIP = 0.85;   // 눌림이 높이에 따라 변하는 만큼의 여유

// 단면은 높이마다 다르다. 레퍼런스의 정면 칸과 측면 칸을 같은 척도로 재면
// 앞뒤/좌우 비가 밑동 0.90 → 머리 위 0.72 로 줄어든다. 위로 갈수록 좌우로만
// 남고 앞뒤로 얇아지는, 고양이 머리다운 단면이다.
float bodyZScale(float y){
  float t = clamp((y - 0.35)/0.38, 0.0, 1.0);
  t = t*t*t*(t*(t*6.0 - 15.0) + 10.0); // C2: 단면 변화 시작/끝의 띠를 줄인다
  return mix(BODY_ZS, BODY_ZS_T, t);
}

/* 몸통 — 바깥선에 접하는 타원체 하나. 이게 전부다.

   직선 x + S·y = C 에 접할 조건:  rx² + ry²·S² = (C - S·cy)²
   정수리를 0.835 로 고정하면(cy = 0.835 - ry) 좌우 반폭 rx 하나로 ry 와 cy 가
   따라온다. 그래서 몸통의 통통한 정도는 rx 하나로 조절한다 — 키우면 타원이
   아래로 길어지며 중심이 내려가 배가 아래쪽에서 불룩해지고, 귀와 공유하는
   접선은 그대로다. (정수리 0.835 는 두 귀 사이 골의 바닥이라 더 올리면
   골이 메워진다. rx = 0.68 → 최대폭 0.674, 0.72 → 0.698)

   예전에는 여기에 납작한 원반을 아래에 덧대 배를 만들었다. 그런데 원반의
   테두리 호와 타원이 비스듬히 교차해서(교차점에서 기울기 차가 0.67) 그
   높이에 물결이 남았다 — 외곽선 기울기가 한 번 더 가팔라졌다 되돌아온다.
   덩어리 하나로 만들면 교차할 것 자체가 없다. 같은 실루엣을 내면서도
   기울기의 이웃 간 변화가 0.110 → 0.048 로 줄었다. */
const vec2  HEAD_R  = vec2(0.6800, 0.7463);   // 좌우 반폭, 위아래 반높이
const float HEAD_CY = 0.0887;                 // 가장 넓어지는 높이


float sdBody(vec3 q){
  float zs = bodyZScale(q.y);
  vec3  s  = q; s.z /= zs;                          // 높이에 따라 앞뒤로 눌린 단면
  // 덩어리 하나라 섞을 것도 이음매도 없다.
  // 보정은 '그 높이의 눌린 정도'로 — 전역 최솟값을 쓰면 거리장 축척이 어긋난다.
  return sdEllipsoid(s - vec3(0.0, HEAD_CY, 0.0), vec3(HEAD_R.x, HEAD_R.y, HEAD_R.x)) * zs;
}

/* 얼굴 좌표 (x, y) 를 머리 앞면 위로 올린다.
   lift 만큼 바깥으로 띄우면 그만큼 얕게 파인다. */
vec3 onFace(vec2 c, float lift){
  float ty = (c.y - HEAD_CY)/HEAD_R.y;
  float tx = c.x/HEAD_R.x;
  float z  = bodyZScale(c.y)*HEAD_R.x*sqrt(max(0.0, 1.0 - ty*ty - tx*tx));  // 앞면까지
  float n  = sqrt(max(1e-5, c.x*c.x + z*z));
  return vec3(c.x, c.y, z) + vec3(c.x/n, 0.0, z/n)*lift;
}

/* ---------------------------------------------------------------------
   5. 귀 — 동물 8종

   귀는 '바깥 덩어리' 와 '앞면에 파인 귓바퀴' 두 단계로 만든다.
   덩어리만 붙여 두면 아무리 매끄럽게 녹여도 몸에 도형을 얹은 것으로 보인다.
   귀로 읽히게 하는 것은 앞면의 홈과 그 테두리다 (아래 earInner 참고).

   바깥 덩어리는 전부 '두 구의 볼록 껍질(sdRoundCone)' 하나로 만든다. 밑동 구와 끝 구의
   위치·반지름, 그리고 앞뒤로 눌린 정도만 바꾸면 여덟 가지가 다 나온다.
     · 삼각 귀(고양이·여우)   밑동이 굵고 끝이 가늘다
     · 긴 귀(토끼)            밑동에서 끝까지 길고 앞뒤로 납작하다
     · 늘어진 귀(강아지·롭이어) 머리 옆에서 아래로. 끝이 밑동보다 굵다
     · 동그란 귀(곰·쥐·햄스터) 두 구가 거의 같은 자리·같은 크기 = 공 하나

   값은 레퍼런스 정면 칸을 픽셀로 재서 옮겼다. 칸마다 그림 크기가 달라서
   '정수리(=0.835)까지의 높이'로 칸마다 척도를 역산했다. 고양이로 검산하면
   귀 끝이 정수리 위 +0.303 으로 나오는데, 앞서 따로 맞춰 둔 고양이
   값(+0.310)과 일치한다 — 그래서 귀 높이는 레퍼런스 수치를 그대로 쓴다.

   다만 좌우 위치는 그대로 옮길 수 없었다. 레퍼런스의 몸통은 칸마다
   '위가 둥근 원통'에 가까워서 정수리 근처까지 폭이 남아 있는데, 우리
   몸통은 타원체 하나라 위로 갈수록 빠르게 좁아진다(반폭 y=0.5 에서 0.555,
   0.7 에서 0.390, 0.8 에서 0.206). 그래서 귀의 x 는 레퍼런스 값이 아니라
   우리 몸통의 그 높이 반폭을 기준으로 다시 잡았다. 그대로 옮겼더니 강아지·
   롭이어 귀가 몸통 속에 통째로 묻혀 버렸다.

   이음매는 두 가지다.
     · 세운 귀(고양이·여우)  밑동 구를 몸통 타원에 접하는 직선 위에 올려
       바깥선이 몸통에서 접선으로 빠져나온다 = 턱이 없다. 그래서 여우는
       고양이와 밑동 구를 공유하고 끝 구만 위로·굵게 옮겼다.
     · 나머지  직선 접선 구조가 아니라 이음매에 오목한 필렛이 생긴다.
       레퍼런스도 그렇다 — 동그란 귀가 머리에 얹히거나 귀가 옆으로 늘어지면
       원래 그 자리에 골이 진다. 볼록하게 튀었다 들어가는 '턱'과는 다르다.

   햄스터는 레퍼런스(다람쥐, 정수리 위 +0.39)를 따르지 않고 실제 햄스터처럼
   작게(+0.17) 줄였다.
   --------------------------------------------------------------------- */

/* a,b = 밑동·끝 구의 중심,  r1,r2 = 각 반지름,  fz = 앞뒤 두께 / 좌우 폭,
   k = 몸통과 녹이는 정도 */
void earSpec(out vec3 a, out float r1, out vec3 b, out float r2, out float fz, out float k){
  if(uAnimal < 0.5){        // 고양이 — 두 직선에 접하게 맞춘 값
    a=vec3(0.2182,0.2693,0.000); r1=0.4237; b=vec3(0.3395,1.0550,0.060); r2=0.090; fz=1.10; k=0.012;
  } else if(uAnimal < 1.5){ // 강아지 — 머리 옆에서 아래로 늘어진 납작한 귀
    a=vec3(0.2400,0.8000,0.000); r1=0.100; b=vec3(0.7200,0.4200,0.000); r2=0.160; fz=0.50; k=0.030;
  } else if(uAnimal < 2.5){ // 토끼 — 길고 앞뒤로 납작한 귀
    a=vec3(0.2500,0.6200,0.000); r1=0.190; b=vec3(0.2750,1.1900,0.000); r2=0.100; fz=0.62; k=0.020;
  } else if(uAnimal < 3.5){ // 롭이어 — 강아지보다 길고 굵게 늘어진 귀
    a=vec3(0.2300,0.8100,0.000); r1=0.100; b=vec3(0.7900,0.3000,0.000); r2=0.210; fz=0.46; k=0.030;
  } else if(uAnimal < 4.5){ // 곰 — 작고 동그란 귀
    a=vec3(0.400,0.745,0.0); r1=0.185; b=vec3(0.400,0.746,0.0); r2=0.185; fz=0.68; k=0.016;
  } else if(uAnimal < 5.5){ // 쥐 — 크고 앞뒤로 얇은 원반 귀
    a=vec3(0.395,0.875,0.0); r1=0.268; b=vec3(0.395,0.876,0.0); r2=0.268; fz=0.29; k=0.018;
  } else if(uAnimal < 6.5){ // 여우 — 고양이보다 크고 길쭉한 삼각 귀
    a=vec3(0.2182,0.2693,0.000); r1=0.4237; b=vec3(0.3150,1.1250,0.020); r2=0.125; fz=0.95; k=0.012;
  } else {                  // 햄스터 — 레퍼런스(다람쥐)보다 훨씬 작은, 실제 햄스터 같은 귀
    a=vec3(0.2700,0.8450,0.000); r1=0.120; b=vec3(0.2900,0.8950,0.000); r2=0.112; fz=0.80; k=0.030;
  }
}

float sdEars(vec3 q){
  vec3 a,b; float r1,r2,fz,k;
  earSpec(a,r1,b,r2,fz,k);
  vec3 e = vec3(abs(q.x), q.y, q.z);      // 좌우 대칭
  e.z /= fz;
  a.z /= fz; b.z /= fz;
  // 동그란 귀는 축이 거의 0인 원뿔 대신 정확한 구로 만든다.
  float d = (uAnimal > 3.5 && uAnimal < 5.5)
    ? length(e - a) - r1 : sdRoundCone(e, a, b, r1, r2);
  return d * min(fz, 1.0);
}

float earBlend(){
  vec3 a,b; float r1,r2,fz,k;
  earSpec(a,r1,b,r2,fz,k);
  return k;
}

/* 귓바퀴 — 귀를 '귀'로 보이게 하는 것은 앞면에 파인 홈이다.
   덩어리만 붙여 두면 아무리 매끄러워도 몸에 도형을 붙인 것으로 보인다.

   홈은 귀와 같은 축을 쓰는 같은 모양의 라운드콘이다. 반지름을 si 배로
   줄이고 앞(+z)으로 밀어서 앞면만 dep 만큼 파이고 테두리와 뒷면은 남는다.
   귀가 앞뒤로 눌린 좌표계 안에서 밀기 때문에 홈도 같이 눌린다 — 납작한
   귀에는 얕고 넓은 홈이, 통통한 귀에는 깊은 홈이 생긴다.

   깊이 dep 을 정하면 앞면에 뚫리는 구멍의 폭은 √(2·si·dep − dep²) 로
   따라온다(반지름 대비). 그래서 두 값으로 '홈의 깊이'와 '테두리의 두께'가
   같이 정해진다. 밀어낼 거리는 zin = si + 1 − dep.

   t0,t1 은 축 위에서 홈이 시작·끝나는 지점이다.
     t0  머리 밖으로 귀가 나오는 높이보다 위 — 더 내려가면 머리를 판다
     t1  1 보다 작게 — 귀 끝은 꽉 차 있어야 뭉툭해 보인다 */
void earInner(out float si, out float dep, out float t0, out float t1, out float kin, out float gap){
  if(uAnimal < 0.5){        // 고양이
    si=0.92; dep=0.34; t0=0.745; t1=0.945; kin=0.018; gap=  0.080;
  } else if(uAnimal < 1.5){ // 강아지
    si=0.90; dep=0.40; t0=0.270; t1=0.880; kin=0.026; gap=-10.000;
  } else if(uAnimal < 2.5){ // 토끼
    si=0.90; dep=0.62; t0=0.340; t1=0.945; kin=0.014; gap=-10.000;
  } else if(uAnimal < 3.5){ // 롭이어
    si=0.90; dep=0.40; t0=0.240; t1=0.870; kin=0.026; gap=-10.000;
  } else if(uAnimal < 4.5){ // 곰
    si=0.70; dep=0.65; t0=0.000; t1=1.000; kin=0.016; gap=-10.000;
  } else if(uAnimal < 5.5){ // 쥐
    si=0.80; dep=0.60; t0=0.000; t1=1.000; kin=0.013; gap=-10.000;
  } else if(uAnimal < 6.5){ // 여우
    si=0.92; dep=0.36; t0=0.760; t1=0.945; kin=0.018; gap=  0.080;
  } else {                  // 햄스터
    si=0.64; dep=0.30; t0=0.000; t1=1.000; kin=0.018; gap=-10.000;
  }
}

float sdEarInner(vec3 q){
  vec3 a,b; float r1,r2,fz,k;
  earSpec(a,r1,b,r2,fz,k);
  float si,dep,t0,t1,kin,gap;
  earInner(si,dep,t0,t1,kin,gap);

  vec3 e = vec3(abs(q.x), q.y, q.z);
  e.z /= fz;  a.z /= fz;  b.z /= fz;

  float ra = mix(r1, r2, t0), rb = mix(r1, r2, t1);
  float zin = si + 1.0 - dep;                 // 앞으로 밀 거리 (반지름 대비)
  vec3  ia = mix(a, b, t0);  ia.z += zin*ra;
  vec3  ib = mix(a, b, t1);  ib.z += zin*rb;
  // 홈의 아래 끝을 '몸통 표면에서 gap 만큼 떨어진 곳' 에서 자른다.
  // 안 자르면 밑동 구의 둥근 뚜껑이 귀가 머리에서 갈라지는 골보다 한참
  // 아래까지 내려가(고양이·여우는 0.14) 볼을 타고 내려오는 자국이 된다.
  // 수평으로 자르면 끊긴 자리가 눈에 띄므로 몸통 거리장으로 자른다 —
  // 홈의 끝이 머리의 둥근 선을 따라간다. gap 이 음수면 잘리지 않는다.
  float d = (uAnimal > 3.5 && uAnimal < 5.5)
    ? length(e - ia) - si*ra : sdRoundCone(e, ia, ib, si*ra, si*rb);
  d *= min(fz, 1.0);
  if(gap < 0.0) return d;
  return smax(d, gap - sdBody(q), 0.030);
}

float earInnerBlend(){
  float si,dep,t0,t1,kin,gap; earInner(si,dep,t0,t1,kin,gap); return kin;
}

/* 파인 귓바퀴에만 색을 얹기 위한 필드.
   홈 안쪽(sdEarInner<=0)이면서 '원래 귀 덩어리 안'인 곳만 고른다.
   뒤 항이 없으면 홈의 원기둥이 지나가는 머리 표면까지 물든다.
   0.015 만큼 여유를 두어 테두리는 색이 묻지 않고 커스터드로 남는다. */
float earInk(vec3 q){
  return max(sdEarInner(q), sdEars(q) + 0.015);
}

/* ---------------------------------------------------------------------
   6. 얼굴 자국

   눈과 입 모두 같은 방식이다. 곡면 위에 3D 도형을 얹어 파면 볼이
   휜 만큼 자국의 가운데가 얕아져 획이 끊긴다. 그래서 "정면에서 본 2D 모양"을
   z 축 방향 기둥으로 밀어낸 뒤, 표면에서 INK_DEPTH 이내인 껍질과 교집합해
   새긴다. 면이 어디로 휘든 깊이가 일정하고, 정면 모양은 레퍼런스 그대로다.
   --------------------------------------------------------------------- */
const float INK_DEPTH = 0.028;

/* 눈 5종 — 전부 같은 원에서 출발한다.
   자른 눈(올라간·내려간·반)은 그 원을 직선 하나로 스윽 잘라 낸 모양이다.
   자르는 깊이는 셋 다 같고(중심에서 0.50·r — 반달보다 조금 넓게 남는다),
   기울기만 다르다.
       올라간   +16°   안쪽 위를 비스듬히   → 바깥쪽이 올라가 보인다
       내려간   -22°   바깥쪽 위를 비스듬히 → 바깥쪽이 내려가 보인다
       반         0°   수평
   좌우 대칭 좌표에서 그리므로 기울기는 반대쪽 눈에서 저절로 뒤집힌다. */
const vec2  EYE_POS = vec2(0.180, 0.500);
const float EYE_R   = 0.045;
const float EYE_CUT = 0.500;   // 중심에서 자르는 선까지 (반지름 대비)

float sdEye2(vec2 p){
  if(uEye < 0.5) return length(p) - EYE_R;                  // 동글
  if(uEye < 3.5){                                           // 올라간 / 내려간 / 반
    float ang = (uEye < 1.5) ? -0.38 : (uEye < 2.5) ? 0.28 : 0.00;
    vec2  q   = rot(-ang)*p;                  // 자르는 선을 수평으로 눕힌다
    // 잘린 모서리도 칼처럼 서지 않게 살짝 둥글린다
    return smax(length(p) - EYE_R, q.y - EYE_CUT*EYE_R, 0.007);
  }
  // 웃는 눈 — 위로 볼록한 호 하나 (∩).
  // 호가 그리는 원의 중심을 눈 중심보다 0.40·r 아래에 두어야 호 전체가
  // 다른 눈들과 같은 자리에 온다. 그냥 두면 호가 눈 위치보다 떠 보인다.
  // 굵기도 다른 눈의 검은 면적과 비슷해지도록 두껍게 잡았다.
  return sdArc2(vec2(p.x, -(p.y + 0.40*EYE_R)), 0.82*EYE_R, 0.32*EYE_R, 1.30);
}

/* 입 6종. 좌우 대칭 좌표에서 오른쪽 절반만 그리면 된다.
     0 ω    아래로 열린 작은 원호. 대칭이라 반대쪽 반원이 생겨 ω 가 된다
     1 ^    가운데에서 바깥아래로 내려오는 직선
     2 일자 수평 직선
     3 웃는 작은 원호 (∪), 4 점, 5 속을 칠한 반달 */
float sdMouth2(vec2 m){
  if(uMouth < 0.5) return sdArc2(m - vec2(0.034, 0.408), 0.032, 0.011, 1.83);
  if(uMouth < 1.5) return sdCapsule2(m, vec2(0.000, 0.432), vec2(0.050, 0.394), 0.011);
  if(uMouth < 2.5) return sdCapsule2(m, vec2(0.000, 0.388), vec2(0.038, 0.388), 0.008);
  if(uMouth < 3.5) return sdArc2(m - vec2(0.000, 0.418), 0.037, 0.008, 1.18);
  if(uMouth < 4.5) return length(m - vec2(0.0, 0.390)) - 0.017;
  // 윗선이 평평하고 아래가 둥근, 속까지 칠해진 반달 입.
  vec2 p = m - vec2(0.0, 0.400);
  return smax(length(p/vec2(1.0,0.82)) - 0.042, p.y - 0.002, 0.006);
}

// 정면에서 본 얼굴 자국
float faceMark2D(vec2 c){
  vec2 m = vec2(abs(c.x), c.y);            // 좌우 대칭
  return min(sdEye2(m - EYE_POS), sdMouth2(m));
}

/* 파낼 영역. body 는 자국을 파기 전의 몸통 거리장이다.
     prism : 정면 2D 모양을 z 로 밀어낸 기둥
     shell : 표면에서 INK_DEPTH 이내 (여기서 깊이가 일정해진다)
             + 앞면만 (z 로 자르지 않으면 뒤통수에도 같은 자국이 찍힌다)
   교집합도 smax 로 해야 자국 바닥과 벽이 만나는 곳까지 둥글게 남는다. */
float faceShell(vec3 q, float body){
  return smax(-(body + INK_DEPTH), 0.10 - q.z, 0.014);
}
float faceInk(vec3 q, float body){
  return smax(faceMark2D(q.xy), faceShell(q, body), 0.011);
}

/* ---------------------------------------------------------------------
   7. 고양이 푸딩 전체
   --------------------------------------------------------------------- */
vec4 puddingSpace(vec3 p){
  float lip;
  vec3 q = opJiggle(p, uTime, 0.028*uJiggle, lip);
  return vec4(q, lip);                      // xyz = 왜곡된 좌표, w = 거리 보정
}

// 몸통 + 귀. 얼굴을 파기 전 단계라서 얼굴 자국이 '표면'을 찾을 때도 이걸 쓴다.
float sdBodyEars(vec3 q){
  // 고양이는 머리와 귀가 같은 직선에 접해 있어 아주 작은 k 로 충분하다.
  // 동그란 귀·늘어진 귀는 머리에 얹힌 모양이라 조금 더 녹여야 자연스럽다.
  // 귓바퀴는 귀에서만 파낸다. 몸통을 합치기 전에 파야 머리까지 패지 않는다.
  float ear = opSmoothSub(sdEarInner(q), sdEars(q), earInnerBlend());
  return sminExp(sdBody(q), ear, earBlend());
}

/* ---------------------------------------------------------------------
   6.5 토핑 — 체리 · 생크림 · 스프링클

   전부 정수리 CROWN = (0, 0.835, 0) 위에 얹는다. 0.835 는 몸통(sdBody)
   혼자 정하는 높이라(귀는 좌우로 벌어져 있어 x=0 을 절대 건드리지 않는다)
   동물이 달라져도, 심지어 고양이·여우처럼 귀가 가운데로 모이는 경우에도
   그 자리는 늘 비어 있는 몸통 표면이다 — 두 귀 사이 골의 바닥이 바로
   그 자리라고 4번 절에서 이미 재 두었다.

   몸통에 합칠 때는 재료마다 다른 k 를 쓴다. 체리는 얹힌 것이지 녹아든
   것이 아니므로 작게, 생크림은 짜 올린 반죽이 밑에서 몸통과 이어지므로
   크게. 셋 다 sminExp 라 곡률이 끊기는 자리는 없다. */
const vec3  CROWN   = vec3(0.0, 0.835, 0.0);
const float CREAM_H = 0.300;

/* 짤주머니의 별깍지: 연속된 한 덩어리의 여섯 골이 위로 꼬인다.
   구를 겹치지 않는다. 축 근처에서는 골을 없애 atan의 특이점을 피한다. */
float sdCream(vec3 q){
  if(uCream < 0.5) return 1e5;
  vec3 p = q - CROWN;
  float t = clamp(p.y/0.300, 0.0, 1.0);
  p.x -= 0.045*t*t;
  float r = length(p.xz);
  float a = atan(p.z, p.x);
  float flute = 1.0 + 0.19*cos(6.0*a - t*3.8)*smoothstep(0.008, 0.055, r);
  p.xz /= flute;
  return sdRoundCone(p, vec3(0.0,0.072,0.0), vec3(0.0,0.275,0.0), 0.190, 0.022)/1.9;
}

/* 체리. 구 하나 + 가는 줄기 하나. 둘을 색칠할 때는 따로 알아야 하므로
   geometry 용 합친 값과, 색칠용 각 부위 값을 나눠 둔다.
   생크림이 있으면 그 꼭대기에, 없으면 정수리에 바로 앉는다. */
vec3 cherryCenter(){
  return CROWN + vec3(uCream > 0.5 ? 0.040 : 0.0, (uCream > 0.5 ? CREAM_H : 0.0) + 0.056, 0.0);
}
float sdCherryBody(vec3 q){
  if(uCherry < 0.5) return 1e5;
  return sdSphere(q - cherryCenter(), 0.073);
}
float sdCherryStem(vec3 q){
  if(uCherry < 0.5) return 1e5;
  vec3 c  = cherryCenter();
  vec3 s0 = c + vec3(0.0, 0.060, 0.0);
  vec3 s1 = s0 + vec3(0.037, 0.088, -0.018);
  return sdCapsule3(q, s0, s1, 0.010);
}
float sdCherry(vec3 q){
  return smin(sdCherryBody(q), sdCherryStem(q), 0.010);
}

// SPRINKLE_GEOMETRY — 생성된 표면 좌표가 아래에 들어간다.
// 각 동물의 이마 표면에서 실제 법선 방향으로 띄운 좌표.
const vec3 SPR_A[48]=vec3[48](vec3(-0.214183,0.734222,0.314354),vec3(0.175503,0.770465,0.281410),vec3(-0.035022,0.786935,0.203291),vec3(0.036710,0.717830,0.285829),vec3(-0.273012,0.710165,0.330347),vec3(0.283634,0.695204,0.337336),vec3(-0.222445,0.730839,0.222651),vec3(0.199681,0.761819,0.193675),vec3(-0.037198,0.789664,0.200247),vec3(0.038110,0.719456,0.283957),vec3(-0.278943,0.706592,0.219875),vec3(0.287870,0.693632,0.229549),vec3(-0.222431,0.730877,0.222251),vec3(0.199597,0.761926,0.193253),vec3(-0.037246,0.790009,0.198353),vec3(0.038126,0.719484,0.283738),vec3(-0.278957,0.706574,0.219476),vec3(0.287874,0.693614,0.229171),vec3(-0.222443,0.730848,0.222630),vec3(0.199653,0.761830,0.193558),vec3(-0.037216,0.789651,0.200342),vec3(0.038111,0.719458,0.283955),vec3(-0.278935,0.706598,0.219918),vec3(0.287867,0.693642,0.229591),vec3(-0.222491,0.730846,0.220744),vec3(0.199373,0.761759,0.190172),vec3(-0.037473,0.790593,0.196790),vec3(0.038143,0.719508,0.283651),vec3(-0.278884,0.706469,0.218190),vec3(0.287901,0.693630,0.227941),vec3(-0.222501,0.730819,0.220730),vec3(0.199438,0.761715,0.190305),vec3(-0.037428,0.790398,0.197315),vec3(0.038142,0.719506,0.283662),vec3(-0.278889,0.706431,0.217991),vec3(0.287916,0.693597,0.227746),vec3(-0.216670,0.731631,0.291194),vec3(0.194329,0.764580,0.273860),vec3(-0.033554,0.782110,0.210839),vec3(0.037138,0.718314,0.285332),vec3(-0.275989,0.708837,0.299285),vec3(0.284626,0.693816,0.304748),vec3(-0.222398,0.730841,0.223944),vec3(0.199816,0.761969,0.196229),vec3(-0.037070,0.789658,0.199748),vec3(0.038091,0.719437,0.283928),vec3(-0.279094,0.706573,0.220418),vec3(0.287891,0.693484,0.230063));
const vec3 SPR_B[48]=vec3[48](vec3(-0.167738,0.728472,0.303688),vec3(0.174213,0.728762,0.305143),vec3(-0.072233,0.805905,0.179638),vec3(0.083169,0.726567,0.277513),vec3(-0.257302,0.668694,0.348715),vec3(0.235928,0.699752,0.334608),vec3(-0.176252,0.740891,0.230966),vec3(0.168392,0.746814,0.226839),vec3(-0.075075,0.803220,0.174063),vec3(0.084463,0.725180,0.272883),vec3(-0.262525,0.681855,0.257592),vec3(0.243486,0.711016,0.235193),vec3(-0.176216,0.740876,0.230511),vec3(0.168333,0.746709,0.226343),vec3(-0.075026,0.803174,0.171832),vec3(0.084460,0.725215,0.272587),vec3(-0.262543,0.681876,0.257219),vec3(0.243501,0.711018,0.234842),vec3(-0.176247,0.740900,0.230930),vec3(0.168414,0.746836,0.226774),vec3(-0.075102,0.803199,0.174168),vec3(0.084464,0.725180,0.272878),vec3(-0.262520,0.681853,0.257631),vec3(0.243476,0.711012,0.235221),vec3(-0.176366,0.741261,0.228990),vec3(0.168902,0.747425,0.224378),vec3(-0.075136,0.802915,0.169704),vec3(0.084465,0.725223,0.272444),vec3(-0.262729,0.682226,0.256338),vec3(0.243609,0.711304,0.233404),vec3(-0.176393,0.741277,0.229014),vec3(0.168887,0.747422,0.224457),vec3(-0.075138,0.802970,0.170410),vec3(0.084466,0.725220,0.272462),vec3(-0.262779,0.682304,0.256231),vec3(0.243668,0.711383,0.233207),vec3(-0.169093,0.729083,0.285371),vec3(0.159472,0.732331,0.280859),vec3(-0.069755,0.807766,0.192529),vec3(0.083719,0.725780,0.276476),vec3(-0.256215,0.668398,0.315949),vec3(0.236950,0.699360,0.305188),vec3(-0.176137,0.740552,0.232287),vec3(0.167911,0.746217,0.228446),vec3(-0.074904,0.803370,0.173582),vec3(0.084447,0.725202,0.272885),vec3(-0.262472,0.681666,0.257933),vec3(0.243558,0.710894,0.236018));
float sdSprinkles(vec3 q, out float id){
  id=0.0;if(uSprinkle<0.5)return 1e5;
  float d=1e5,e;
  int animal=int(clamp(uAnimal,0.0,7.0));
  for(int i=0;i<6;i++){
    e=sdCapsule3(q,SPR_A[animal*6+i],SPR_B[animal*6+i],0.011);
    if(e<d){d=e;id=float(i);}
  }
  if(uCream>0.5){
e=sdCapsule3(q,vec3(0.158305,0.931858,0.105922),vec3(0.204057,0.941656,0.095209),0.011);if(e<d){d=e;id=6.0;}
e=sdCapsule3(q,vec3(-0.147147,0.962114,0.178231),vec3(-0.101317,0.951604,0.187881),0.011);if(e<d){d=e;id=7.0;}
e=sdCapsule3(q,vec3(-0.004722,1.042576,-0.186635),vec3(-0.047196,1.031163,-0.167409),0.011);if(e<d){d=e;id=8.0;}
e=sdCapsule3(q,vec3(-0.005258,1.074096,0.098869),vec3(-0.024304,1.091254,0.058289),0.011);if(e<d){d=e;id=9.0;}
e=sdCapsule3(q,vec3(0.041496,1.114501,-0.050869),vec3(0.087006,1.117487,-0.035907),0.011);if(e<d){d=e;id=10.0;}
  }
 return d;
}
float sdSprinkles(vec3 q){float id;return sdSprinkles(q,id);}

/* 시럽은 접시에 살짝 볼록하게 고인 진한 소스다. 젖은 하이라이트를 받을
   실제 곡면과 얇아지는 가장자리가 있으며, 고정된 접시 위에 놓인다. */
float syrupRadius(vec3 p){
  float a = atan(p.z, p.x);
  return 0.85 + 0.028*sin(3.0*a + 0.6) + 0.018*sin(5.0*a + 2.1);
}
float sdSyrupPool(vec3 p){
  if(uSyrup < 0.5) return 1e5;
  float r = length(p.xz)/syrupRadius(p);
  // 표면 높이는 중앙 0.034, 가장자리 0.010. 끝은 부드럽게 얇아진다.
  float top = 0.010 + 0.024*(1.0 - smoothstep(0.55,1.0,r));
  return smax((r - 1.0)*0.78, abs(p.y - (top-0.006)*0.5) - (top+0.006)*0.5, 0.015);
}

// 접시 외곽까지의 2D 거리. 0 기본 / 1 꽃 / 2 타원 / 3 둥근 사각.
float plateOutline(vec2 p){
  if(uPlateStyle < 0.5) return length(p) - 1.29;
  if(uPlateStyle < 1.5){
    float a = atan(p.y,p.x);
    return (length(p) - 1.255 - 0.050*cos(10.0*a))*0.85;
  }
  if(uPlateStyle < 2.5) return (length(p/vec2(1.40,1.12)) - 1.0)*1.12;
  vec2 q = abs(p) - vec2(0.76,0.74);
  return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - 0.28;
}
float sdPlate(vec3 p){
  float edge = plateOutline(p.xz);
  float rim = 0.052*smoothstep(-0.27,-0.075,edge);
  vec2 d = vec2(edge+0.012, abs(p.y - (rim-0.038)*0.5) - (rim+0.038)*0.5 + 0.012);
  return length(max(d,0.0)) + min(max(d.x,d.y),0.0) - 0.012;
}

float sdCatPudding(vec3 p){
  vec4 sp = puddingSpace(p);
  vec3 q  = sp.xyz;

  float d = sdBodyEars(q);

  // 토핑은 각각 작은 블렌드로 붙여 형태와 경계를 남긴다.
  d = sminExp(d, sdCream(q), 0.010);
  d = sminExp(d, sdSprinkles(q), 0.004);
  d = sminExp(d, sdCherry(q), 0.012);

  // 얼굴을 미세하게 파낸다 (모서리 없이).
  d = opSmoothSub(faceInk(q, d), d, 0.017);


  // 접시에 눌려 평평하게 잘린 바닥.
  // 평면과의 교집합도 smax 로 해야 밑동 테두리가 칼처럼 서지 않는다.
  // 접시에 닿는 밑동이 말려 들어가는 정도. 레퍼런스에서 잰 값 —
  // 바닥에서 0.05 높이까지 옆선이 0.037 만큼 안으로 말려 들어간다.
  // 보정 전 같은 축척에서 밑면을 둥글린다. 흔들림 세기에 따라 밑동이
  // 바뀌던 단차를 방지하고, C2 블렌드로 곡률 변화도 완화한다.
  float floorD = -p.y + 0.003;
  float h = max(0.095 - abs(d-floorD),0.0)/0.095;
  d = max(d,floorD) + h*h*h*0.095/6.0;
  return d * FIELD_LIP * sp.w;
}

/* ---------------------------------------------------------------------
   8. 장면 — x: 거리, y: 재질(0 푸딩, 1 접시, 2 시럽)
   --------------------------------------------------------------------- */
vec2 map(vec3 p){
  vec2 res = vec2(sdCatPudding(p), 0.0);
  if(uMode > 0.5) return res;                 // 실루엣 검증 모드는 푸딩만

  float syrup = sdSyrupPool(p);
  if(syrup < res.x) res = vec2(syrup, 2.0);
  float plate = sdPlate(p);
  if(plate < res.x) res = vec2(plate, 1.0);
  return res;
}

// 음영 보조선에는 작은 얼굴 홈/스프링클을 재계산하지 않는다.
// 1픽셀보다 작은 장식까지 48회씩 계산하던 비용을 없앤다.
float shadeDistance(vec3 p){
  vec4 sp = puddingSpace(p);
  vec3 q = sp.xyz;
  float d = sdBodyEars(q);
  d = min(d,sdCream(q));
  d = min(d,sdCherryBody(q));
  return max(d,-p.y) * FIELD_LIP * sp.w;
}

vec3 calcNormal(vec3 p){
  vec2 e = vec2(1.0, -1.0)*0.0011;
  return normalize(
    e.xyy*map(p + e.xyy).x + e.yyx*map(p + e.yyx).x +
    e.yxy*map(p + e.yxy).x + e.xxx*map(p + e.xxx).x);
}

vec2 rayMarch(vec3 ro, vec3 rd){
  // 빈 공간을 건너뛰고 장면을 감싸는 구에 들어온 자리부터 시작한다.
  vec3 oc = ro - vec3(0.0,0.65,0.0);
  float b = dot(oc,rd);
  float disc = b*b - dot(oc,oc) + 1.80*1.80;
  if(disc < 0.0) return vec2(0.0,-1.0);
  float nearT = max(0.0,-b-sqrt(disc));
  float farT = -b+sqrt(disc);
  float t=nearT,m=-1.0;
  for(int i=0;i<256;i++){
    vec2 h=map(ro+rd*t);
    if(abs(h.x)<0.00035*t+0.00025){m=h.y;break;}
    t+=max(h.x*0.76,0.0001);
    if(t>farT)break;
  }
  if(t>farT)m=-1.0;
  return vec2(t,m);
}

float softShadow(vec3 ro, vec3 rd, float k){
  float res = 1.0, t = 0.03;
  for(int i = 0; i < 24; i++){
    if(uQuality < 0.5 && i >= 14) break;
    float h = shadeDistance(ro + rd*t);
    res = min(res, k*h/t);
    t += clamp(h, 0.012, 0.16);
    if(res < 0.02 || t > 3.2) break;
  }
  return clamp(res, 0.0, 1.0);
}

float calcAO(vec3 p, vec3 n){
  float occ = 0.0, sca = 1.0;
  for(int i = 0; i < 3; i++){
    float h = 0.020 + 0.15*float(i)/2.0;
    occ += (h - shadeDistance(p + n*h))*sca;
    sca *= 0.82;
  }
  return clamp(1.0 - 1.6*occ, 0.0, 1.0);
}

// 얇은 곳일수록 빛이 통과해 보이는 느낌 (가짜 SSS). 푸딩의 반투명함.
float translucency(vec3 p, vec3 n){
  // 한 번의 두께 근사. 얇은 귀에 빛이 비치는 효과는 유지한다.
  float h = 0.16;
  return clamp((h + shadeDistance(p - n*h))/h,0.0,1.0);
}

vec3 skyColor(vec3 d){
  float t = clamp(d.y*0.5 + 0.5, 0.0, 1.0);
  return mix(vec3(0.52, 0.44, 0.36), vec3(1.00, 0.98, 0.94), t);
}

vec3 background(vec2 uv){
  // 위가 밝고 아래는 어둡고 조금 더 진한 그라데이션.
  // 고른 색이 위아래의 가운데가 된다. 두 계수는 예전에 박혀 있던
  // 두 색(아래 0.836,0.760,0.676 / 위 0.960,0.918,0.856)의 비율이다.
  vec3 col = mix(uBg*vec3(0.931, 0.906, 0.882),
                 uBg*vec3(1.069, 1.094, 1.117),
                 smoothstep(-0.6, 0.8, uv.y));
  return col*(1.0 - 0.15*dot(uv, uv));
}

void main(){
  vec2 uv = (gl_FragCoord.xy*2.0 - uRes)/uRes.y;

  // 카메라
  float az = uCam.x, el = uCam.y, dist = uCam.z;
  vec3 ta = vec3(0.0, 0.47, 0.0);
  vec3 ro = ta + dist*vec3(cos(el)*sin(az), sin(el), cos(el)*cos(az));
  // 렌즈. 레퍼런스 도면은 망원(거의 직교)으로 찍혀 있다. 짧은 렌즈로 보면
  // 앞쪽이 부풀고 세로로 길어져, 같은 형태라도 폭/높이가 1.17 → 1.02 로
  // 달라 보인다. 거리에 비례해 화각을 좁혀 레퍼런스와 같은 조건으로 본다.
  float zoom = 0.68*dist; // 새 접시가 회전할 때도 가장자리를 담는 여백
  if(uMode > 0.5){ ta = vec3(0.0, 0.56, 0.0); ro = ta + vec3(0.0, 0.0, 5.0); }
  if(uMode > 1.5){ ro = ta + vec3(5.0, 0.0, 0.0); }

  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x*uu + uv.y*vv + zoom*ww);

  // 실루엣 검증은 직교 투영으로 본다 (원근이면 앞쪽이 부풀어 비교가 안 된다)
  if(uMode > 0.5){
    ro = ro + uu*(uv.x*1.15) + vv*(uv.y*1.15);
    rd = ww;
  }

  vec2 hit = rayMarch(ro, rd);

  if(uMode > 0.5){
    fragColor = vec4(vec3(hit.y >= 0.0 ? 0.10 : 1.0), 1.0);
    return;
  }

  vec3 col = background(uv);
  bool isBg = true;

  if(hit.y >= 0.0){
    isBg = false;
    vec3 p = ro + rd*hit.x;
    vec3 n = calcNormal(p);

    vec3 lig  = normalize(vec3(-0.40, 1.18, 0.42));   // 키 라이트 (왼쪽 위 앞)
    vec3 lig2 = normalize(vec3(0.75, 0.30, -0.50));   // 뒤쪽 채움
    float dif = clamp(dot(n, lig), 0.0, 1.0);
    float sha = softShadow(p + n*0.012, lig, 12.0);
    float ao  = calcAO(p, n);
    float bac = clamp(dot(n, lig2), 0.0, 1.0);
    float fre = pow(clamp(1.0 + dot(n, rd), 0.0, 1.0), 5.0);
    vec3  env = skyColor(reflect(rd, n));

    vec3  hal  = normalize(lig - rd);
    float spe  = pow(clamp(dot(n, hal), 0.0, 1.0), 520.0);
    float spe2 = pow(clamp(dot(n, hal), 0.0, 1.0), 28.0);

    vec3 base; float gloss, envAmt;
    float wet = 0.0;              // 젖어서 하이라이트가 세지는 정도

    if(hit.y < 0.5){
      // 커스터드. 지정 색은 sRGB 라서 선형으로 바꿔 조명에 넣는다.
      base = pow(uBody, vec3(2.2));

      // 빛이 통과해 보이는 속색. 본체 색을 더 진하게 만든 색이라
      // 어떤 색을 골라도 그 색의 '속이 비치는' 느낌이 된다.
      // (기본 커스터드에서는 예전 고정값 vec3(0.55,0.34,0.10) 과 같아진다)
      vec3 sss = pow(base/max(max(base.r, base.g), max(base.b, 1e-4)), vec3(3.0))*0.55;
      base += base*sss*translucency(p, n)*0.95;

      // 파낸 얼굴 자국에 색을 얹는다. 형태를 만든 것과 같은 거리장을 쓰므로
      // 색과 굴곡이 정확히 같은 자리에 온다.
      vec3  q    = puddingSpace(p).xyz;
      float dBE  = sdBodyEars(q);

      // 귓바퀴. 홈을 판 것과 같은 거리장을 쓰므로 색과 굴곡이 같은 자리에 온다.
      // 얇은 귀(토끼·쥐)는 홈이 깊어질 수 없어서, 색이 있어야 비로소 귀로 읽힌다.
      float em = 1.0 - smoothstep(0.0, 0.012, earInk(q));
      // 귓바퀴 색은 본체에서 파생한다. 기본 커스터드에서 예전 고정값
      // vec3(0.930,0.788,0.734) 이 나오는 비율이다 — 조금 어둡고 붉게.
      base = mix(base, pow(uBody*vec3(0.964, 0.871, 0.941), vec3(2.2)), em*0.88);

      /* 토핑 색칠 구간은 각자의 sminExp 블렌드 k 보다 넓게 잡는다.
         몸통과 녹아 붙는 목(neck) 구간에서는 표면이 토핑의 raw SDF=0
         보다 한참 앞에서 이미 시작되므로, 문턱을 k 근처의 폭보다 좁게
         잡으면(전엔 0.010 이었다) 눈에 보이는 덩어리의 아랫단은 색이
         하나도 안 묻은 '몸통 색 그대로인 혹' 으로 남는다. */

      // 생크림 — 커스터드보다 확실히 희되, 완전한 무채색이면 회색으로
      // 보인다. 노란기를 아주 조금 남긴 따뜻한 흰색.
      float cm = 1.0 - smoothstep(0.0, 0.016, sdCream(q));
      base  = mix(base, pow(vec3(1.000, 0.988, 0.962), vec3(2.2)), cm);

      // 막대 id로 색을 골라 막대 하나에 여러 색이 섞이지 않게 한다.
      float spId;
      float sp    = 1.0 - smoothstep(0.005, 0.011, sdSprinkles(q, spId));
      float spHue = mod(spId, 3.0);
      vec3  spCol = spHue < 0.5 ? vec3(0.86, 0.20, 0.24)
                  : spHue < 1.5 ? vec3(0.96, 0.78, 0.20)
                  :               vec3(0.30, 0.55, 0.86);
      base  = mix(base, pow(spCol, vec3(2.2)), sp);

      // 체리 — 몸통은 광택 있는 빨강, 줄기는 매트한 초록.
      float chB = 1.0 - smoothstep(0.0, 0.017, sdCherryBody(q));
      float chS = 1.0 - smoothstep(0.0, 0.011, sdCherryStem(q));
      base  = mix(base, pow(vec3(0.78, 0.075, 0.115), vec3(2.2)), chB);
      base  = mix(base, pow(vec3(0.36, 0.42, 0.16), vec3(2.2)), chS);

      /* 눈과 입은 같은 껍질에 새기고, 사용자가 고른 잉크 색을 공유한다. */
      float shl  = faceShell(q, dBE);
      vec2  fm   = vec2(abs(q.x), q.y);
      float eyeM = 1.0 - smoothstep(0.0, 0.012, smax(sdEye2(fm - EYE_POS), shl, 0.011));
      float mthM = 1.0 - smoothstep(0.0, 0.012, smax(sdMouth2(fm), shl, 0.011));
      base = mix(base, pow(uInk, vec3(2.2)), eyeM);
      base = mix(base, pow(uInk, vec3(2.2)), mthM);
      float mask = max(eyeM, mthM);

      gloss  = 1.0 - mask*0.55;
      envAmt = 0.16;
      gloss  = mix(gloss, 0.62, cm);       // 생크림은 매트하되 부드러운 윤기는 있다
      gloss  = mix(gloss, 2.30, chB);      // 체리는 반질반질
      envAmt = mix(envAmt, 0.28, chB);
      wet    = chB;                        // 체리에만 얇은 하이라이트 밴드를 더한다
    } else if(hit.y < 1.5){
      base = pow(uPlate, vec3(2.2));
      gloss = 0.70; envAmt = 0.12;
    } else {
      // 농도가 있는 캐러멜: 중심은 짙고 가장자리에서만 접시가 비친다.
      float rr = length(p.xz)/syrupRadius(p);
      float depth = 1.0 - smoothstep(0.67,1.0,rr);
      vec3 tint = pow(uSyrupCol,vec3(2.2));
      base = mix(tint*1.20 + vec3(0.018),tint*0.54,depth);
      gloss = 2.5; envAmt = 0.34; wet = 1.0;
    }

    vec3 lin = vec3(0.0);
    lin += base*dif*sha*vec3(1.06, 1.00, 0.92)*1.15;
    lin += base*bac*0.20*vec3(1.00, 0.95, 0.92);
    lin += base*ao*skyColor(n)*0.34;
    lin += base*fre*0.14;

    col  = lin;
    col  = mix(col, env, fre*envAmt);
    col += spe *sha*0.72*gloss;
    col += spe2*sha*0.07*gloss;
    // 젖은 표면의 반짝임. 넓게 번지는 spe2 를 키우면 플라스틱처럼 보이므로
    // 좁고 센 spe 쪽만 더한다.
    col += spe *sha*1.05*wet;
    col += fre *0.16*wet*skyColor(reflect(rd, n));
    // 길쭉한 소프트박스가 곡면에 비치는 윤기.
    vec3 ref = reflect(rd,n);
    float strip = exp(-pow((ref.x+0.25)/0.12,2.0)-pow((ref.z+0.90)/0.22,2.0)-pow((ref.y-0.34)/0.13,2.0));
    col += vec3(1.0,0.94,0.82)*strip*wet*0.55;
  }

  if(!isBg){
    col = col/(col + 1.0)*1.62;
    col = pow(clamp(col, 0.0, 1.0), vec3(0.4545));
  }
  fragColor = vec4(col, 1.0);
}`;
})(typeof window !== 'undefined' ? window : globalThis);
