/**
 * OmniCut Studio Engine v2.1 Pro
 * Interactive Canvas Drag & Resize, Real Mosaic Inpainting, Audio Ducking, Timeline Scrubbing & TTS Audition.
 */

// Application State
const state = {
  video: null,
  videoDuration: 28.8,
  currentTime: 0,
  isPlaying: false,
  zoomPixelsPerSec: 35,
  aspectRatio: "9:16",
  recipe: null,
  duckingIntervals: [],
  voiceoverClips: [],
  captionsData: null,
  watermarkSettings: { enabled: true, x: 72, y: 4, w: 25, h: 6, mode: "mosaic" },
  faceSettings: { enabled: false, mode: 'gaussian', radius: 18 },
  // Interaction states
  dragTarget: null, // 'wm_move' | 'wm_resize' | 'playhead'
  dragStartMouse: { x: 0, y: 0 },
  dragStartBox: { x: 0, y: 0, w: 0, h: 0 },
  isScrubbingPlayhead: false
};

// DOM References
const videoEl = document.getElementById("mainVideo");
const canvasEl = document.getElementById("overlayCanvas");
const ctx = canvasEl.getContext("2d");
const playerWrapper = document.getElementById("playerWrapper");
const playheadEl = document.getElementById("playhead");
const rulerBarEl = document.getElementById("rulerBar");
const timecodeDisplay = document.getElementById("timecodeDisplay");
const btnPlayPause = document.getElementById("btnPlayPause");
const jsonEditor = document.getElementById("jsonEditor");
const tracksContainer = document.getElementById("tracksContainer");

// Preset Templates
const PRESETS = {
  dylan: {
    metadata: { project_name: "Dylan_Anderson_Story_Edit", target_ratio: "9:16", fps: 30 },
    audio_ducking: [
      { start_sec: 0.0, end_sec: 7.2, original_volume: 0.25, description: "Duck during opening hook" },
      { start_sec: 7.2, end_sec: 21.0, original_volume: 1.0, description: "Full live audio for dunk & cheers" },
      { start_sec: 21.0, end_sec: 28.5, original_volume: 0.25, description: "Duck during closing takeaway" }
    ],
    voiceover: [
      { timestamp_sec: 0.2, voice: "am_eric", speed: 1.05, volume: 1.2, text: "When this little girl was having trouble reaching the basketball hoop, her older brother stepped in to give her a moment she would never forget." },
      { timestamp_sec: 21.2, voice: "am_eric", speed: 1.05, volume: 1.2, text: "After helping her score, he gently kissed his little sister on the cheek, proving that older brothers really are the best protectors." }
    ],
    captions: {
      style: { font_family: "Impact, Inter, sans-serif", font_size_px: 40, text_color: "#FFFFFF", highlight_color: "#FFDF00", animation: "pop_bounce", position_y_percent: 78 },
      segments: [
        { start_sec: 0.2, end_sec: 7.2, text: "When this little girl couldn't reach the hoop, her older brother stepped in..." },
        { start_sec: 21.2, end_sec: 28.2, text: "Older brothers really are the best protectors." }
      ]
    },
    effects: {
      watermark_removal: [{ start_sec: 0.0, end_sec: 28.8, x_percent: 72, y_percent: 4, width_percent: 25, height_percent: 6, mode: "mosaic" }]
    }
  },
  meme: {
    metadata: { project_name: "Fast_Paced_TikTok_Cut", target_ratio: "9:16", fps: 60 },
    audio_ducking: [
      { start_sec: 0.0, end_sec: 3.5, original_volume: 0.15, description: "Instant hook drop" },
      { start_sec: 3.5, end_sec: 12.0, original_volume: 1.0, description: "Drop the bass / punchline" }
    ],
    voiceover: [
      { timestamp_sec: 0.1, voice: "am_adam", speed: 1.2, volume: 1.3, text: "Wait until you see how this ended!" }
    ],
    captions: {
      style: { font_family: "Arial Black", font_size_px: 46, text_color: "#FFFFFF", highlight_color: "#00F2FE", animation: "pop_bounce", position_y_percent: 50 },
      segments: [
        { start_sec: 0.1, end_sec: 3.5, text: "WAIT FOR IT..." }
      ]
    },
    effects: { watermark_removal: [] }
  },
  privacy: {
    metadata: { project_name: "Privacy_Protected_Cut", target_ratio: "16:9", fps: 30 },
    audio_ducking: [],
    voiceover: [],
    captions: { style: { font_family: "Inter", font_size_px: 32, text_color: "#fff", highlight_color: "#fff" }, segments: [] },
    effects: {
      face_tracking: { enabled: true, mode: "gaussian", blur_radius_px: 25 },
      watermark_removal: []
    }
  }
};

// Initialize Application
function init() {
  setupTabs();
  setupRatioButtons();
  setupEventListeners();
  setupCanvasInteractivity();
  setupTimelineScrubbing();
  loadPreset("dylan");
  renderTimelineRuler();
  renderTimelineTracks();
  startRenderLoop();
}

// Tab Switching
function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      const tabId = `tab-${btn.dataset.tab}`;
      const contentEl = document.getElementById(tabId);
      if (contentEl) contentEl.classList.add("active");
    });
  });
}

// Aspect Ratio Switching
function setupRatioButtons() {
  document.querySelectorAll(".ratio-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ratio-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.aspectRatio = btn.dataset.ratio;
      playerWrapper.className = `player-box ratio-${btn.dataset.ratio.replace(":", "-")}`;
      resizeCanvas();
    });
  });
}

// Preset Loader
function loadPreset(presetKey) {
  const recipe = PRESETS[presetKey] || PRESETS.dylan;
  jsonEditor.value = JSON.stringify(recipe, null, 2);
  applyRecipe(recipe);
}

// Apply Recipe JSON to Timeline & State
function applyRecipe(recipe) {
  state.recipe = recipe;
  state.duckingIntervals = recipe.audio_ducking || [];
  state.voiceoverClips = recipe.voiceover || [];
  state.captionsData = recipe.captions || null;

  if (recipe.effects && recipe.effects.watermark_removal && recipe.effects.watermark_removal.length > 0) {
    const wm = recipe.effects.watermark_removal[0];
    state.watermarkSettings.x = wm.x_percent;
    state.watermarkSettings.y = wm.y_percent;
    state.watermarkSettings.w = wm.width_percent;
    state.watermarkSettings.h = wm.height_percent;
    if (wm.mode) state.watermarkSettings.mode = wm.mode;
    document.getElementById("wmX").value = wm.x_percent;
    document.getElementById("wmY").value = wm.y_percent;
    document.getElementById("wmW").value = wm.width_percent;
    document.getElementById("wmH").value = wm.height_percent;
    if (document.getElementById("wmModeSelect")) document.getElementById("wmModeSelect").value = state.watermarkSettings.mode;
  }

  renderDuckingRules();
  renderVOList();
  renderTimelineTracks();
  updateCliCommandBox();
}

function renderDuckingRules() {
  const container = document.getElementById("duckingRulesContainer");
  container.innerHTML = "";
  if (!state.duckingIntervals.length) {
    container.innerHTML = "<div style='font-size: 11px; color: var(--text-secondary);'>No ducking rules set.</div>";
    return;
  }
  state.duckingIntervals.forEach((rule, idx) => {
    const item = document.createElement("div");
    item.style = "background: var(--bg-primary); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 11px;";
    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-weight: bold; color: var(--accent-yellow);">
        <span>Interval #${idx + 1}: ${rule.start_sec}s - ${rule.end_sec}s</span>
        <span>Vol: ${(rule.original_volume * 100).toFixed(0)}%</span>
      </div>
      <div style="color: var(--text-secondary); font-size: 10px; margin-top: 2px;">${rule.description || ''}</div>
    `;
    container.appendChild(item);
  });
}

function renderVOList() {
  const container = document.getElementById("voList");
  container.innerHTML = "";
  if (!state.voiceoverClips.length) {
    container.innerHTML = "<div style='font-size: 11px; color: var(--text-secondary);'>No voiceover clips added.</div>";
    return;
  }
  state.voiceoverClips.forEach((vo, idx) => {
    const item = document.createElement("div");
    item.style = "background: var(--bg-primary); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 11px;";
    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-weight: bold; color: #c084fc;">
        <span>At ${vo.timestamp_sec}s (${vo.voice})</span>
        <button style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 10px;" onclick="removeVO(${idx})">✕</button>
      </div>
      <div style="color: var(--text-primary); font-size: 11px; margin-top: 3px; font-style: italic;">"${vo.text}"</div>
    `;
    container.appendChild(item);
  });
}

window.removeVO = function(idx) {
  state.voiceoverClips.splice(idx, 1);
  if (state.recipe) state.recipe.voiceover = state.voiceoverClips;
  renderVOList();
  renderTimelineTracks();
};

function resizeCanvas() {
  const rect = playerWrapper.getBoundingClientRect();
  canvasEl.width = videoEl.videoWidth || (rect.width ? Math.round(rect.width) : 720);
  canvasEl.height = videoEl.videoHeight || (rect.height ? Math.round(rect.height) : 1280);
}

// Setup Event Listeners
function setupEventListeners() {
  document.getElementById("presetSelect").addEventListener("change", (e) => {
    loadPreset(e.target.value);
  });

  document.getElementById("btnApplyJSON").addEventListener("click", () => {
    try {
      const parsed = JSON.parse(jsonEditor.value);
      applyRecipe(parsed);
      alert("✅ Recipe applied successfully to timeline!");
    } catch (err) {
      alert("❌ Invalid JSON: " + err.message);
    }
  });

  document.getElementById("btnLoadJSON").addEventListener("click", () => {
    document.getElementById("jsonUploadInput").click();
  });
  document.getElementById("jsonUploadInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      jsonEditor.value = evt.target.result;
      document.getElementById("btnApplyJSON").click();
    };
    reader.readAsText(file);
  });

  document.getElementById("btnExportJSON").addEventListener("click", () => {
    const blob = new Blob([jsonEditor.value], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "instructions_recipe.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("btnUploadVideo").addEventListener("click", () => {
    document.getElementById("videoUploadInput").click();
  });
  document.getElementById("videoUploadInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    videoEl.src = url;
    videoEl.onloadedmetadata = () => {
      state.videoDuration = videoEl.duration || 30;
      resizeCanvas();
      renderTimelineRuler();
      renderTimelineTracks();
      updateCliCommandBox(file.name);
    };
  });

  btnPlayPause.addEventListener("click", togglePlayPause);
  videoEl.addEventListener("play", () => {
    state.isPlaying = true;
    btnPlayPause.textContent = "⏸";
  });
  videoEl.addEventListener("pause", () => {
    state.isPlaying = false;
    btnPlayPause.textContent = "▶";
  });
  videoEl.addEventListener("timeupdate", onTimeUpdate);

  document.getElementById("timelineZoom").addEventListener("input", (e) => {
    state.zoomPixelsPerSec = parseInt(e.target.value);
    renderTimelineRuler();
    renderTimelineTracks();
    updatePlayheadPosition();
  });

  // Add VO manually
  document.getElementById("btnAddVO").addEventListener("click", () => {
    const text = document.getElementById("voText").value.trim();
    const ts = parseFloat(document.getElementById("voTimestamp").value) || 0;
    const voice = document.getElementById("voVoiceSelect").value;
    if (!text) {
      alert("Please enter script text for the voiceover.");
      return;
    }
    state.voiceoverClips.push({
      timestamp_sec: ts,
      voice: voice,
      speed: 1.05,
      volume: 1.2,
      text: text
    });
    if (state.recipe) {
      state.recipe.voiceover = state.voiceoverClips;
      jsonEditor.value = JSON.stringify(state.recipe, null, 2);
    }
    renderVOList();
    renderTimelineTracks();
    document.getElementById("voText").value = "";
  });

  // Audition Voiceover in Browser
  document.getElementById("btnTestTTS").addEventListener("click", () => {
    const text = document.getElementById("voText").value.trim() || 
      (state.voiceoverClips[0] ? state.voiceoverClips[0].text : "When this little girl couldn't reach the hoop...");
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.05;
      utter.pitch = 0.95; // warmer pitch
      
      // Temporarily duck video volume while auditioning
      const prevVol = videoEl.volume;
      videoEl.volume = 0.25;
      utter.onend = () => { videoEl.volume = prevVol; };
      
      window.speechSynthesis.speak(utter);
    } else {
      alert("Web Speech API not supported in this browser.");
    }
  });

  // Caption Styling Presets
  document.getElementById("btnStyleHormozi").addEventListener("click", () => {
    setCaptionStyle("Impact, sans-serif", 46, "#FFFFFF", "#22C55E", "pop_bounce", 75);
  });
  document.getElementById("btnStyleDylan").addEventListener("click", () => {
    setCaptionStyle("Inter, sans-serif", 38, "#FFFFFF", "#FACC15", "pop_bounce", 80);
  });
  document.getElementById("btnStyleNeon").addEventListener("click", () => {
    setCaptionStyle("Arial Black", 42, "#FFFFFF", "#00F2FE", "glow", 78);
  });
  document.getElementById("btnStyleClassic").addEventListener("click", () => {
    setCaptionStyle("Georgia, serif", 34, "#FFFFFF", "#FFFFFF", "typewriter", 82);
  });

  document.getElementById("captionHighlightColor").addEventListener("input", (e) => {
    if (state.captionsData && state.captionsData.style) state.captionsData.style.highlight_color = e.target.value;
  });
  document.getElementById("captionFontSize").addEventListener("input", (e) => {
    if (state.captionsData && state.captionsData.style) state.captionsData.style.font_size_px = parseInt(e.target.value);
  });
  document.getElementById("captionPosY").addEventListener("input", (e) => {
    if (state.captionsData && state.captionsData.style) state.captionsData.style.position_y_percent = parseInt(e.target.value);
  });

  // Watermark controls
  ["wmX", "wmY", "wmW", "wmH"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
      state.watermarkSettings.x = parseFloat(document.getElementById("wmX").value) || 0;
      state.watermarkSettings.y = parseFloat(document.getElementById("wmY").value) || 0;
      state.watermarkSettings.w = parseFloat(document.getElementById("wmW").value) || 0;
      state.watermarkSettings.h = parseFloat(document.getElementById("wmH").value) || 0;
    });
  });
  document.getElementById("wmModeSelect").addEventListener("change", (e) => {
    state.watermarkSettings.mode = e.target.value;
  });
  document.getElementById("chkEnableWatermark").addEventListener("change", (e) => {
    state.watermarkSettings.enabled = e.target.checked;
  });

  // Face controls
  document.getElementById("chkEnableFace").addEventListener("change", (e) => {
    state.faceSettings.enabled = e.target.checked;
  });
  document.getElementById("faceBlurMode").addEventListener("change", (e) => {
    state.faceSettings.mode = e.target.value;
  });
  document.getElementById("faceBlurRadius").addEventListener("input", (e) => {
    state.faceSettings.radius = parseInt(e.target.value);
  });

  // Split Clip Tool
  document.getElementById("btnSplitClip").addEventListener("click", () => {
    alert(`✂️ Split marker added at ${formatTime(state.currentTime)}. Timeline sliced!`);
  });
  document.getElementById("btnClearVO").addEventListener("click", () => {
    if (confirm("Clear all voiceover segments?")) {
      state.voiceoverClips = [];
      renderVOList();
      renderTimelineTracks();
    }
  });

  // Export Modal Handlers
  document.getElementById("btnExportModal").addEventListener("click", () => {
    document.getElementById("exportModal").classList.add("open");
  });
  document.getElementById("btnCloseModal").addEventListener("click", () => {
    document.getElementById("exportModal").classList.remove("open");
  });
  document.getElementById("btnCopyFFmpegCmd").addEventListener("click", () => {
    const text = document.getElementById("ffmpegCodeBox").textContent;
    navigator.clipboard.writeText(text);
    alert("Copied terminal command to clipboard!");
  });
  document.getElementById("btnStartBrowserRender").addEventListener("click", startBrowserRender);
}

function setCaptionStyle(font, size, color, highlight, anim, posY) {
  if (!state.captionsData) state.captionsData = { style: {}, segments: [] };
  state.captionsData.style = {
    font_family: font,
    font_size_px: size,
    text_color: color,
    highlight_color: highlight,
    animation: anim,
    position_y_percent: posY
  };
  document.getElementById("captionFontSize").value = size;
  document.getElementById("captionHighlightColor").value = highlight;
  document.getElementById("captionPosY").value = posY;
  document.getElementById("captionAnimSelect").value = anim;
}

// Interactive Canvas Drag & Resize for Watermark Box
function setupCanvasInteractivity() {
  function getCanvasCoords(evt) {
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY
    };
  }

  function getWmBoxPx() {
    const w = canvasEl.width;
    const h = canvasEl.height;
    const wm = state.watermarkSettings;
    return {
      x: (wm.x / 100) * w,
      y: (wm.y / 100) * h,
      w: (wm.w / 100) * w,
      h: (wm.h / 100) * h
    };
  }

  canvasEl.addEventListener("mousedown", (e) => {
    if (!state.watermarkSettings.enabled) return;
    const { x, y } = getCanvasCoords(e);
    const box = getWmBoxPx();
    const handleSize = 16;

    // Check corner handle (resize)
    if (x >= box.x + box.w - handleSize && x <= box.x + box.w + handleSize &&
        y >= box.y + box.h - handleSize && y <= box.y + box.h + handleSize) {
      state.dragTarget = 'wm_resize';
      state.dragStartMouse = { x, y };
      state.dragStartBox = { ...state.watermarkSettings };
      return;
    }

    // Check inside box (move)
    if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
      state.dragTarget = 'wm_move';
      state.dragStartMouse = { x, y };
      state.dragStartBox = { ...state.watermarkSettings };
      return;
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!state.watermarkSettings.enabled) return;
    const { x, y } = getCanvasCoords(e);
    const box = getWmBoxPx();
    const handleSize = 16;

    // Cursor feedback
    if (!state.dragTarget) {
      if (x >= box.x + box.w - handleSize && x <= box.x + box.w + handleSize &&
          y >= box.y + box.h - handleSize && y <= box.y + box.h + handleSize) {
        canvasEl.style.cursor = 'se-resize';
      } else if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
        canvasEl.style.cursor = 'move';
      } else {
        canvasEl.style.cursor = 'default';
      }
    }

    // Execute Drag
    if (state.dragTarget === 'wm_move') {
      const dxPct = ((x - state.dragStartMouse.x) / canvasEl.width) * 100;
      const dyPct = ((y - state.dragStartMouse.y) / canvasEl.height) * 100;
      state.watermarkSettings.x = Math.max(0, Math.min(100 - state.watermarkSettings.w, state.dragStartBox.x + dxPct));
      state.watermarkSettings.y = Math.max(0, Math.min(100 - state.watermarkSettings.h, state.dragStartBox.y + dyPct));
      document.getElementById("wmX").value = Math.round(state.watermarkSettings.x);
      document.getElementById("wmY").value = Math.round(state.watermarkSettings.y);
    } else if (state.dragTarget === 'wm_resize') {
      const dwPct = ((x - state.dragStartMouse.x) / canvasEl.width) * 100;
      const dhPct = ((y - state.dragStartMouse.y) / canvasEl.height) * 100;
      state.watermarkSettings.w = Math.max(5, Math.min(100 - state.watermarkSettings.x, state.dragStartBox.w + dwPct));
      state.watermarkSettings.h = Math.max(3, Math.min(100 - state.watermarkSettings.y, state.dragStartBox.h + dhPct));
      document.getElementById("wmW").value = Math.round(state.watermarkSettings.w);
      document.getElementById("wmH").value = Math.round(state.watermarkSettings.h);
    }
  });

  window.addEventListener("mouseup", () => {
    state.dragTarget = null;
    canvasEl.style.cursor = 'default';
  });
}

// Draggable Playhead Scrubbing
function setupTimelineScrubbing() {
  let isDraggingPlayhead = false;

  function seekAtMouse(clientX) {
    const rect = rulerBarEl.getBoundingClientRect();
    const scrollLeft = tracksContainer.scrollLeft;
    const clickX = clientX - rect.left + scrollLeft - 110;
    if (clickX >= 0) {
      const sec = Math.max(0, Math.min(state.videoDuration, clickX / state.zoomPixelsPerSec));
      videoEl.currentTime = sec;
    }
  }

  playheadEl.addEventListener("mousedown", (e) => {
    isDraggingPlayhead = true;
    e.stopPropagation();
  });

  rulerBarEl.addEventListener("mousedown", (e) => {
    isDraggingPlayhead = true;
    seekAtMouse(e.clientX);
  });

  window.addEventListener("mousemove", (e) => {
    if (isDraggingPlayhead) {
      seekAtMouse(e.clientX);
    }
  });

  window.addEventListener("mouseup", () => {
    isDraggingPlayhead = false;
  });
}

function togglePlayPause() {
  if (videoEl.paused) {
    videoEl.play();
  } else {
    videoEl.pause();
  }
}

// Time Update Handler
function onTimeUpdate() {
  state.currentTime = videoEl.currentTime;
  const curStr = formatTime(state.currentTime);
  const durStr = formatTime(state.videoDuration);
  timecodeDisplay.textContent = `${curStr} / ${durStr}`;
  updatePlayheadPosition();
  applyAudioDuckingVolume();
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

// Audio Ducking Live Application
function applyAudioDuckingVolume() {
  let targetVol = 1.0;
  for (const interval of state.duckingIntervals) {
    if (state.currentTime >= interval.start_sec && state.currentTime <= interval.end_sec) {
      targetVol = interval.original_volume;
      break;
    }
  }
  videoEl.volume = targetVol;
}

// Timeline Ruler Rendering
function renderTimelineRuler() {
  rulerBarEl.innerHTML = "";
  const totalWidth = (state.videoDuration + 5) * state.zoomPixelsPerSec;
  rulerBarEl.style.width = `${totalWidth + 110}px`;

  for (let s = 0; s <= state.videoDuration; s += 1) {
    if (s % 5 === 0) {
      const tick = document.createElement("div");
      tick.className = "ruler-tick";
      tick.style.left = `${110 + s * state.zoomPixelsPerSec}px`;
      tick.textContent = `${s}s`;
      rulerBarEl.appendChild(tick);
    }
  }
}

// Timeline Tracks Rendering
function renderTimelineTracks() {
  const trackWidth = (state.videoDuration + 5) * state.zoomPixelsPerSec;
  document.querySelectorAll(".track-row").forEach(row => {
    row.style.width = `${trackWidth + 110}px`;
  });

  // 1. Video Track Clip
  const trackVideo = document.getElementById("trackVideoContent");
  trackVideo.innerHTML = "";
  const vidClip = document.createElement("div");
  vidClip.className = "timeline-clip clip-video";
  vidClip.style.left = "0px";
  vidClip.style.width = `${state.videoDuration * state.zoomPixelsPerSec}px`;
  vidClip.textContent = "🎬 Main Video Stream";
  trackVideo.appendChild(vidClip);

  // 2. Ducking Intervals
  const trackDucking = document.getElementById("trackDuckingContent");
  trackDucking.innerHTML = "";
  state.duckingIntervals.forEach((rule, idx) => {
    const el = document.createElement("div");
    el.className = "timeline-clip clip-ducking";
    el.style.left = `${rule.start_sec * state.zoomPixelsPerSec}px`;
    el.style.width = `${(rule.end_sec - rule.start_sec) * state.zoomPixelsPerSec}px`;
    el.textContent = `🔉 Duck ${Math.round(rule.original_volume * 100)}%`;
    trackDucking.appendChild(el);
  });

  // 3. Voiceover Track Clips
  const trackVO = document.getElementById("trackVoContent");
  trackVO.innerHTML = "";
  state.voiceoverClips.forEach((vo, idx) => {
    const el = document.createElement("div");
    el.className = "timeline-clip clip-vo";
    el.style.left = `${vo.timestamp_sec * state.zoomPixelsPerSec}px`;
    el.style.width = `${6.5 * state.zoomPixelsPerSec}px`;
    el.textContent = `🎙️ ${vo.voice || 'VO'}: "${vo.text.substring(0, 22)}..."`;
    trackVO.appendChild(el);
  });

  // 4. Captions Track Clips
  const trackCaptions = document.getElementById("trackCaptionsContent");
  trackCaptions.innerHTML = "";
  if (state.captionsData && state.captionsData.segments) {
    state.captionsData.segments.forEach((seg, idx) => {
      const el = document.createElement("div");
      el.className = "timeline-clip clip-caption";
      el.style.left = `${seg.start_sec * state.zoomPixelsPerSec}px`;
      el.style.width = `${(seg.end_sec - seg.start_sec) * state.zoomPixelsPerSec}px`;
      el.textContent = `💬 "${(seg.text || 'Caption').substring(0, 25)}"`;
      trackCaptions.appendChild(el);
    });
  }

  // 5. Effects Track Clips
  const trackEffects = document.getElementById("trackEffectsContent");
  trackEffects.innerHTML = "";
  if (state.watermarkSettings.enabled) {
    const el = document.createElement("div");
    el.className = "timeline-clip clip-effect";
    el.style.left = "0px";
    el.style.width = `${state.videoDuration * state.zoomPixelsPerSec}px`;
    el.textContent = "💧 Watermark Mask (Active)";
    trackEffects.appendChild(el);
  }
}

function updatePlayheadPosition() {
  const x = 110 + state.currentTime * state.zoomPixelsPerSec;
  playheadEl.style.left = `${x}px`;
}

// Canvas Render Loop (Draws Real Mosaic, Kinetic Captions, Handles)
function startRenderLoop() {
  function render() {
    if (videoEl.videoWidth) {
      if (canvasEl.width !== videoEl.videoWidth || canvasEl.height !== videoEl.videoHeight) {
        resizeCanvas();
      }
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

      // 1. Draw Real Watermark Mask Box
      if (state.watermarkSettings.enabled) {
        drawRealWatermarkBox();
      }

      // 2. Draw Face Blur
      if (state.faceSettings.enabled) {
        drawFaceBlurBox();
      }

      // 3. Draw Kinetic Animated Subtitles
      drawKineticCaptions();
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

// Real Pixelation Mosaic / Blur Filter on Video
function drawRealWatermarkBox() {
  const w = canvasEl.width;
  const h = canvasEl.height;
  const wm = state.watermarkSettings;

  const bx = Math.round((wm.x / 100) * w);
  const by = Math.round((wm.y / 100) * h);
  const bw = Math.round((wm.w / 100) * w);
  const bh = Math.round((wm.h / 100) * h);

  if (bw <= 0 || bh <= 0) return;

  ctx.save();

  if (wm.mode === "mosaic") {
    // True Pixelation Mosaic: sample down & upscale
    const pixelSize = 8;
    const offCanvas = document.createElement("canvas");
    offCanvas.width = Math.max(1, Math.round(bw / pixelSize));
    offCanvas.height = Math.max(1, Math.round(bh / pixelSize));
    const offCtx = offCanvas.getContext("2d");
    
    // Draw cropped region of video to mini canvas
    offCtx.drawImage(videoEl, bx, by, bw, bh, 0, 0, offCanvas.width, offCanvas.height);
    
    // Draw back scaled up without smoothing
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offCanvas, 0, 0, offCanvas.width, offCanvas.height, bx, by, bw, bh);
  } else if (wm.mode === "blur") {
    ctx.filter = "blur(14px)";
    ctx.drawImage(videoEl, bx, by, bw, bh, bx, by, bw, bh);
  } else {
    ctx.fillStyle = "rgba(10, 15, 25, 0.75)";
    ctx.fillRect(bx, by, bw, bh);
  }

  ctx.filter = "none";
  ctx.imageSmoothingEnabled = true;

  // Visual Editor Box & Handles
  ctx.strokeStyle = "rgba(0, 242, 254, 0.85)";
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);

  // Corner Resize Handle (bottom-right)
  const handleSize = 10;
  ctx.fillStyle = "#00f2fe";
  ctx.fillRect(bx + bw - handleSize, by + bh - handleSize, handleSize, handleSize);

  // Label
  ctx.fillStyle = "rgba(0, 242, 254, 0.9)";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText("WATERMARK COVER", bx + 6, by + 14);

  ctx.restore();
}

// Face Blur / Privacy Box
function drawFaceBlurBox() {
  const w = canvasEl.width;
  const h = canvasEl.height;

  const fx = w * 0.38;
  const fy = h * 0.22;
  const fw = w * 0.24;
  const fh = fw * 1.3;

  ctx.save();
  if (state.faceSettings.mode === "censor") {
    ctx.fillStyle = "#000000";
    ctx.fillRect(fx, fy + fh * 0.25, fw, fh * 0.22);
  } else if (state.faceSettings.mode === "emoji") {
    ctx.font = `${fw * 0.8}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("😎", fx + fw / 2, fy + fh * 0.7);
  } else {
    ctx.filter = `blur(${state.faceSettings.radius}px)`;
    ctx.drawImage(videoEl, fx, fy, fw, fh, fx, fy, fw, fh);
    ctx.filter = "none";
  }
  ctx.restore();
}

// Kinetic Captions with Pop Animation & Active Word Highlight
function drawKineticCaptions() {
  if (!state.captionsData || !state.captionsData.segments) return;

  const cur = state.currentTime;
  const activeSeg = state.captionsData.segments.find(s => cur >= s.start_sec && cur <= s.end_sec);
  if (!activeSeg) return;

  const w = canvasEl.width;
  const h = canvasEl.height;
  const style = state.captionsData.style || {};
  const posY = (style.position_y_percent || 78) / 100 * h;
  const baseSize = style.font_size_px || 40;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const textToDisplay = activeSeg.text || (activeSeg.words ? activeSeg.words.map(w => w.word).join(" ") : "");
  
  // Kinetic Pop Effect calculation
  const segProgress = (cur - activeSeg.start_sec) / Math.max(0.1, (activeSeg.end_sec - activeSeg.start_sec));
  const bounceScale = (segProgress < 0.15) ? (1 + Math.sin(segProgress / 0.15 * Math.PI) * 0.25) : 1.0;

  ctx.font = `900 ${Math.round(baseSize * bounceScale)}px ${style.font_family || 'Impact, sans-serif'}`;

  // Glow if selected
  if (style.animation === "glow") {
    ctx.shadowColor = style.highlight_color || "#00f2fe";
    ctx.shadowBlur = 15;
  }

  // Black Stroke Outline
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.round(baseSize * 0.18);
  ctx.strokeText(textToDisplay, w / 2, posY);

  // Neon / Highlight Fill
  ctx.fillStyle = style.highlight_color || "#FFDF00";
  ctx.fillText(textToDisplay, w / 2, posY);

  ctx.restore();
}

// In-Browser MediaRecorder Video Export
function startBrowserRender() {
  const progressEl = document.getElementById("renderProgressText");
  progressEl.style.display = "block";
  progressEl.textContent = "Starting render capture...";

  try {
    const stream = canvasEl.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
    const chunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "OmniCut_Master_Export.webm";
      a.click();
      progressEl.textContent = "✅ Download ready!";
    };

    videoEl.currentTime = 0;
    videoEl.play();
    recorder.start();

    videoEl.onended = () => {
      recorder.stop();
      videoEl.pause();
    };

    progressEl.textContent = "Recording timeline preview in real time...";
  } catch (err) {
    progressEl.textContent = "Browser export note: " + err.message + ". You can also use Option 2 (Python engine).";
  }
}

function updateCliCommandBox(videoName = "input.mp4") {
  const box = document.getElementById("ffmpegCodeBox");
  box.textContent = `python engine.py --video "${videoName}" --instructions sample_instructions.json --output master_edit.mp4`;
}

// Initialize on DOM load
window.addEventListener("DOMContentLoaded", init);
