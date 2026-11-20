(function () {
  "use strict";

  const sources = {
    campaign: { param: "c", key: "vx_c", pattern: /^[a-z0-9-]{2,40}$/i, normalize: c => c.toLowerCase() },
    partner: { param: "p", key: "vx_p", pattern: /^[a-z0-9]{4,12}$/i, normalize: c => c.toUpperCase() }
  };
  const pending = new Set();

  async function recordOnce(key, send) {
    if (pending.has(key) || sessionStorage.getItem(key)) return;
    pending.add(key);
    try {
      await send();
      sessionStorage.setItem(key, "1");
    } finally {
      pending.delete(key);
    }
  }

  function visitor() {
    let id = localStorage.getItem("vx_anon");
    if (!id) {
      id = window.crypto?.randomUUID?.() || String(Math.random()).slice(2) + Date.now();
      localStorage.setItem("vx_anon", id);
    }
    return id;
  }

  window.VexoraAttribution = {
    async visit(type, send) {
      const source = sources[type];
      const raw = new URLSearchParams(location.search).get(source.param);
      if (!raw || !source.pattern.test(raw)) return;
      const code = source.normalize(raw);
      localStorage.setItem(source.key, code);
      await recordOnce(source.key + ":visit:" + code, () => send(code, visitor(), location.pathname));
    },

    async assign(type, userId, send) {
      if (!userId) return;
      const source = sources[type];
      const raw = localStorage.getItem(source.key);
      if (!raw || !source.pattern.test(raw)) return;
      const code = source.normalize(raw);
      await recordOnce(source.key + ":assigned:" + userId + ":" + code, () => send(code));
    }
  };
})();
