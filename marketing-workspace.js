(function () {
  "use strict";

  // Server-dependent features stay off until they pass a live test on the
  // published site. Enable them here after the backend is deployed.
  const flags = Object.assign({ voice: true, publishing: false }, window.VEXORA_MARKETING_FLAGS || {});

  const sections = {
    agent: "وكيل التسويق", research: "فرص الإعلان والمؤثرون",
    content: "مصنع المحتوى والإعلانات", studio: "استوديو الفيديو",
    schedule: "تقويم المحتوى"
  };
  const labels = { draft: "مسودة", review: "للمراجعة", approved: "معتمد", published: "نُشر يدوياً", archived: "مؤرشف" };
  const channels = ["Telegram", "Instagram", "TikTok", "YouTube", "Facebook", "WhatsApp", "Email"];
  const dayStamp = date => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const calendarText = value => String(value).replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[,;]/g, "\\$&");

  function element(tag, text, cls) {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }
  function button(text, action) {
    const el = element("button", text, "btn");
    el.type = "button";
    el.onclick = action;
    return el;
  }
  function field(form, name, label, type, values) {
    const wrapper = element("label", label);
    const el = element(values ? "select" : type === "textarea" ? "textarea" : "input", "", "f");
    el.name = name;
    if (values) for (const [value, title] of values) el.add(new Option(title, value));
    else if (type !== "textarea") el.type = type || "text";
    else el.rows = 8;
    wrapper.append(el);
    form.append(wrapper);
    return el;
  }
  function download(name, content, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const anchor = element("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function studioSubtitles(lines, seconds) {
    const stamp = elapsed => {
      const parts = [Math.floor(elapsed / 3600), Math.floor(elapsed / 60) % 60, elapsed % 60];
      return parts.map(value => String(value).padStart(2, "0")).join(":") + ",000";
    };
    return lines.map((line, index) => [
      index + 1, stamp(index * seconds) + " --> " + stamp((index + 1) * seconds), line,
    ].join("\r\n")).join("\r\n\r\n") + "\r\n";
  }
  function calendar(items) {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//VEXORA//Marketing//AR", "CALSCALE:GREGORIAN"];
    for (const item of items.filter(row => row.status === "approved" && row.scheduled_at)) {
      const publishedAt = new Date(item.scheduled_at);
      lines.push("BEGIN:VEVENT", "UID:" + item.id + "@albashafx.com", "DTSTAMP:" + dayStamp(new Date()),
        "DTSTART:" + dayStamp(publishedAt), "SUMMARY:" + calendarText(item.channel + " · " + item.title),
        "DESCRIPTION:" + calendarText(item.body), "END:VEVENT");
    }
    return lines.concat("END:VCALENDAR", "").join("\r\n");
  }
  function safeUrl(value) {
    if (!value) return "";
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("استعمل رابطاً عاماً بصيغة HTTPS أو HTTP.");
    }
    return url.href;
  }
  async function generate(api, kind, data, active) {
    if (!await api.rpc("vx_marketing_agent_enabled")) throw new Error("وكيل التسويق معطّل أو صلاحيتك غير متاحة.");
    const context = {
      agent: "خطة بالأهداف والمراحل والقنوات والقياس وخطوة المراجعة البشرية",
      research: "معايير تقييم وبحث وأفكار كلمات مفتاحية؛ لا تخترع أسماء أو مشاهدات أو أسعار",
      content: "ثلاث مسودات مختلفة: منشور قناة، نص إعلان قصير، وسكربت ريل مع دعوة واضحة",
      studio: "قائمة لقطات وتوقيت ونص تعليق صوتي ونص ترجمة قابل للنسخ",
      schedule: "خطة زمنية بالقناة والرسالة والوقت المقترح والقياس"
    };
    const q = ["اكتب بالعربية لوحدة تسويق VEXORA. المطلوب: " + context[kind],
      "العنوان: " + data.title, "القناة: " + data.channel,
      "الموجز: " + data.body, "لا تعد بأرباح ولا تخترع نتائج. اذكر مخاطر التداول عند الحاجة. أعطِ مسودة للمراجعة فقط."].join("\n");
    const id = await api.ask(q);
    for (let attempt = 0; attempt < 60 && active(); attempt++) {
      await new Promise(done => setTimeout(done, 1500));
      if (!active()) break;
      const result = await api.result(id);
      if (!result || result.status === "pending") continue;
      if (result.status === "error" || !result.answer) throw new Error("تعذر توليد المسودة من مزود الذكاء الاصطناعي.");
      return String(result.answer);
    }
    throw new Error("لم يكتمل التوليد في الوقت المحدد.");
  }

  async function open(root, api) {
    const loading = element("section", "جارٍ التحقق من صلاحية التسويق…", "panel");
    root.replaceChildren(loading);
    const active = () => root.isConnected && !root.closest("[hidden]");
    try {
      const access = await api.rpc("vx_marketing_access");
      if (!loading.isConnected) return;
      const visible = Object.keys(sections).filter(k => access?.owner || access?.scopes?.includes(k));
      if (!visible.length) {
        loading.textContent = "هذا القسم يتطلب صلاحية تسويق يمنحها مالك المنصة.";
        return;
      }
      const header = element("section", "", "panel vx-marketing-header");
      header.append(element("h2", "VEXORA AI MARKETING SYSTEM"));
      const tabs = element("div", "", "k-tabs");
      const view = element("div");
      header.append(tabs);
      for (const kind of visible) tabs.append(button(sections[kind], () => show(view, api, kind, access.owner, active)));
      if (access.owner) {
        tabs.append(button("التكاملات", () => showIntegrations(view, api)));
        tabs.append(button("صلاحيات الموظفين", () => staff(view, api)));
        tabs.append(button("الحملات والتقارير", () => { location.hash = "growth/mkt"; }));
        tabs.append(button("الحسابات غير المكتملة", () => recovery(view, api)));
        tabs.append(button("السفراء والتقارير اليومية", () => reviewAutomation(view, api)));
      }
      root.replaceChildren(header, view);
      await show(view, api, visible[0], access.owner, active);
    } catch (error) {
      const message = String(error?.message || "");
      const missingSchema = /PGRST202|PGRST205|does not exist|Could not find the function|schema cache/i.test(message);
      loading.textContent = missingSchema
        ? "مركز التسويق غير مفعّل على هذه النسخة بعد. يحتاج ترحيلات قاعدة البيانات وموافقة المالك."
        : "تعذر التحقق من الصلاحية. تحقق من اتصال Supabase وحالة الحساب.";
    }
  }

  async function recovery(view, api) {
    const panel = element("section", "", "panel");
    const list = element("ul");
    panel.append(element("h3", "طلبات التفعيل الأقدم من 24 ساعة"), list,
      button("افتح إدارة الأعضاء للمتابعة", () => { location.hash = "admin"; }));
    view.replaceChildren(panel);
    try {
      const rows = await api.rpc("vx_marketing_recovery");
      if (!rows.length) list.append(element("li", "ماكو حسابات تحتاج متابعة حسب هذا الفلتر."));
      const statuses = { new: "الملف غير مكتمل", pending: "بانتظار مراجعة الإدارة", rejected: "مرفوض" };
      for (const row of rows) list.append(element("li",
        (row.full_name || "بدون اسم") + " · " + statuses[row.status] + " · " + new Date(row.created_at).toLocaleDateString()));
    } catch { list.append(element("li", "تعذر تحميل قائمة المتابعة.")); }
  }

  async function staff(view, api) {
    const form = element("form", "", "panel k-form");
    const user = field(form, "target", "معرّف حساب الموظف (UUID)");
    const picks = Object.entries(sections).map(([key, label]) => {
      const input = field(form, key, label, "checkbox");
      return [key, input];
    });
    const output = element("div", "", "label");
    const list = element("div");
    function render(rows) {
      list.replaceChildren(...rows.map(row => button(row.user_id + " · " + row.scopes.map(k => sections[k]).join("، "), () => {
        user.value = row.user_id;
        for (const [key, input] of picks) input.checked = row.scopes.includes(key);
      })));
    }
    form.append(button("حفظ الصلاحيات (بدون تحديد تُسحب الصلاحية)", async () => {
      try {
        render(await api.rpc("vx_marketing_staff", { target: user.value.trim(), permissions: picks.filter(([, input]) => input.checked).map(([k]) => k) }));
        output.textContent = "تم تحديث الصلاحيات.";
      } catch { output.textContent = "تعذر تحديث الصلاحيات. تحقق من معرّف الحساب."; }
    }), output, list);
    form.onsubmit = e => e.preventDefault();
    view.replaceChildren(form);
    try { render(await api.rpc("vx_marketing_staff")); } catch { output.textContent = "تعذر تحميل صلاحيات الموظفين."; }
  }

  async function show(view, api, kind, owner, active, initial = null) {
    const form = element("form", "", "panel k-form");
    const title = field(form, "title", "العنوان");
    title.required = true;
    title.maxLength = 160;
    const channel = field(form, "channel", "القناة", null, [["", "—"], ...channels.map(c => [c, c])]);
    const code = field(form, "campaign_code", "رمز الحملة الحالية");
    code.pattern = "[a-z0-9\\-]{2,40}";
    const source = field(form, "source_url", "رابط المصدر أو الفرصة", "url");
    const date = field(form, "scheduled_at", "موعد النشر بتوقيت جهازك", "datetime-local");
    const states = owner ? Object.keys(labels) : ["draft", "review"];
    const status = field(form, "status", "الحالة", null, states.map(k => [k, labels[k]]));
    const published = owner ? field(form, "published_url", "رابط المنشور بعد نشره يدوياً", "url") : null;
    const body = field(form, "body", "الموجز أو المسودة", "textarea");
    body.maxLength = 12000;
    const feedback = element("p", "", "label");
    feedback.setAttribute("role", "status");
    const results = element("section", "", "panel");
    let editing = initial?.id || null;
    let initialDraft;
    let locked = false;
    let save;
    let ai;
    function syncLock() {
      if (save) save.disabled = locked;
      if (ai) ai.disabled = locked;
      if (locked) feedback.textContent = "هذا العنصر معتمد من المالك ولا يمكن تعديله من حساب الموظف.";
    }
    function localDate(value) {
      const local = value ? new Date(value) : null;
      return local ? new Date(+local - local.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
    }
    function fill(row = {}) {
      initialDraft = row;
      editing = row.id || null;
      for (const input of [title, channel, code, source, body, published].filter(Boolean)) input.value = row[input.name] || "";
      const state = row.status || "draft";
      locked = !states.includes(state);
      if (locked && ![...status.options].some(option => option.value === state)) {
        const option = new Option(labels[state] || state, state);
        option.disabled = true;
        status.add(option);
      }
      status.value = state;
      date.value = localDate(row.scheduled_at);
      syncLock();
    }
    function data() {
      return { id: editing, title: title.value.trim(), channel: channel.value, campaign_code: code.value.trim(),
        source_url: safeUrl(source.value), scheduled_at: date.value ? new Date(date.value).toISOString() : null,
        status: status.value, published_url: safeUrl(published?.value), body: body.value };
    }
    fill(initial || {});
    save = button("حفظ", null);
    save.type = "submit";
    form.onsubmit = async event => {
      event.preventDefault();
      save.disabled = true;
      try {
        const row = await api.rpc("vx_marketing_items", { section: kind, changes: data() });
        await show(view, api, kind, owner, active, row);
      } catch (error) { feedback.textContent = error.message || "تعذر الحفظ."; }
      finally { save.disabled = locked; }
    };
    ai = button("توليد مسودة بالذكاء الاصطناعي", async () => {
      if (!title.reportValidity()) return;
      ai.disabled = true;
      const documentActive = () => active() && form.isConnected;
      feedback.textContent = "جارٍ توليد المسودة…";
      try {
        const current = await api.rpc("vx_marketing_access");
        if (!documentActive() || !(current?.owner || current?.scopes?.includes(kind))) throw new Error("صلاحية التسويق غير متاحة.");
        const draft = await generate(api, kind, data(), documentActive);
        if (documentActive()) {
          body.value = draft.slice(0, body.maxLength);
          feedback.textContent = "المسودة جاهزة للمراجعة والحفظ.";
        }
      } catch (error) { feedback.textContent = error.message; }
      finally { ai.disabled = locked; }
    });
    syncLock();
    form.append(save, button("مسودة جديدة", () => fill()), ai);
    if (["agent", "content", "studio"].includes(kind)) {
      form.append(button("تصدير الموجز والمسودة", () => download("vexora-brief.txt",
        [title.value, channel.value, code.value, body.value].join("\n\n"), "text/plain;charset=utf-8")));
    }
    if (owner && kind === "content") {
      form.append(button("نسخ المسودة إلى التقويم", () => {
        if (!title.value.trim() || !body.value.trim()) {
          feedback.textContent = "اكتب عنوان المسودة ونصها أولاً.";
          return;
        }
        if (!form.reportValidity()) return;
        try {
          const draft = data();
          show(view, api, "schedule", owner, active, {
            title: draft.title,
            channel: draft.channel,
            campaign_code: draft.campaign_code,
            source_url: draft.source_url,
            scheduled_at: draft.scheduled_at,
            body: draft.body,
            status: "draft",
          });
          const calendarForm = view.querySelector("form.k-form");
          if (calendarForm?.elements.namedItem("scheduled_at")) {
            const statusMessage = calendarForm.querySelector('[role="status"]');
            statusMessage.textContent = "راجع موعد المسودة واضغط حفظ لإضافتها إلى التقويم.";
            calendarForm.elements.namedItem("scheduled_at").focus();
          }
        } catch (error) {
          feedback.textContent = error.message || "تعذر تجهيز مسودة التقويم.";
        }
      }));
    }
    if (kind === "research") {
      const q = field(form, "query", "موضوع البحث");
      const importFile = field(form, "channel_results", "نتائج بحث YouTube بصيغة JSON", "file");
      importFile.accept = ".json,application/json";
      importFile.addEventListener("change", async () => {
        const file = importFile.files[0];
        if (!file) return;
        try {
          if (file.size > 100000) throw new Error();
          const entries = JSON.parse(await file.text());
          if (!Array.isArray(entries) || entries.length > 10) throw new Error();
          const candidates = new Map();
          for (const entry of entries) {
            const name = typeof entry?.title === "string" ? entry.title.trim() : "";
            const url = typeof entry?.url === "string" ? entry.url : "";
            if (!name || !/^https:\/\/www\.youtube\.com\/channel\/[\w-]{24}$/.test(url)) throw new Error();
            candidates.set(url, name.slice(0, 160));
          }
          const list = element("section", "", "panel");
          list.append(element("h3", "نتائج البحث المستوردة"));
          for (const [url, name] of candidates) {
            list.append(button("اختيار " + name, () => {
              fill({ title: name, channel: "YouTube", source_url: url,
                body: "راجع محتوى القناة ومدى ملاءمة جمهورها للحملة قبل التواصل." });
              feedback.textContent = "راجع بيانات القناة واضغط حفظ لإضافتها إلى الفرص.";
              title.focus();
            }));
          }
          form.querySelector("[data-channel-import]")?.remove();
          list.dataset.channelImport = "";
          form.append(list);
          feedback.textContent = candidates.size ? "اختر القناة التي تريد حفظها." : "ملف البحث لا يحتوي على قنوات.";
        } catch {
          feedback.textContent = "تعذر قراءة نتائج البحث. اختر ملف JSON الصادر من أداة بحث YouTube.";
        } finally {
          importFile.value = "";
        }
      });
      for (const [name, base, prefix] of [
        ["YouTube", "https://www.youtube.com/results?search_query=", ""],
        ["قنوات تيليجرام", "https://www.google.com/search?q=", "site:t.me "],
        ["فرص الإعلان", "https://www.google.com/search?q=", "إعلان شراكة "],
        ["المؤثرون", "https://www.google.com/search?q=", "site:instagram.com OR site:tiktok.com "]
      ]) {
        form.append(button(name, () => {
          if (q.value.trim()) window.open(base + encodeURIComponent(prefix + q.value.trim()), "_blank", "noopener,noreferrer");
        }));
      }
    }
    if (kind === "studio") {
      const duration = field(form, "subtitle_seconds", "مدة كل سطر ترجمة بالثواني", "number");
      duration.min = "1";
      duration.max = "30";
      duration.value = "3";
      form.append(button("تنزيل نص التعليق الصوتي", () => {
        if (!body.value.trim()) { feedback.textContent = "أدخل نص التعليق الصوتي أولاً."; return; }
        download("vexora-narration.txt", body.value.trim(), "text/plain;charset=utf-8");
      }), button("تنزيل ترجمة SRT", () => {
        const lines = body.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        const seconds = duration.valueAsNumber;
        if (!lines.length || !Number.isInteger(seconds) || seconds < 1 || seconds > 30) {
          feedback.textContent = "أدخل ترجمة كل مقطع في سطر، وحدد مدة من ثانية إلى 30 ثانية.";
          return;
        }
        download("vexora-subtitles.srt", studioSubtitles(lines, seconds), "text/plain;charset=utf-8");
        feedback.textContent = "تم تنزيل الترجمة. راجع التوقيت مع الصوت قبل دمجها بالفيديو.";
      }));
      if (kind === "studio" && owner && (!flags.voice || !api.localVoice)) {
        const notice = element("section", "", "panel");
        notice.append(element("h3", "التعليق الصوتي بالفصحى · ElevenLabs"));
        notice.append(element("p", "غير مفعّل على النسخة المنشورة: يحتاج مفتاح المزود إلى خادم آمن. شغّل الاستوديو المحلي على 127.0.0.1:4173 لتوليد MP3 وSRT ثم استخدمهما في المونتاج.", "label"));
        form.append(notice);
      }
      if (owner && api.localVoice && flags.voice) {
        const voicePanel = element("section", "", "panel");
        voicePanel.append(element("h3", "معاينة التعليق الصوتي · ElevenLabs"));
        const voices = field(voicePanel, "speech_voice", "الصوت", null, [
          ["21m00Tcm4TlvDq8ikWAM", "Rachel · صوت اختبار متعدد اللغات"],
        ]);
        const gender = field(voicePanel, "speech_gender", "فئة الأصوات", null, [
          ["all", "جميع الأصوات"], ["male", "رجالية"], ["female", "نسائية"],
        ]);
        const override = field(voicePanel, "speech_voice_id", "معرّف صوت يجيد العربية الفصحى (اختياري)");
        const tone = field(voicePanel, "speech_tone", "أسلوب الإلقاء بالفصحى", null, [
          ["formal", "رسمي"], ["ad", "إعلاني حماسي"], ["lesson", "تعليمي هادئ"],
        ]);
        const speed = field(voicePanel, "speech_speed", "السرعة", "number");
        const style = field(voicePanel, "speech_style", "حدة التعبير", "number");
        const stability = field(voicePanel, "speech_stability", "ثبات النبرة", "number");
        for (const [control, low, high, initial] of [[speed, 0.7, 1.2, 1], [style, 0, 1, 0], [stability, 0, 1, 0.5]]) {
          Object.assign(control, { min: String(low), max: String(high), step: "0.05", value: String(initial) });
        }
        const presets = { formal: [1, 0, 0.7], ad: [1.1, 0.25, 0.4], lesson: [0.9, 0.05, 0.65] };
        function selectTone() {
          [speed.value, style.value, stability.value] = presets[tone.value].map(String);
        }
        tone.addEventListener("change", selectTone);
        selectTone();
        const player = element("audio");
        player.controls = true;
        player.hidden = true;
        const audioStatus = element("p", "", "label");
        audioStatus.setAttribute("role", "status");
        let audio;
        let audioUrl;
        let srt;
        let catalog = [{ id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel · صوت تجريبي متعدد اللغات", gender: "female" }];
        function showVoices() {
          const visible = catalog.filter(item => gender.value === "all" || item.gender === gender.value);
          voices.replaceChildren(...visible.map(voice => new Option(voice.name, voice.id)));
          if (!visible.length) voices.add(new Option("أدخل معرّف صوت من حسابك", ""));
        }
        gender.addEventListener("change", showVoices);
        const saveAudio = button("تنزيل MP3 للمونتاج", () => {
          if (audio) download("vexora-voiceover.mp3", audio, "audio/mpeg");
        });
        saveAudio.disabled = true;
        const saveTiming = button("تنزيل SRT متزامن", () => {
          if (srt) download("vexora-voiceover.srt", srt, "text/plain;charset=utf-8");
        });
        saveTiming.disabled = true;
        const load = button("تحميل الأصوات المتاحة", async () => {
          try {
            const result = await api.localVoice("voices");
            catalog = result.entries;
            showVoices();
            audioStatus.textContent = result.listAvailable ? "اختر صوتاً واضحاً بالعربية الفصحى ثم استمع إلى المعاينة." :
              "المفتاح الحالي لا يعرض قائمة الأصوات. تقدر تدخل معرّف صوت من حسابك.";
          } catch { audioStatus.textContent = "تعذر تحميل قائمة الأصوات."; }
        });
        const preview = button("توليد معاينة · يُحتسب من الرصيد", async () => {
          if (!body.value.trim() || body.value.trim().length > 1200) {
            audioStatus.textContent = "اكتب نصاً بالعربية الفصحى لا يتجاوز 1200 حرف في حقل المسودة.";
            return;
          }
          const voice = override.value.trim() || voices.value;
          if (!voice) { audioStatus.textContent = "اختر صوتاً أو أدخل معرّفه."; return; }
          if (![speed, style, stability].every(control => control.value !== "" && control.checkValidity())) return;
          preview.disabled = true;
          audioStatus.textContent = "جارٍ توليد المعاينة…";
          try {
            const next = await api.localVoice("generate", { text: body.value, voice,
              speed: speed.valueAsNumber, style: style.valueAsNumber, stability: stability.valueAsNumber });
            if (!voicePanel.isConnected) return;
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            audio = new Blob([Uint8Array.from(atob(next.audio), character => character.charCodeAt(0))], { type: "audio/mpeg" });
            srt = next.srt;
            audioUrl = URL.createObjectURL(audio);
            player.src = audioUrl;
            player.hidden = false;
            saveAudio.disabled = false;
            saveTiming.disabled = !srt;
            audioStatus.textContent = "المعاينة جاهزة. استخدم MP3 وSRT المتزامن في FFmpeg.";
          } catch (error) {
            audioStatus.textContent = error.message === "budget_limit" || error.message === "provider_limit"
              ? "توقف التوليد عند حد الرصيد." : "تعذر توليد المعاينة. راجع حالة ElevenLabs في التكاملات.";
          } finally { preview.disabled = false; }
        });
        voicePanel.append(load, preview, player, saveAudio, saveTiming, audioStatus);
        form.append(voicePanel);
      }
    }
    if (kind === "schedule" && owner) {
      const target = field(form, "telegram_destination", "وجهة النشر (@قناة Telegram أو رقم حساب Instagram)");
      const queue = element("section", "", "panel");
      const jobStates = { queued: "بانتظار الموعد", sending: "جارٍ الإرسال", sent: "أُرسل", cancelled: "ملغى", review: "تحقق من التسليم" };
      async function loadQueue(args) {
        const jobs = await api.rpc("vx_marketing_publications", args);
        queue.replaceChildren(element("h3", "النشر المجدول"));
        if (!jobs.length) queue.append(element("p", "ماكو منشورات في قائمة الإرسال.", "label"));
        for (const job of jobs) {
          const entry = element("p", [job.title, job.provider === "instagram" ? "Instagram" : "Telegram",
            job.destination, new Date(job.scheduled_at).toLocaleString(),
            jobStates[job.status]].join(" · "));
          if (job.status === "queued") entry.append(button("إلغاء الإرسال", async () => {
            try { await loadQueue({ cancel_job: job.id }); }
            catch { feedback.textContent = "تعذر إلغاء الإرسال. حدّث حالة القائمة."; }
          }));
          queue.append(entry);
        }
      }
      const approve = button("اعتماد الإرسال المجدول", async () => {
        const destination = target.value.trim();
        const instagram = channel.value === "Instagram";
        const validTarget = instagram ? /^\d+$/.test(destination) : /^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(destination);
        if (!editing || !["Telegram", "Instagram"].includes(channel.value) || status.value !== "approved" ||
          !date.value || !validTarget || (instagram && !source.value.startsWith("https://"))) {
          feedback.textContent = "احفظ موعداً معتمداً وأدخل وجهة صالحة. Instagram يحتاج رابط صورة HTTPS في حقل المصدر.";
          return;
        }
        const saved = initialDraft;
        if (!saved || saved.id !== editing || saved.title !== title.value.trim() ||
          saved.body !== body.value.trim() || saved.channel !== channel.value ||
          saved.status !== status.value || localDate(saved.scheduled_at) !== date.value ||
          (instagram && saved.source_url !== source.value.trim())) {
          feedback.textContent = "احفظ آخر تعديلاتك قبل اعتماد الإرسال.";
          return;
        }
        if (!window.confirm("اعتماد إرسال النص المحفوظ إلى " + destination + " بتاريخ " + new Date(date.value).toLocaleString() + "؟")) return;
        try {
          await loadQueue({ item: editing, destination_name: destination, expected_revision: saved.updated_at });
          feedback.textContent = "انضاف المنشور إلى قائمة الإرسال.";
        } catch {
          feedback.textContent = "تعذر اعتماد الإرسال. تحقق من تفعيل التكامل والموعد وحالة قائمة الإرسال.";
        }
      });
      if (!flags.publishing) {
        approve.disabled = true;
        form.append(element("p", "الإرسال التلقائي معطّل: يحتاج مشغّل خلفي دائم. استخدم تصدير ICS والنشر اليدوي ثم سجّل رابط المنشور.", "label"));
      }
      form.append(approve, button("تحديث حالة الإرسال", () => loadQueue().catch(() => {
        feedback.textContent = "تعذر تحديث قائمة الإرسال.";
      })));
      const start = field(form, "campaign_start", "بداية خطة 30 يوماً بتوقيت جهازك", "datetime-local");
      form.append(button("تصدير قالب حملة 30 يوماً", async () => {
        if (!start.value) { feedback.textContent = "حدد وقت بداية الحملة."; return; }
        try {
          const response = await fetch("vexora-campaign-30.json");
          if (!response.ok) throw new Error();
          const plan = await response.json();
          const rows = plan.map(item => {
            const due = new Date(start.value);
            due.setDate(due.getDate() + item.day - 1);
            const url = new URL(item.path, location.href);
            if (/^[a-z0-9-]{2,40}$/.test(code.value)) url.searchParams.set("c", code.value);
            return { ...item, id: "plan-" + due.toISOString().slice(0, 10) + "-" + item.day,
              title: "مسودة: " + item.title, body: item.body + "\n" + url.href,
              status: "approved", scheduled_at: due.toISOString() };
          });
          download("vexora-30-days-draft.ics", calendar(rows), "text/calendar;charset=utf-8");
          feedback.textContent = "تصدير قالب للمراجعة. جدول النشر المعتمد يبقى منفصلاً.";
        } catch { feedback.textContent = "تعذر قراءة قالب الحملة."; }
      }));
      form.append(queue);
      loadQueue().catch(() => queue.replaceChildren(element("p", "قائمة الإرسال غير متاحة.", "label")));
    }
    form.append(feedback);
    view.replaceChildren(form, results);
    try {
      const rows = await api.rpc("vx_marketing_items", { section: kind });
      if (!results.isConnected) return;
      if (kind === "schedule") results.append(button("تصدير المواعيد المعتمدة (ICS)", () => download("vexora-calendar.ics", calendar(rows), "text/calendar;charset=utf-8")));
      if (!rows.length) results.append(element("p", "ماكو عناصر محفوظة بهذا القسم.", "label"));
      for (const row of rows) {
        const when = row.scheduled_at ? " · " + new Date(row.scheduled_at).toLocaleString() : "";
        results.append(button(row.title + " · " + labels[row.status] + when, () => fill(row)));
      }
    } catch { results.textContent = "تعذر تحميل سجلات هذا القسم."; }
  }

  async function reviewAutomation(view, api) {
    view.replaceChildren(element("p", "جارٍ تحميل التقارير والطلبات…", "label"));
    try {
      const data = await api.rpc("vx_marketing_owner_review");
      const panel = element("section", "", "panel");
      panel.append(element("h3", "التقارير اليومية والسفراء"));
      panel.append(element("p", "تذكيرات الحسابات المنتظرة: " + data.recovery_pending, "label"));
      for (const row of data.daily_reports) {
        panel.append(element("p", `${row.report_day} · حسابات: ${row.profiles_created} · مسودات: ${row.drafts_created} · طلبات سفراء: ${row.ambassador_requests}`));
      }
      for (const row of data.ambassadors) {
        const entry = element("article", "", "panel");
        entry.append(element("p", row.statement), element("p", row.status, "label"));
        if (row.status === "pending") {
          const decide = async approve => {
            for (const control of entry.querySelectorAll("button")) control.disabled = true;
            try {
              await api.rpc("vx_marketing_owner_review", { target: row.user_id, approve });
              await reviewAutomation(view, api);
            } catch {
              entry.append(element("p", "تعذر تسجيل القرار.", "label"));
              for (const control of entry.querySelectorAll("button")) control.disabled = false;
            }
          };
          entry.append(button("موافقة", () => decide(true)), button("رفض", () => decide(false)));
        }
        panel.append(entry);
      }
      view.replaceChildren(panel);
    } catch { view.replaceChildren(element("p", "تعذر تحميل بيانات الأتمتة.", "label")); }
  }

  async function memberAutomation(anchor, api, approved) {
    if (!anchor || !api) return;
    const id = anchor.id + "MarketingAutomation";
    document.getElementById(id)?.remove();
    const panel = element("section", "", "panel");
    panel.id = id;
    anchor.after(panel);
    try {
      if (approved) {
        const application = await api.rpc("vx_marketing_ambassador_apply");
        const input = element("textarea", "", "f");
        input.maxLength = 1500;
        input.value = application?.statement ?? "";
        const status = element("p", application?.status ?? "", "label");
        panel.append(element("h3", "برنامج سفراء فيكسورا"), status);
        if (!application || application.status === "pending") {
          input.setAttribute("aria-label", "اكتب مقترح تعاونك");
          const submit = button("إرسال طلب السفير", async () => {
            if (input.value.trim().length < 10) { status.textContent = "اكتب 10 أحرف على الأقل."; return; }
            submit.disabled = true;
            try {
              await api.rpc("vx_marketing_ambassador_apply", { message: input.value.trim() });
              status.textContent = "الطلب قيد المراجعة.";
            } catch { status.textContent = "تعذر حفظ الطلب."; }
            finally { submit.disabled = false; }
          });
          panel.append(input, submit);
        }
      } else {
        const state = await api.rpc("vx_marketing_recovery_state");
        const label = element("label", " ذكّرني داخل المنصة بمتابعة تفعيل حسابي");
        const input = element("input");
        input.type = "checkbox";
        input.checked = state.enabled;
        label.prepend(input);
        const notice = element("p", state.reminder ? "حسابك يحتاج متابعة. راجع بيانات الملف أو حالة طلبك." : "", "label");
        input.addEventListener("change", async () => {
          input.disabled = true;
          try {
            await api.rpc("vx_marketing_recovery_consent", { enabled: input.checked });
            notice.textContent = input.checked ? "تم حفظ اختيارك." : "أوقفت التذكير.";
          } catch {
            input.checked = !input.checked;
            notice.textContent = "تعذر حفظ اختيارك.";
          } finally { input.disabled = false; }
        });
        panel.append(label, notice);
      }
    } catch { panel.remove(); }
  }

  async function showIntegrations(view, api) {
    const panel = element("section", "", "panel");
    panel.append(element("h3", "إدارة تكاملات فيكسورا"));
    const status = element("p", "جارٍ التحميل…", "label");
    const list = element("div");
    panel.append(status, list);
    if (api.localVoice) {
      const voice = element("p", "ElevenLabs · جارٍ قراءة حالة التوليد المحلي…", "label");
      panel.append(voice);
      api.localVoice("status").then(state => {
        const labels = { connected: "نجح آخر طلب توليد", untested: "لم يُختبر", unconfirmed: "آخر محاولة غير مؤكدة",
          provider_limit: "التوليد متوقف عند حد المزود" };
        voice.textContent = "ElevenLabs · " + (state.configured ? labels[state.last] || "تعذر آخر طلب توليد" : "المفتاح غير مهيأ")
          + " · الحجز المحلي " + state.reserved + " / " + state.limit + " · المتاح محلياً " + state.remaining;
      }).catch(() => { voice.textContent = "ElevenLabs · تعذّرت قراءة الرصيد المحلي."; });
    }
    view.replaceChildren(panel);
    const states = { untested: "لم يُختبر", ok: "نجح آخر اختبار", missing_config: "إعدادات ناقصة",
      denied: "رفض الصلاحية", rate_limited: "بلغ حد الاستخدام", unreachable: "تعذر الاتصال" };
    const names = { supabase: "Supabase المحلي", telegram: "Telegram", agent: "وكيل التسويق",
      youtube: "YouTube", instagram: "Instagram", voice: "التعليق الصوتي المحلي" };
    try {
      const rows = await api.rpc("vx_marketing_integrations");
      status.textContent = "حالة الاختبار منفصلة عن حالة التفعيل. المفاتيح تُدار على الخادم.";
      for (const row of rows) {
        const entry = element("article", "", "panel");
        entry.append(element("h4", names[row.provider]));
        entry.append(element("p", states[row.status] ?? "غير معروف", "label"));
        entry.append(element("p", "آخر اختبار: " + (row.checked_at ? new Date(row.checked_at).toLocaleString("ar-IQ") : "—"), "label"));
        entry.append(element("p", "الاستخدام / الحد: " + (row.usage_count ?? "—") + " / " + (row.usage_limit ?? "—"), "label"));
        const toggle = button(row.enabled ? "تعطيل" : "تفعيل", async () => {
          toggle.disabled = true;
          try {
            await api.rpc("vx_marketing_integrations", { provider_name: row.provider, is_enabled: !row.enabled });
            if (panel.isConnected) await showIntegrations(view, api);
          } catch { status.textContent = "تعذر حفظ التغيير."; toggle.disabled = false; }
        });
        entry.append(toggle);
        list.append(entry);
      }
    } catch { status.textContent = "تعذر تحميل التكاملات. تحقق من تطبيق ترحيل الاختبار."; }
  }

  window.VexoraMarketing = { open, memberAutomation, flags };
})();
