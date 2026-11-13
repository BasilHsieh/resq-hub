// ResQ Hub 網站：研究方法頁的流程圖，把相鄰兩步用帶箭頭的折線連起來。
// 沒有這支程式時，步驟的編號照樣看得出順序；點一步會跳到它的說明（靠網址的 #，不靠程式）。
(function () {
  var NS = 'http://www.w3.org/2000/svg';

  function draw() {
    var grids = document.querySelectorAll('.flow-grid');
    for (var g = 0; g < grids.length; g++) {
      var grid = grids[g];
      var svg = grid.querySelector('.flow-links');
      if (!svg) continue;
      var scroller = grid.parentNode, fig = scroller && scroller.parentNode;
      if (fig && fig.classList) fig.classList.toggle('is-scrollable', scroller.scrollWidth > scroller.clientWidth + 4);
      var steps = Array.prototype.slice.call(grid.querySelectorAll('.flow-step'));
      steps.sort(function (a, b) { return Number(a.dataset.step) - Number(b.dataset.step); });
      var box = grid.getBoundingClientRect();
      if (!box.width) continue;
      svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
      while (svg.firstChild) svg.removeChild(svg.firstChild);

      var defs = document.createElementNS(NS, 'defs');
      var marker = document.createElementNS(NS, 'marker');
      marker.setAttribute('id', 'flow-arrow-' + g);
      marker.setAttribute('viewBox', '0 0 8 8');
      marker.setAttribute('refX', '7');
      marker.setAttribute('refY', '4');
      marker.setAttribute('markerWidth', '8');
      marker.setAttribute('markerHeight', '8');
      marker.setAttribute('orient', 'auto');
      var tip = document.createElementNS(NS, 'path');
      tip.setAttribute('d', 'M0 0 L8 4 L0 8 Z');
      marker.appendChild(tip);
      defs.appendChild(marker);
      svg.appendChild(defs);

      for (var i = 0; i < steps.length - 1; i++) {
        var a = steps[i].getBoundingClientRect();
        var b = steps[i + 1].getBoundingClientRect();
        var x1 = a.right - box.left, y1 = a.top + a.height / 2 - box.top;
        var x2 = b.left - box.left - 2, y2 = b.top + b.height / 2 - box.top;
        var mx = x1 + Math.max(4, (x2 - x1) / 2);
        var d = Math.abs(y1 - y2) < 1
          ? 'M' + x1 + ' ' + y1 + ' H' + x2
          : 'M' + x1 + ' ' + y1 + ' H' + mx + ' V' + y2 + ' H' + x2;
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('marker-end', 'url(#flow-arrow-' + g + ')');
        svg.appendChild(path);
      }
    }
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; draw(); });
  }
  if (document.readyState !== 'loading') schedule();
  else document.addEventListener('DOMContentLoaded', schedule);
  window.addEventListener('load', schedule);
  window.addEventListener('resize', schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
})();
