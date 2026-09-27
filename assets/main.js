// 社内IT道具箱：スマホのメニュー開閉、よくある質問の開閉、トップのスライド
(function () {
  'use strict';

  // このファイルが読み込めたときだけメニューを折りたたむ（CSSは .js を見て切り替える）
  document.documentElement.classList.add('js');

  // ===== スマホのメニュー =====
  var toggle = document.querySelector('.menu-toggle');
  var nav = toggle ? document.getElementById(toggle.getAttribute('aria-controls')) : null;

  function setMenu(open, returnFocus) {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    nav.classList.toggle('is-open', open);
    if (!open && returnFocus) toggle.focus();
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true', false);
    });
    // リンクを押したら閉じる
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false, false);
    });
    // Escで閉じ、開閉ボタンにフォーカスを戻す
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setMenu(false, true);
    });
    // メニューの外を押したら閉じる
    document.addEventListener('click', function (event) {
      if (toggle.getAttribute('aria-expanded') === 'true' && !event.target.closest('.site-header')) setMenu(false, false);
    });
  }

  // ===== よくある質問 =====
  // HTMLでは全部の回答を表示しておき（JSが動かなくても読める）、ここで初期状態にそろえる
  var buttons = document.querySelectorAll('.accordion__button');
  Array.prototype.forEach.call(buttons, function (button) {
    var panel = document.getElementById(button.getAttribute('aria-controls'));
    if (!panel) return;
    var open = button.hasAttribute('data-initially-open');
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.hidden = !open;
    button.addEventListener('click', function () {
      var expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      panel.hidden = expanded;
    });
  });
  // ===== トップのスライド（4枚。4枚目の次は1枚目へ、同じ向きに回り続ける） =====
  var carousel = document.querySelector('.hero-carousel');
  if (carousel) {
    var viewport = carousel.querySelector('.hero-carousel__viewport');
    var track = carousel.querySelector('.hero-carousel__track');
    var slides = Array.prototype.slice.call(track.querySelectorAll('.hero-slide'));
    var dots = Array.prototype.slice.call(carousel.querySelectorAll('.hero-carousel__dot'));
    var count = slides.length;
    var INTERVAL = 4000;
    var DURATION = 700;
    var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var reduceMotion = !!(motionQuery && motionQuery.matches);

    // 1枚目の複製を末尾に置き、4枚目→複製→（瞬時に）1枚目で、同じ向きのまま1枚目へ戻す
    var clone = slides[0].cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.removeAttribute('role');
    clone.removeAttribute('aria-roledescription');
    clone.removeAttribute('aria-label');
    clone.setAttribute('inert', '');
    Array.prototype.forEach.call(clone.querySelectorAll('img'), function (img) { img.removeAttribute('fetchpriority'); });
    track.appendChild(clone);

    var position = 0;      // トラック上の位置（0〜count。countは複製）
    var busy = false;
    var timer = null;
    var stopped = reduceMotion;  // 動きを減らす設定のときは自動で切り替えない
    var hovering = false;
    var focusInside = false;

    function setPosition(pos, animate) {
      track.classList.toggle('is-animating', !!animate && !reduceMotion);
      track.style.transform = 'translateX(' + (-pos * 100) + '%)';
      position = pos;
    }

    function current() { return position % count; }

    function updateState() {
      var active = current();
      var onClone = position === count;  // 4→1の途中は、画面に出ている複製だけを操作できるようにする
      slides.forEach(function (slide, i) {
        if (i === active && !onClone) { slide.removeAttribute('inert'); slide.removeAttribute('aria-hidden'); }
        else { slide.setAttribute('inert', ''); slide.setAttribute('aria-hidden', 'true'); }
      });
      if (onClone) clone.removeAttribute('inert'); else clone.setAttribute('inert', '');
      dots.forEach(function (dot, i) {
        if (i === active) dot.setAttribute('aria-current', 'true'); else dot.removeAttribute('aria-current');
      });
    }

    function afterMove(callback) {
      if (reduceMotion) { callback(); return; }
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        track.removeEventListener('transitionend', onEnd);
        callback();
      }
      function onEnd(event) { if (event.target === track) finish(); }
      track.addEventListener('transitionend', onEnd);
      window.setTimeout(finish, DURATION + 100);  // transitionend が来ない場合の保険
    }

    function moveTo(pos) {
      if (busy) return;
      busy = true;
      stop();
      setPosition(pos, true);
      updateState();
      afterMove(function () {
        if (position === count) { setPosition(0, false); updateState(); }  // 複製から1枚目へ瞬時に戻す
        busy = false;
        // 切り替えの間隔は、動き始めから次の動き始めまでで4秒にする
        schedule(reduceMotion ? INTERVAL : INTERVAL - DURATION);
      });
    }

    function next() { moveTo(position + 1); }

    function prev() {
      if (busy) return;
      if (position === 0) {
        // 1枚目から戻るときは、複製の位置へ瞬時に移ってから4枚目へ動かす
        setPosition(count, false);
        void track.offsetWidth;
      }
      moveTo(position - 1);
    }

    function goTo(index) {
      if (index === current()) return;
      moveTo(index);
    }

    function stop() { if (timer) { window.clearTimeout(timer); timer = null; } }

    function schedule(delay) {
      stop();
      if (!(stopped || hovering || focusInside || document.hidden)) timer = window.setTimeout(next, typeof delay === 'number' ? delay : INTERVAL);
      // 自動で動いている間は読み上げない。止まっている間は、切り替えを読み上げる
      viewport.setAttribute('aria-live', timer ? 'off' : 'polite');
    }

    // 手動で動かしたあとも、4秒後からまた自動で切り替える（移動が終わった時点でタイマーを掛け直す）
    carousel.querySelector('[data-action="next"]').addEventListener('click', function () { next(); });
    carousel.querySelector('[data-action="prev"]').addEventListener('click', function () { prev(); });
    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { goTo(i); });
    });

    // マウスが乗っている間・中にフォーカスがある間・タブが見えない間は止める
    carousel.addEventListener('mouseenter', function () { hovering = true; stop(); });
    carousel.addEventListener('mouseleave', function () { hovering = false; schedule(); });
    carousel.addEventListener('focusin', function () { focusInside = true; stop(); });
    carousel.addEventListener('focusout', function (event) {
      if (!carousel.contains(event.relatedTarget)) { focusInside = false; schedule(); }
    });
    document.addEventListener('visibilitychange', function () { schedule(); });
    if (motionQuery && motionQuery.addEventListener) {
      motionQuery.addEventListener('change', function (event) {
        reduceMotion = event.matches;
        stopped = reduceMotion;
        schedule();
      });
    }

    // スマホ：横にスワイプで前後へ（縦のスクロールは邪魔しない）
    var startX = null, startY = null, swiped = false;
    // スワイプの直後に、指を離した場所のリンクが押されないようにする
    viewport.addEventListener('click', function (event) {
      if (swiped) { event.preventDefault(); event.stopPropagation(); swiped = false; }
    }, true);
    viewport.addEventListener('pointerdown', function (event) {
      swiped = false;
      if (event.pointerType === 'mouse') return;
      startX = event.clientX; startY = event.clientY;
    });
    viewport.addEventListener('pointerup', function (event) {
      if (startX === null) return;
      var dx = event.clientX - startX, dy = event.clientY - startY;
      startX = startY = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        swiped = true;
        window.setTimeout(function () { swiped = false; }, 400);  // 直後のクリックだけを止める
        if (dx < 0) next(); else prev();
      }
    });
    viewport.addEventListener('pointercancel', function () { startX = startY = null; });

    setPosition(0, false);
    updateState();
    schedule();
  }
})();
