/* 캐릭터 상태. UI는 이 객체만 바꾸고, 그리기는 항상 이 객체를 읽어 처음부터 다시 그린다. */
(function (global) {
  'use strict';

  var PUDDING = global.PUDDING || (global.PUDDING = {});

  function createState() {
    return {
      animal: 'cat',        // PUDDING.ANIMALS 참고 (8종)
      bodyColor: '#f6d58a',
      eyes: 'round',        // round | sparkle | smile | sleepy | upturned | downturned | half
      eyeColor: '#4b3423',
      mouth: 'three',       // three(ω) | caret(^) | dot(.)
      syrup: 'caramel',     // caramel | choco | strawberry (고른 종류)
      syrupColor: '#cb8b3c', // 실제로 칠하는 색. 종류를 고르면 같이 바뀐다
      text: '',
      plateColor: '#ffffff',
      bgColor: '#fff3e2'
    };
  }

  PUDDING.createState = createState;
})(window);
