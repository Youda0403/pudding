/* GIF 인코딩은 화면과 분리한다. */
importScripts('gif.js');
self.onmessage = function(event) {
  try {
    var bytes = self.PUDDING.encodeGif(event.data);
    self.postMessage({bytes: bytes.buffer}, [bytes.buffer]);
  } catch(error) {
    self.postMessage({error: 'GIF를 만들지 못했어요. 다시 시도해 주세요.'});
  }
};
