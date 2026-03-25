/**
 * Excellearn API Bridge Proxy v3
 * Emulasi google.script.run → HTTP fetch() ke GAS doPost()
 *
 * Desain:
 * 1. Getter pattern — setiap akses google.script.run = instance BARU
 *    (mencegah concurrent calls saling timpa callback)
 * 2. Closure-based state — bukan this-reference yang ambigu
 * 3. Setiap chain return new Proxy — chaining .withSuccess().withFailure().fn() bekerja
 */
(function() {
  const API_URL = window.APP_CONFIG?.GAS_API_URL || '';

  function createRunnerInstance() {
    let _onSuccess = null;
    let _onFailure = null;

    const handler = {
      get(_, prop) {
        // Chain handler: .withSuccessHandler(cb) → simpan cb, return proxy baru
        if (prop === 'withSuccessHandler') {
          return (cb) => {
            _onSuccess = cb;
            return new Proxy({}, handler);
          };
        }
        if (prop === 'withFailureHandler') {
          return (cb) => {
            _onFailure = cb;
            return new Proxy({}, handler);
          };
        }

        // Semua properti lain = nama fungsi GAS → eksekusi sebagai API call
        return async (...args) => {
          // Capture callbacks di closure (aman dari concurrent overwrites)
          const onSuccess = _onSuccess;
          const onFailure = _onFailure;
          _onSuccess = null;
          _onFailure = null;

          try {
            const session = JSON.parse(
              localStorage.getItem('excellearn_session') ||
              sessionStorage.getItem('excellearn_session') || '{}'
            );

            const resp = await fetch(API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },  // Avoid CORS preflight
              body: JSON.stringify({
                action: prop,
                params: args,
                idToken: session.idToken || '',
                refreshToken: session.refreshToken || ''
              }),
              redirect: 'follow'  // Handle GAS 302 redirect
            });

            const result = await resp.json();
            if (onSuccess) onSuccess(result);
          } catch (err) {
            console.error(`[API Bridge] ${prop} failed:`, err);
            if (onFailure) onFailure(err);
          }
        };
      }
    };

    return new Proxy({}, handler);
  }

  // GETTER: setiap akses google.script.run = instance baru (concurrent-safe)
  window.google = {
    script: {
      get run() { return createRunnerInstance(); }
    }
  };

  console.log('[API Bridge] ✅ google.script.run proxy active → ' + API_URL);
})();
