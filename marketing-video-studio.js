(function () {
  "use strict";

  const sizes = { vertical: [1080, 1920], horizontal: [1920, 1080], square: [1080, 1080] };
  const formats = {
    mp4: ["video/mp4;codecs=avc1.420034,mp4a.40.2", "video/mp4"],
    webm: ["video/webm;codecs=vp8,opus", "video/webm"]
  };

  function partnerLink(value, links = {}) {
    const url = new URL(value || "https://albashafx.com/app.html", location.href);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("رابط الشريك غير صالح.");
    if (url.origin !== location.origin && !["albashafx.com", "www.albashafx.com"].includes(url.hostname)) return url.href;
    const incoming = new URLSearchParams(location.search);
    for (const [key, source] of [["p", links.sale], ["t", links.team]]) {
      if (url.searchParams.has(key)) continue;
      const fallback = source ? new URL(source, location.href).searchParams.get(key) : null;
      const code = incoming.get(key) || fallback;
      if (code) url.searchParams.set(key, code);
    }
    if (!url.hash && url.searchParams.has("t") && !url.searchParams.has("p")) {
      url.hash = "partners/apply";
    }
    return url.href;
  }

  function parseSrt(text) {
    const stamp = "(\\d{2,}):(\\d{2}):(\\d{2})[,.](\\d{3})";
    const timing = new RegExp("^" + stamp + "\\s+-->\\s+" + stamp + "(?:\\s.*)?$");
    const seconds = ([h, m, s, ms]) => +h * 3600 + +m * 60 + +s + +ms / 1000;
    const cues = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/).map(block => {
      const lines = block.split("\n");
      if (/^\d+$/.test(lines[0].trim())) lines.shift();
      const match = timing.exec(lines.shift().trim());
      if (!match || !lines.length) throw new Error("تعذّرت قراءة ملف SRT.");
      const start = seconds(match.slice(1, 5));
      const end = seconds(match.slice(5, 9));
      if (end <= start) throw new Error("توقيت الترجمة غير صالح.");
      return { start, end, text: lines.join("\n").replace(/<\/?(?:i|b|u)>/gi, "") };
    });
    return cues.sort((a, b) => a.start - b.start);
  }

  function loaded(media, event, source) {
    return new Promise((resolve, reject) => {
      function finish(error) {
        clearTimeout(timeout);
        media.removeEventListener(event, ready);
        media.removeEventListener("error", failed);
        if (error) reject(error);
        else resolve(media);
      }
      const ready = () => finish();
      const failed = () => finish(new Error("تعذّرت قراءة الوسائط."));
      const timeout = setTimeout(failed, 15000);
      media.addEventListener(event, ready);
      media.addEventListener("error", failed);
      media.src = source;
    });
  }

  function mount(root, options = {}) {
    const scenes = [];
    const urls = new Set();
    const connections = new Map();
    const controller = new AbortController();
    let cues = [];
    let time = 0;
    let frame = 0;
    let clock = null;
    let playback = 0;
    let exportController;
    let captureTrack;
    let capturedFrame = 0;
    let partnerLinks = {};
    let referralEdited = false;
    let narration = null;
    let sound = null;
    let destination;
    let monitor;
    let busy = false;
    let link = partnerLink("");
    let logo;

    function add(tag, parent, text) {
      const node = document.createElement(tag);
      if (text) node.textContent = text;
      parent.append(node);
      return node;
    }

    function field(parent, title, type, values) {
      const label = add("label", parent, title);
      label.style.display = "block";
      const input = add(values ? "select" : "input", label);
      input.className = "f";
      if (values) for (const [key, name] of values) input.add(new Option(name, key));
      else input.type = type;
      return input;
    }

    function button(parent, name, action) {
      const control = add("button", parent, name);
      control.type = "button";
      control.className = "btn";
      control.onclick = action;
      return control;
    }

    const panel = add("section", root);
    panel.className = "panel";
    panel.dir = "rtl";
    add("h3", panel, "محرر فيديو VEXORA");
    const controls = add("div", panel);
    const files = field(controls, "إضافة صور ومقاطع فيديو", "file");
    files.accept = "image/*,video/*";
    files.multiple = true;
    const ratio = field(controls, "أبعاد الفيديو", "", [["vertical","عمودي 9:16"], ["horizontal","أفقي 16:9"], ["square","مربع 1:1"]]);
    const referral = field(controls, "رابط الشريك الموحّد", "url");
    referral.dir = "ltr";
    referral.value = link;
    const captions = field(controls, "إضافة ترجمة SRT", "file");
    captions.accept = ".srt";
    const voiceFile = field(controls, "إضافة تعليق صوتي من الجهاز", "file");
    voiceFile.accept = "audio/*";
    const canvas = add("canvas", panel);
    canvas.style.cssText = "display:block;max-width:100%;max-height:55vh;width:auto;height:auto;margin:12px auto;background:#111";
    const ctx = canvas.getContext("2d");
    const scrub = field(controls, "موضع المعاينة على الخط الزمني", "range");
    panel.append(scrub.parentElement);
    Object.assign(scrub, { min: "0", max: "0", step: "0.01", value: "0" });
    scrub.dir = "ltr";
    const position = add("output", panel);
    const play = button(panel, "تشغيل المعاينة", () => {
      if (clock !== null) stop();
      else if (!busy) run(false).catch(report);
    });
    const timeline = add("div", panel);
    timeline.style.cssText = "display:flex;gap:8px;overflow-x:auto;padding:8px 0;direction:ltr";
    add("h4", panel, "التصدير");
    const exportMp4 = button(panel, "تصدير MP4", () => exportVideo("mp4"));
    const exportWebm = button(panel, "تصدير WebM", () => exportVideo("webm"));
    const status = add("p", panel);
    status.setAttribute("role", "status");
    const report = error => { status.textContent = error.message || String(error); };
    const duration = () => scenes.reduce((total, scene) => total + scene.duration, 0);
    const supported = ext => formats[ext].filter(type => window.MediaRecorder?.isTypeSupported(type));
    exportMp4.hidden = !canvas.captureStream || !supported("mp4").length;
    exportWebm.hidden = !canvas.captureStream || !supported("webm").length;

    function track(blob) {
      const url = URL.createObjectURL(blob);
      urls.add(url);
      return url;
    }

    function release(url) {
      URL.revokeObjectURL(url);
      urls.delete(url);
    }

    function disposeMedia(media) {
      connections.get(media)?.disconnect();
      connections.delete(media);
      media.pause?.();
      release(media.src);
      media.removeAttribute("src");
    }

    function layerText(value, y, size, opacity = 1, lineLimit = 3) {
      if (!value) return;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.font = "bold " + size + "px system-ui, sans-serif";
      ctx.direction = /^https?:/i.test(value) ? "ltr" : "inherit";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const max = canvas.width * 0.9;
      const lines = [];
      for (const paragraph of value.split("\n")) {
        let line = "";
        for (const word of paragraph.split(/\s+/)) {
          const candidate = line ? line + " " + word : word;
          if (line && ctx.measureText(candidate).width > max) {
            lines.push(line);
            line = word;
          } else line = candidate;
        }
        lines.push(line);
      }
      const visible = lines.slice(0, lineLimit);
      for (const [i, line] of visible.entries()) {
        const baseline = y + (i - (visible.length - 1) / 2) * size * 1.3;
        const width = Math.min(max, ctx.measureText(line).width);
        ctx.fillStyle = "rgba(12,12,18,.78)";
        ctx.fillRect((canvas.width - width) / 2 - size / 4, baseline - size * .63, width + size / 2, size * 1.26);
        ctx.fillStyle = "#fff";
        ctx.fillText(line, canvas.width / 2, baseline, max);
      }
      ctx.restore();
    }

    function sceneAt(at) {
      let start = 0;
      for (const scene of scenes) {
        if (at < start + scene.duration || scene === scenes.at(-1)) return { scene, offset: at - start };
        start += scene.duration;
      }
      return { offset: 0 };
    }

    function draw() {
      const { width, height } = canvas;
      const { scene, offset } = sceneAt(time);
      ctx.fillStyle = "#10111a";
      ctx.fillRect(0, 0, width, height);
      if (scene) {
        const { media, transition } = scene;
        const w = media.videoWidth || media.naturalWidth;
        const h = media.videoHeight || media.naturalHeight;
        const progress = Math.max(0, Math.min(1, offset / Math.min(.55, scene.duration / 2)));
        if (w && h && (!scene.video || media.readyState >= 2)) {
          ctx.save();
          const scale = Math.max(width / w, height / h) * (transition === "zoom" ? 1 + (1 - progress) * .13 : 1);
          if (transition === "fade") ctx.globalAlpha = progress;
          const slide = transition === "slide" ? width * (1 - progress) ** 2 : 0;
          ctx.drawImage(media, (width - w * scale) / 2 + slide, (height - h * scale) / 2, w * scale, h * scale);
          ctx.restore();
        }
        const titleProgress = scene.animation === "none" ? 1 : Math.min(1, Math.max(0, offset / .45));
        layerText(scene.title, height * .45 + (scene.animation === "rise" ? 55 * (1 - titleProgress) : 0), width * .055, titleProgress);
      }
      const caption = cues.filter(cue => cue.start <= time && time < cue.end).map(cue => cue.text).join("\n");
      layerText(caption, height * .81, width * .037);
      if (logo) {
        const w = Math.min(width * .20, height * .18 * logo.naturalWidth / logo.naturalHeight);
        const h = w * logo.naturalHeight / logo.naturalWidth;
        ctx.fillStyle = "rgba(12,12,18,.76)";
        ctx.fillRect(width * .03, height * .032, w + 22, h + 20);
        ctx.drawImage(logo, width * .03 + 11, height * .032 + 10, w, h);
      } else layerText("VEXORA", height * .09, width * .045);
      layerText(link, height * .945, Math.max(20, width * .027), 1, 1);
      scrub.value = String(time);
      position.value = time.toFixed(2) + " / " + duration().toFixed(2) + " ث";
    }

    function syncMedia(playing) {
      const { scene: current, offset } = sceneAt(time);
      for (const { media, video, duration: length } of scenes) {
        if (!video) continue;
        if (current?.media === media) {
          const at = Math.min(offset, length, Math.max(0, media.duration - .035));
          if (Math.abs(media.currentTime - at) > (playing ? .20 : .015)) media.currentTime = at;
          if (playing && media.paused && offset < media.duration) media.play().catch(() => {});
          if (!playing || offset >= media.duration) media.pause();
        } else media.pause();
      }
      if (narration) {
        const at = Math.min(time, narration.duration);
        if (Math.abs(narration.currentTime - at) > (playing ? .20 : .015)) narration.currentTime = at;
        if (playing && narration.paused && time < narration.duration) narration.play().catch(() => {});
        if (!playing || time >= narration.duration) narration.pause();
      }
    }

    function connect(media) {
      if (connections.has(media)) return;
      const source = sound.createMediaElementSource(media);
      source.connect(destination);
      source.connect(monitor);
      connections.set(media, source);
    }

    async function audioGraph() {
      if (!sound) {
        sound = new AudioContext();
        destination = sound.createMediaStreamDestination();
        monitor = sound.createGain();
        monitor.connect(sound.destination);
      }
      await sound.resume();
      for (const scene of scenes) if (scene.video) connect(scene.media);
      if (narration) connect(narration);
    }

    function stop() {
      playback++;
      cancelAnimationFrame(frame);
      clock = null;
      syncMedia(false);
      play.textContent = "تشغيل المعاينة";
    }

    async function run(recording, onComplete) {
      if (!scenes.length) throw new Error("أضف مشهداً أولاً.");
      const request = ++playback;
      await audioGraph();
      controller.signal.throwIfAborted();
      if (request !== playback) return;
      if (recording) exportController.signal.throwIfAborted();
      monitor.gain.value = recording ? 0 : 1;
      if (time >= duration() || recording) time = 0;
      const start = performance.now() - time * 1000;
      let lastFrame = -1;
      clock = start;
      play.textContent = "إيقاف المعاينة";
      function tick(now) {
        if (clock !== start) return;
        time = Math.min(duration(), Math.max(0, (now - start) / 1000));
        syncMedia(true);
        const index = Math.floor(time * 30);
        if (!recording || index !== lastFrame || time === duration()) {
          draw();
          if (recording) {
            // Force a new canvas frame through duplicate-frame suppression on still images.
            ctx.fillStyle = (++capturedFrame % 2) ? "#101010" : "#202020";
            ctx.fillRect(0, 0, 2, 2);
            captureTrack?.requestFrame?.();
          }
          lastFrame = index;
        }
        if (time < duration()) frame = requestAnimationFrame(tick);
        else {
          stop();
          onComplete?.();
        }
      }
      tick(performance.now());
    }

    function refresh() {
      stop();
      time = Math.min(time, duration());
      scrub.max = String(duration());
      timeline.replaceChildren();
      let start = 0;
      scenes.forEach((scene, index) => {
        const at = start;
        start += scene.duration;
        const row = add("section", timeline);
        row.dir = "rtl";
        row.style.cssText = "min-width:225px;flex:none;border:1px solid #606070;border-radius:10px;padding:10px;overflow-wrap:anywhere";
        button(row, (index + 1) + " · " + at.toFixed(2) + " ث", () => seek(at));
        add("p", row, scene.name);
        const length = field(row, "المدة بالثواني", "number");
        Object.assign(length, { min: ".25", max: String(scene.max), step: "any", value: String(scene.duration) });
        length.onchange = () => {
          if (length.checkValidity() && length.value) scene.duration = length.valueAsNumber;
          refresh();
        };
        const title = field(row, "نص المشهد", "text");
        title.maxLength = 220;
        title.value = scene.title;
        title.oninput = () => { scene.title = title.value; draw(); };
        for (const [key, label, choices] of [
          ["animation", "حركة النص", [["none","ثابت"], ["fade","ظهور تدريجي"], ["rise","صعود تدريجي"]]],
          ["transition", "انتقال الدخول", [["cut","قطع"], ["fade","تلاشي"], ["slide","انزلاق"], ["zoom","تكبير"]]]
        ]) {
          const input = field(row, label, "", choices);
          input.value = scene[key];
          input.onchange = () => { scene[key] = input.value; draw(); };
        }
        for (const [direction, name] of [[-1, "تقديم"], [1, "تأخير"]]) {
          button(row, name, () => {
            [scenes[index], scenes[index + direction]] = [scenes[index + direction], scenes[index]];
            refresh();
          }).disabled = !scenes[index + direction];
        }
        button(row, "حذف", () => {
          scenes.splice(index, 1);
          disposeMedia(scene.media);
          refresh();
        });
      });
      syncMedia(false);
      draw();
    }

    function seek(at) {
      stop();
      time = at;
      syncMedia(false);
      draw();
    }

    async function upload(file) {
      const video = file.type.startsWith("video/");
      if (!video && !file.type.startsWith("image/")) throw new Error("الملف ليس صورة أو فيديو.");
      const media = document.createElement(video ? "video" : "img");
      const source = track(file);
      if (video) {
        media.preload = "auto";
        media.playsInline = true;
      }
      try {
        await loaded(media, video ? "loadeddata" : "load", source);
        controller.signal.throwIfAborted();
        if (video && (!Number.isFinite(media.duration) || media.duration < .25)) throw new Error("مقطع الفيديو قصير أو غير صالح.");
        if (video) media.onseeked = draw;
        scenes.push({ media, video, name: file.name, duration: video ? media.duration : 3,
          max: video ? media.duration : 600, title: "", transition: "cut", animation: "rise" });
      } catch (error) {
        disposeMedia(media);
        throw error;
      }
    }

    async function setVoice(blob, srt) {
      if (busy) throw new Error("انتظر اكتمال العملية الحالية في المحرر.");
      const timed = srt ? parseSrt(srt) : null;
      const next = new Audio();
      busy = true;
      try {
        await loaded(next, "loadedmetadata", track(blob));
        controller.signal.throwIfAborted();
        stop();
        if (narration) disposeMedia(narration);
        narration = next;
        if (timed) cues = timed;
        draw();
        status.textContent = "أضيف التعليق الصوتي إلى المعاينة والتصدير.";
      } catch (error) {
        disposeMedia(next);
        throw error;
      } finally {
        busy = false;
      }
    }

    function resize() {
      [canvas.width, canvas.height] = sizes[ratio.value];
      draw();
    }

    function record(recorder, signal, length) {
      return new Promise((resolve, reject) => {
        const chunks = [];
        const timeout = setTimeout(() => finish(new Error("انتهت مهلة ترميز الفيديو.")), length * 1000 + 15000);
        const abort = () => finish(signal.reason);
        function finish(error) {
          clearTimeout(timeout);
          signal.removeEventListener("abort", abort);
          recorder.ondataavailable = recorder.onerror = recorder.onstop = null;
          if (error) reject(error);
          else resolve(chunks);
        }
        signal.addEventListener("abort", abort, { once: true });
        recorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
        recorder.onerror = () => finish(new Error("أخفق مرمّز الفيديو."));
        recorder.onstop = () => finish();
        try {
          signal.throwIfAborted();
          recorder.start();
          // Some encoders emit "start" only after receiving the first canvas frame.
          run(true, () => {
            if (recorder.state === "recording") recorder.stop();
          }).catch(finish);
        } catch (error) {
          finish(error);
        }
      });
    }

    async function exportVideo(ext) {
      if (busy || !scenes.length) return report(new Error("أضف مشهداً وانتظر اكتمال تحميل الملفات."));
      busy = true;
      const job = new AbortController();
      exportController = job;
      panel.inert = true;
      stop();
      let videoStream;
      try {
        await audioGraph();
        job.signal.throwIfAborted();
        controller.signal.throwIfAborted();
        videoStream = canvas.captureStream(30);
        [captureTrack] = videoStream.getVideoTracks();
        capturedFrame = 0;
        const stream = new MediaStream([...videoStream.getTracks(), ...destination.stream.getAudioTracks()]);
        status.textContent = "جارٍ تسجيل الفيديو. أبقِ هذا التبويب مفتوحاً وفي المقدمة.";
        let blob;
        for (const mimeType of supported(ext)) {
          let recorder;
          try {
            seek(0);
            recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000, audioBitsPerSecond: 128000 });
            const chunks = await record(recorder, job.signal, duration());
            blob = new Blob(chunks, { type: "video/" + ext });
            const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
            const valid = ext === "mp4"
              ? String.fromCharCode(...header.slice(4, 8)) === "ftyp"
              : header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3;
            if (!valid || blob.size < 1024) throw new Error("لم ينتج المتصفح ملف فيديو صالحاً.");
            break;
          } catch (error) {
            blob = null;
            job.signal.throwIfAborted();
            status.textContent = error.message;
          } finally {
            stop();
            if (recorder && recorder.state !== "inactive") {
              try { recorder.stop(); } catch { /* The encoder may already have shut down. */ }
            }
          }
        }
        job.signal.throwIfAborted();
        if (!blob) throw new Error("تعذّر تصدير " + ext.toUpperCase() + " في هذا المتصفح.");
        const url = URL.createObjectURL(blob);
        const anchor = add("a", panel);
        anchor.href = url;
        anchor.download = "vexora-" + ratio.value + "." + ext;
        anchor.click();
        anchor.remove();
        // Keep the download URL alive even if the editor is closed immediately.
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        status.textContent = "تم تصدير " + ext.toUpperCase() + " بأبعاد " + canvas.width + " × " + canvas.height + ".";
      } catch (error) {
        report(error);
      } finally {
        videoStream?.getTracks().forEach(track => track.stop());
        captureTrack = null;
        if (panel.isConnected) draw();
        stop();
        if (monitor) monitor.gain.value = 1;
        exportController = null;
        busy = false;
        panel.inert = false;
      }
    }

    ratio.onchange = () => { stop(); resize(); };
    scrub.oninput = () => seek(scrub.valueAsNumber);
    referral.onchange = () => {
      try {
        link = referral.value = partnerLink(referral.value, partnerLinks);
        referralEdited = true;
        draw();
      }
      catch (error) { referral.value = link; report(error); }
    };
    files.onchange = async () => {
      if (busy) { files.value = ""; return; }
      busy = true;
      const failures = [];
      try {
        for (const file of files.files) {
          if (controller.signal.aborted) break;
          try { await upload(file); }
          catch (error) { failures.push(file.name + " — " + error.message); }
        }
        refresh();
        status.textContent = failures.join(" | ");
      } finally {
        busy = false;
        files.value = "";
      }
    };
    captions.onchange = async () => {
      const file = captions.files[0];
      if (!file) return;
      try {
        if (busy) throw new Error("انتظر اكتمال العملية الحالية في المحرر.");
        const next = parseSrt(await file.text());
        if (!busy) { cues = next; draw(); }
      } catch (error) { report(error); }
      finally { captions.value = ""; }
    };
    voiceFile.onchange = async () => {
      try { if (voiceFile.files[0]) await setVoice(voiceFile.files[0]); }
      catch (error) { report(error); }
      finally { voiceFile.value = ""; }
    };
    button(panel, "إزالة الترجمة", () => { cues = []; draw(); });
    button(panel, "إزالة التعليق الصوتي", () => {
      if (busy || !narration) return;
      disposeMedia(narration);
      narration = null;
    });
    function pauseWhenHidden() {
      if (!document.hidden && !panel.closest("[hidden]") && (options.active?.() ?? true)) return;
      exportController?.abort(new Error("أُلغي التصدير بعد مغادرة المعاينة."));
      stop();
    }
    const observer = new MutationObserver(() => {
      if (panel.isConnected) {
        pauseWhenHidden();
        return;
      }
      observer.disconnect();
      exportController?.abort(new Error("أُلغي التصدير بعد إغلاق الاستوديو."));
      controller.abort();
      stop();
      for (const scene of scenes) disposeMedia(scene.media);
      if (narration) disposeMedia(narration);
      for (const url of urls) release(url);
      destination?.stream.getTracks().forEach(track => track.stop());
      sound?.close().catch(() => {});
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    document.addEventListener("visibilitychange", pauseWhenHidden, { signal: controller.signal });
    loaded(new Image(), "load", "vexora-logo-full.png").then(image => {
      if (!controller.signal.aborted) { logo = image; draw(); }
    }).catch(() => {});
    Promise.resolve().then(() => options.partnerLinks?.()).then(values => {
      if (!values || controller.signal.aborted) return;
      partnerLinks = values;
      if (referralEdited || referral.value !== link || referral.matches(":focus")) return;
      link = referral.value = partnerLink(link, partnerLinks);
      draw();
    }).catch(() => {});
    resize();
    return { setVoice };
  }

  window.VexoraVideoStudio = { mount };
})();
