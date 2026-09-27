/* Warm the catalogue while visitors browse the homepage. */
(function () {
  function warm() {
    const selected = document.getElementById('searchPurpose');
    RealtyAddaAPI.prefetch({action: 'listings', purpose: selected && selected.value === 'rent.html' ? 'Rent' : 'Sale', page: 1});
  }
  if ('requestIdleCallback' in window) requestIdleCallback(warm, {timeout: 1500});
  else setTimeout(warm, 500);
  document.getElementById('searchPurpose').addEventListener('change', warm);
  document.querySelectorAll('a[href="buy.html"],a[href="rent.html"]').forEach(link => {
    const prepare = () => RealtyAddaAPI.prefetch({action:'listings',purpose:link.getAttribute('href') === 'rent.html' ? 'Rent' : 'Sale',page:1});
    link.addEventListener('pointerenter', prepare, {once:true});
    link.addEventListener('focus', prepare, {once:true});
  });
})();
