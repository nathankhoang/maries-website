/* Shared text-to-speech (classic script → window.AVTtts).
 * Tries the real Azure neural voice via /api/tts (great Vietnamese); falls
 * back to the browser's speechSynthesis when offline, on error, or before
 * the Azure key is configured. Used by the phrasebook (main.js) and the
 * AI translator (translator.js). One current utterance at a time.
 */
(function () {
  var current = { audio: null };
  var synth = window.speechSynthesis;
  var voices = [];

  function loadVoices() { if (synth) voices = synth.getVoices(); }
  if (synth) {
    loadVoices();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices);
  }
  function pickVoice(bcp) {
    var base = bcp.split('-')[0].toLowerCase();
    return (
      voices.find(function (v) { return v.lang === bcp; }) ||
      voices.find(function (v) {
        return v.lang && v.lang.replace('_', '-').toLowerCase().indexOf(base) === 0;
      }) || null
    );
  }
  function hasViVoice() { return !!pickVoice('vi-VN'); }

  function stop() {
    if (current.audio) {
      try { current.audio.pause(); } catch (e) {}
      current.audio = null;
    }
    if (synth && synth.speaking) synth.cancel();
  }

  function browserSpeak(text, bcp, cb) {
    if (!synth) { if (cb.onerror) cb.onerror('no-tts'); return; }
    var u = new SpeechSynthesisUtterance(text);
    u.lang = bcp;
    var v = pickVoice(bcp);
    if (v) u.voice = v;
    u.rate = 0.92;
    u.onstart = function () { if (cb.onstart) cb.onstart('browser'); };
    u.onend = function () { if (cb.onend) cb.onend(); };
    u.onerror = function () { if (cb.onerror) cb.onerror('browser-error'); };
    synth.speak(u);
  }

  // lang: 'vi' | 'en'
  function speak(text, lang, cb) {
    cb = cb || {};
    stop();
    text = (text || '').trim();
    if (!text) return;
    var isEn = lang === 'en';
    var bcp = isEn ? 'en-US' : 'vi-VN';

    if (!navigator.onLine) { browserSpeak(text, bcp, cb); return; }

    var audio = new Audio();
    var fellBack = false;
    function fallback() {
      if (fellBack) return;
      fellBack = true;
      current.audio = null;
      browserSpeak(text, bcp, cb);
    }
    audio.onplaying = function () { if (cb.onstart) cb.onstart('neural'); };
    audio.onended = function () {
      if (current.audio === audio) current.audio = null;
      if (cb.onend) cb.onend();
    };
    audio.onerror = fallback; // 503/502/429 from /api/tts → use local voice
    current.audio = audio;
    audio.src = '/api/tts?lang=' + (isEn ? 'en' : 'vi') + '&text=' + encodeURIComponent(text);
    var p = audio.play();
    if (p && p.catch) p.catch(fallback);
  }

  window.AVTtts = {
    speak: speak,
    stop: stop,
    hasViVoice: hasViVoice,
    speaking: function () {
      return !!current.audio || !!(synth && synth.speaking);
    },
  };
})();
