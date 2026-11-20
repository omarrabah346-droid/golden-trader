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
    form.querySelector("output").textContent = rate > 1
      ? "لا يمكن بلوغ التعادل بهذه التكاليف حتى مع ربح كل الصفقات."
      : new Intl.NumberFormat("ar", { style: "percent", maximumFractionDigits: 2 }).format(rate);
  };
})();
