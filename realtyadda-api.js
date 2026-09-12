/* Shared read-only JSONP transport for the existing Apps Script service. */
window.RealtyAddaAPI = Object.freeze({
  url: 'https://script.google.com/macros/s/AKfycbx5bibvXrCBKZ9LsSdIHEaLD5u7UH5m4FPf7IH9nOijFNlEOPVYbFVH-AZu9oxLyT6u/exec',
  read(params, timeout = 35000) {
    return new Promise((resolve, reject) => {
      const callback = 'ra_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      let timer;
      function cleanup() {
        clearTimeout(timer);
        script.remove();
        window[callback] = () => {};
        setTimeout(() => { delete window[callback]; }, 120000);
      }
      window[callback] = data => { cleanup(); resolve(data); };
      script.onerror = () => { cleanup(); reject(new Error('Connection failed. Please retry.')); };
      const url = new URL(RealtyAddaAPI.url);
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
      url.searchParams.set('callback', callback);
      url.searchParams.set('_', Date.now());
      timer = setTimeout(() => { cleanup(); reject(new Error('Connection timed out. Please retry.')); }, timeout);
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }
});
