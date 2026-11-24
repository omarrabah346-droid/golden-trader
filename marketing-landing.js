(function () {
  "use strict";
  const params = new URLSearchParams(location.search);
  const campaign = params.get("c");
  const partner = params.get("p");
  for (const link of document.querySelectorAll("a[href]")) {
    const target = new URL(link.href, location.href);
    if (target.origin !== location.origin || /\/(privacy|terms)\.html$/.test(target.pathname)) continue;
    if (campaign && /^[a-z0-9-]{2,40}$/i.test(campaign)) target.searchParams.set("c", campaign);
    if (partner && /^[a-z0-9]{4,12}$/i.test(partner)) target.searchParams.set("p", partner);
    link.href = target.href;
  }
  const form = document.getElementById("break-even");
  if (!form) return;
  form.onsubmit = event => {
    event.preventDefault();
    const { win, loss, cost } = form.elements;
    const rate = (loss.valueAsNumber + cost.valueAsNumber) / (win.valueAsNumber + loss.valueAsNumber);
    const box = form.querySelector(".res"), out = form.querySelector("output"), why = box ? box.querySelector("span") : null;
    if (box) box.hidden = false;
    if (rate > 1) {
      out.textContent = "غير ممكن";
      if (why) why.textContent = "التكاليف أكبر من متوسط الربح، فلا يمكن بلوغ التعادل حتى لو ربحت كل الصفقات.";
      return;
    }
    const pct = new Intl.NumberFormat("ar", { style: "percent", maximumFractionDigits: 1 }).format(rate);
    out.textContent = pct;
    if (why) why.textContent = "تحتاج أن تربح " + pct + " من صفقاتك على الأقل حتى تغطي خسائرك وتكاليفك. أي نسبة أعلى تعني ربحاً.";
  };
})();
