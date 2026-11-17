/**
 * OmniCut Studio Engine v2.1 Pro
 * Clean State, Instruction-Based Workflow, Interactive Canvas Drag & Resize,
 * Real Mosaic Inpainting, Audio Ducking, Timeline Scrubbing & TTS Audition.
 */

// Starter Instruction Schema Template
const STARTER_SCHEMA = {
  metadata: {
    project_name: "My_Story_Edit",
    target_ratio: "9:16",
    fps: 30
  },
  voiceover: [
    {
      timestamp_sec: 0.5,
      voice: "am_eric",
      speed: 1.05,
      volume: 1.2,
      text: "When this little girl was having trouble reaching the basketball hoop, her older brother stepped in."
    },
    {
      timestamp_sec: 12.0,
      voice: "am_eric",
      speed: 1.05,
      volume: 1.2,
      text: "He lifted her up so she could make the winning shot, proving older brothers really are the best."
    }
  ],
  audio_ducking: [
    {
      start_sec: 0.0,
      end_sec: 6.5,
      original_volume: 0.25,
      description: "Duck background volume during opening commentary hook"
    },
    {
      start_sec: 6.5,
      end_sec: 11.5,
      original_volume: 1.0,
      description: "Full volume for cheering and crowd sound"
    },
    {
      start_sec: 11.5,
      end_sec: 18.0,
      original_volume: 0.25,
      description: "Duck background volume during closing commentary"
    }
  ],
  captions: {
    style: {
      font_family: "Impact, Inter, sans-serif",
      font_size_px: 42,
      text_color: "#FFFFFF",
      highlight_color: "#FFDF00",
      animation: "pop_bounce",
      position_y_percent: 78
    },
    segments: [
      {
        start_sec: 0.5,
        end_sec: 6.5,
        text: "When this little girl couldn't reach the hoop..."
      },
      {
        start_sec: 12.0,
        end_sec: 18.0,
        text: "Her older brother gave her a moment she'd never forget."
      }
    ]
  },
  effects: {
    watermark_removal: [
      {
        start_sec: 0.0,
        end_sec: 20.0,
        x_percent: 70,
        y_percent: 5,
        width_percent: 26,
        height_percent: 7,
        mode: "mosaic"
      }
    ],
    face_tracking: {
      enabled: false,
      mode: "gaussian",
      blur_radius_px: 20
    }
  }
};

// Application State (Completely clean on load)
const state = {
  video: null,
  videoFileName: "",
  videoDuration: 0,
  currentTime: 0,
  isPlaying: false,
  zoomPixelsPerSec: 35,
  aspectRatio: "9:16",
  recipe: null,
  duckingIntervals: [],
  voiceoverClips: [],
  captionsData: null,
  watermarkSettings: { enabled: false, x: 70, y: 5, w: 25, h: 8, mode: "mosaic" },
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
const emptyStagePrompt = document.getElementById("emptyStagePrompt");
const playheadEl = document.getElementById("playhead");
const rulerBarEl = document.getElementById("rulerBar");
const timecodeDisplay = document.getElementById("timecodeDisplay");
const btnPlayPause = document.getElementById("btnPlayPause");
const jsonEditor = document.getElementById("jsonEditor");
const tracksContainer = document.getElementById("tracksContainer");
const duckingPill = document.getElementById("duckingPill");

// Initialize Application Cleanly
function init() {
  setupTabs();
  setupRatioButtons();
  setupEventListeners();
  setupCanvasInteractivity();
  setupTimelineScrubbing();
  setupHelpModal();
  setupVideoDropZone();

  // Load starter schema into the JSON editor so the user has immediate syntax reference
  jsonEditor.value = JSON.stringify(STARTER_SCHEMA, null, 2);

  // Initial clean display
  timecodeDisplay.textContent = "00:00.0 / 00:00.0";
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
      setAspectRatio(btn.dataset.ratio);
    });
  });
}

function setAspectRatio(ratio) {
  state.aspectRatio = ratio;
  document.querySelectorAll(".ratio-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.ratio === ratio);
  });
  playerWrapper.className = `player-box ratio-${ratio.replace(":", "-")}`;
  resizeCanvas();
}

// Apply Recipe JSON to Timeline & State
function applyRecipe(recipe) {
  state.recipe = recipe;
  state.duckingIntervals = recipe.audio_ducking || [];
  state.voiceoverClips = recipe.voiceover || [];
  state.captionsData = recipe.captions || null;

  // Aspect ratio from metadata
  if (recipe.metadata && recipe.metadata.target_ratio) {
    setAspectRatio(recipe.metadata.target_ratio);
  }

  // Watermark removal
  if (recipe.effects && recipe.effects.watermark_removal && recipe.effects.watermark_removal.length > 0) {
    const wm = recipe.effects.watermark_removal[0];
    state.watermarkSettings.enabled = true;
    state.watermarkSettings.x = wm.x_percent ?? 70;
    state.watermarkSettings.y = wm.y_percent ?? 5;
    state.watermarkSettings.w = wm.width_percent ?? 25;
    state.watermarkSettings.h = wm.height_percent ?? 8;
    if (wm.mode) state.watermarkSettings.mode = wm.mode;

    const chkWm = document.getElementById("enableWatermark");
    if (chkWm) chkWm.checked = true;
    document.getElementById("wmX").value = state.watermarkSettings.x;
    document.getElementById("wmY").value = state.watermarkSettings.y;
    document.getElementById("wmW").value = state.watermarkSettings.w;
    document.getElementById("wmH").value = state.watermarkSettings.h;
    if (document.getElementById("wmModeSelect")) {
      document.getElementById("wmModeSelect").value = state.watermarkSettings.mode;
    }
  }

  // Face tracking blur
  if (recipe.effects && recipe.effects.face_tracking) {
    state.faceSettings.enabled = !!recipe.effects.face_tracking.enabled;
    const chkFace = document.getElementById("enableFace");
    if (chkFace) chkFace.checked = state.faceSettings.enabled;
    if (recipe.effects.face_tracking.mode && document.getElementById("faceModeSelect")) {
      document.getElementById("faceModeSelect").value = recipe.effects.face_tracking.mode;
      state.faceSettings.mode = recipe.effects.face_tracking.mode;
    }
  }

  // If no video is loaded yet, infer duration from the recipe so user can see timeline layout
  if (state.videoDuration === 0) {
    let maxSec = 10;
    state.duckingIntervals.forEach(d => { if (d.end_sec > maxSec) maxSec = d.end_sec; });
    state.voiceoverClips.forEach(v => { if ((v.timestamp_sec + 6.0) > maxSec) maxSec = v.timestamp_sec + 6.0; });
    if (state.captionsData && state.captionsData.segments) {
      state.captionsData.segments.forEach(c => { if (c.end_sec > maxSec) maxSec = c.end_sec; });
    }
    state.videoDuration = Math.ceil(maxSec);
    timecodeDisplay.textContent = `00:00.0 / ${formatTime(state.videoDuration)}`;
  }

  renderDuckingRules();
  renderVOList();
  renderTimelineRuler();
  renderTimelineTracks();
  updateCliCommandBox();
}

// Render Ducking Rules List in Inspector Tab
function renderDuckingRules() {
  const container = document.getElementById("duckingRulesList");
  if (!container) return;
  container.innerHTML = "";
  if (!state.duckingIntervals.length) {
    container.innerHTML = "<div style='font-size: 11px; color: var(--text-secondary); padding: 8px;'>No ducking intervals configured.</div>";
    return;
  }
  state.duckingIntervals.forEach((rule, idx) => {
    const item = document.createElement("div");
    item.style = "background: var(--bg-primary); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 11px; margin-bottom: 6px;";
    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-weight: bold; color: var(--accent-yellow);">
        <span>#${idx + 1}: ${rule.start_sec}s - ${rule.end_sec}s</span>
        <span>Vol: ${Math.round(rule.original_volume * 100)}%</span>
      </div>
      <div style="color: var(--text-secondary); font-size: 10px; margin-top: 2px;">${rule.description || 'Dynamic ducking interval'}</div>
    `;
    container.appendChild(item);
  });
}

// Render Voiceover Items List in Inspector Tab
function renderVOList() {
  const container = document.getElementById("voItemsList");
  if (!container) return;
  container.innerHTML = "";
  if (!state.voiceoverClips.length) {
    container.innerHTML = "<div style='font-size: 11px; color: var(--text-secondary); padding: 8px;'>No commentary cues added.</div>";
    return;
  }
  state.voiceoverClips.forEach((vo, idx) => {
    const item = document.createElement("div");
    item.style = "background: var(--bg-primary); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 11px; margin-bottom: 6px;";
    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-weight: bold; color: #c084fc;">
        <span>At ${vo.timestamp_sec}s (${vo.voice || 'am_eric'})</span>
        <button style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 11px;" onclick="removeVO(${idx})" title="Remove cue">✕</button>
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

// Video Loading Helper
function loadVideoFile(file) {
  if (!file) return;
  state.videoFileName = file.name;
  const url = URL.createObjectURL(file);
  videoEl.src = url;

  if (emptyStagePrompt) {
    emptyStagePrompt.style.display = "none";
  }

  videoEl.onloadedmetadata = () => {
    state.videoDuration = videoEl.duration || 30;
    state.currentTime = 0;
    timecodeDisplay.textContent = `00:00.0 / ${formatTime(state.videoDuration)}`;
    resizeCanvas();
    renderTimelineRuler();
    renderTimelineTracks();
    updateCliCommandBox(file.name);
  };
}

// Drag & Drop Setup for Player Stage
function setupVideoDropZone() {
  if (!playerWrapper) return;

  playerWrapper.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (emptyStagePrompt) emptyStagePrompt.classList.add("drag-over");
  });

  playerWrapper.addEventListener("dragleave", () => {
    if (emptyStagePrompt) emptyStagePrompt.classList.remove("drag-over");
  });

  playerWrapper.addEventListener("drop", (e) => {
    e.preventDefault();
    if (emptyStagePrompt) emptyStagePrompt.classList.remove("drag-over");
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadVideoFile(e.dataTransfer.files[0]);
    }
  });

  const btnStageUpload = document.getElementById("btnStageUpload");
  if (btnStageUpload) {
    btnStageUpload.addEventListener("click", () => {
      document.getElementById("videoUploadInput").click();
    });
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Execute Recipe Button
  document.getElementById("btnApplyJSON").addEventListener("click", () => {
    try {
      const parsed = JSON.parse(jsonEditor.value);
      applyRecipe(parsed);
      alert("✅ Recipe applied successfully to timeline!");
    } catch (err) {
      alert("❌ Invalid JSON format: " + err.message);
    }
  });

  // Load Starter Schema in Recipe Tab
  document.getElementById("btnLoadStarterTemplate").addEventListener("click", () => {
    jsonEditor.value = JSON.stringify(STARTER_SCHEMA, null, 2);
    applyRecipe(STARTER_SCHEMA);
  });

  // Clear Recipe
  document.getElementById("btnClearRecipe").addEventListener("click", () => {
    if (confirm("Reset current timeline recipe to empty?")) {
      state.recipe = null;
      state.duckingIntervals = [];
      state.voiceoverClips = [];
      state.captionsData = null;
      state.watermarkSettings.enabled = false;
      state.faceSettings.enabled = false;
      document.getElementById("enableWatermark").checked = false;
      document.getElementById("enableFace").checked = false;
      jsonEditor.value = "";
      renderDuckingRules();
      renderVOList();
      renderTimelineTracks();
    }
  });

  // Reset Recipe Button
  document.getElementById("btnResetJSON").addEventListener("click", () => {
    jsonEditor.value = JSON.stringify(STARTER_SCHEMA, null, 2);
  });

  // Import JSON File
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

  // Save / Export Recipe JSON
  document.getElementById("btnExportJSON").addEventListener("click", () => {
    const content = jsonEditor.value.trim() || JSON.stringify(STARTER_SCHEMA, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(state.recipe && state.recipe.metadata && state.recipe.metadata.project_name) || "instructions_recipe"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Load Video File Picker
  document.getElementById("btnUploadVideo").addEventListener("click", () => {
    document.getElementById("videoUploadInput").click();
  });
  document.getElementById("videoUploadInput").addEventListener("change", (e) => {
    loadVideoFile(e.target.files[0]);
  });

  // Video Transport & Controls
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

  document.getElementById("btnPrevFrame").addEventListener("click", () => {
    videoEl.currentTime = Math.max(0, videoEl.currentTime - 1 / 30);
  });
  document.getElementById("btnNextFrame").addEventListener("click", () => {
    videoEl.currentTime = Math.min(state.videoDuration, videoEl.currentTime + 1 / 30);
  });
  document.getElementById("btnMuteToggle").addEventListener("click", () => {
    videoEl.muted = !videoEl.muted;
    document.getElementById("btnMuteToggle").textContent = videoEl.muted ? "🔇" : "🔊";
  });

  // Timeline Zoom Controls
  document.getElementById("btnZoomIn").addEventListener("click", () => {
    state.zoomPixelsPerSec = Math.min(100, state.zoomPixelsPerSec + 10);
    document.getElementById("zoomLevelLabel").textContent = `${Math.round(state.zoomPixelsPerSec / 35 * 10) / 10}x`;
    renderTimelineRuler();
    renderTimelineTracks();
    updatePlayheadPosition();
  });
  document.getElementById("btnZoomOut").addEventListener("click", () => {
    state.zoomPixelsPerSec = Math.max(15, state.zoomPixelsPerSec - 10);
    document.getElementById("zoomLevelLabel").textContent = `${Math.round(state.zoomPixelsPerSec / 35 * 10) / 10}x`;
    renderTimelineRuler();
    renderTimelineTracks();
    updatePlayheadPosition();
  });

  // Add Voiceover Cue at Current Playhead
  document.getElementById("btnAddVOClip").addEventListener("click", () => {
    const text = document.getElementById("voScriptInput").value.trim();
    if (!text) {
      alert("Please enter a commentary script line to add.");
      return;
    }
    const voice = document.getElementById("voVoiceSelect").value;
    const speed = parseFloat(document.getElementById("voSpeedRange").value) || 1.05;
    const volume = parseFloat(document.getElementById("voVolumeRange").value) || 1.2;
    const curTs = Math.round(state.currentTime * 10) / 10;

    state.voiceoverClips.push({
      timestamp_sec: curTs,
      voice: voice,
      speed: speed,
      volume: volume,
      text: text
    });

    if (state.recipe) {
      state.recipe.voiceover = state.voiceoverClips;
      jsonEditor.value = JSON.stringify(state.recipe, null, 2);
    }
    renderVOList();
    renderTimelineTracks();
    document.getElementById("voScriptInput").value = "";
  });

  // Audition Voiceover in Browser with Audio Ducking
  document.getElementById("btnAuditionVO").addEventListener("click", () => {
    const text = document.getElementById("voScriptInput").value.trim() || 
      (state.voiceoverClips[0] ? state.voiceoverClips[0].text : "When this stranger saw what happened, he stepped in.");

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = parseFloat(document.getElementById("voSpeedRange").value) || 1.05;
      utter.pitch = 0.95; // warmer pitch for broadcaster feel

      // Duck background video audio while auditioning
      const prevVol = videoEl.volume;
      videoEl.volume = 0.25;
      if (duckingPill) {
        duckingPill.textContent = "25% (TTS Duck)";
        duckingPill.classList.add("active");
      }

      utter.onend = () => {
        videoEl.volume = prevVol;
        if (duckingPill) {
          duckingPill.textContent = `${Math.round(prevVol * 100)}% Vol`;
          duckingPill.classList.remove("active");
        }
      };
      utter.onerror = () => {
        videoEl.volume = prevVol;
      };

      window.speechSynthesis.speak(utter);
    } else {
      alert("In-browser Web Speech API is not supported in this browser. Use Option 2 for Kokoro TTS.");
    }
  });

  // Add Ducking Rule
  document.getElementById("btnAddDuckingRule").addEventListener("click", () => {
    const start = parseFloat(document.getElementById("duckStartSec").value) || 0;
    const end = parseFloat(document.getElementById("duckEndSec").value) || 5;
    const vol = parseFloat(document.getElementById("duckVolumeRange").value) || 0.25;

    state.duckingIntervals.push({
      start_sec: start,
      end_sec: end,
      original_volume: vol,
      description: `Manual ducking (${Math.round(vol * 100)}%)`
    });

    if (state.recipe) {
      state.recipe.audio_ducking = state.duckingIntervals;
      jsonEditor.value = JSON.stringify(state.recipe, null, 2);
    }
    renderDuckingRules();
    renderTimelineTracks();
  });

  // Sliders feedback labels
  document.getElementById("voSpeedRange").addEventListener("input", (e) => {
    document.getElementById("valVOSpeed").textContent = `${e.target.value}x`;
  });
  document.getElementById("voVolumeRange").addEventListener("input", (e) => {
    document.getElementById("valVOVolume").textContent = `${Math.round(e.target.value * 100)}%`;
  });
  document.getElementById("duckVolumeRange").addEventListener("input", (e) => {
    document.getElementById("valDuckVolume").textContent = `${Math.round(e.target.value * 100)}%`;
  });

  // Caption Preset Buttons
  document.getElementById("btnStyleHormozi").addEventListener("click", () => {
    setCaptionStyle("Impact, Inter, sans-serif", 46, "#FFFFFF", "#22C55E", "pop_bounce", 75);
  });
  document.getElementById("btnStyleDylan").addEventListener("click", () => {
    setCaptionStyle("Impact, Inter, sans-serif", 42, "#FFFFFF", "#FFDF00", "pop_bounce", 78);
  });
  document.getElementById("btnStyleCyanGlow").addEventListener("click", () => {
    setCaptionStyle("'Arial Black', sans-serif", 42, "#FFFFFF", "#00F2FE", "pop_bounce", 76);
  });
  document.getElementById("btnStyleClassic").addEventListener("click", () => {
    setCaptionStyle("Inter, sans-serif", 36, "#FFFFFF", "#E2E8F0", "fade_smooth", 80);
  });

  // Watermark Settings Handlers
  document.getElementById("enableWatermark").addEventListener("change", (e) => {
    state.watermarkSettings.enabled = e.target.checked;
    renderTimelineTracks();
  });
  document.getElementById("wmModeSelect").addEventListener("change", (e) => {
    state.watermarkSettings.mode = e.target.value;
  });
  ["wmX", "wmY", "wmW", "wmH"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
      state.watermarkSettings.x = parseFloat(document.getElementById("wmX").value) || 0;
      state.watermarkSettings.y = parseFloat(document.getElementById("wmY").value) || 0;
      state.watermarkSettings.w = parseFloat(document.getElementById("wmW").value) || 0;
      state.watermarkSettings.h = parseFloat(document.getElementById("wmH").value) || 0;
    });
  });

  // Face Settings Handlers
  document.getElementById("enableFace").addEventListener("change", (e) => {
    state.faceSettings.enabled = e.target.checked;
  });
  document.getElementById("faceModeSelect").addEventListener("change", (e) => {
    state.faceSettings.mode = e.target.value;
  });
  document.getElementById("faceRadiusRange").addEventListener("input", (e) => {
    state.faceSettings.radius = parseInt(e.target.value);
  });

  // Split Clip Tool
  document.getElementById("btnTimelineSplit").addEventListener("click", () => {
    alert(`✂️ Split marker placed at ${formatTime(state.currentTime)}.`);
  });
  document.getElementById("btnClearVO").addEventListener("click", () => {
    if (confirm("Clear all voiceover clips?")) {
      state.voiceoverClips = [];
      if (state.recipe) state.recipe.voiceover = [];
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
    alert("✅ Copied CLI command to clipboard!");
  });
  document.getElementById("btnStartBrowserRender").addEventListener("click", startBrowserRender);
}

// Setup Help Modal
function setupHelpModal() {
  const modal = document.getElementById("instructionHelpModal");
  const openModal = () => modal.classList.add("open");
  const closeModal = () => modal.classList.remove("open");

  document.getElementById("btnHelpModal").addEventListener("click", openModal);
  const btnHelpFromTab = document.getElementById("btnHelpFromTab");
  if (btnHelpFromTab) btnHelpFromTab.addEventListener("click", openModal);

  document.getElementById("btnCloseHelpModal").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
  });

  // Copy Help JSON Template
  document.getElementById("btnCopyHelpJSON").addEventListener("click", () => {
    const code = document.getElementById("helpJsonSampleBlock").textContent;
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.getElementById("btnCopyHelpJSON");
      const orig = btn.innerHTML;
      btn.innerHTML = "<span>✅ Copied!</span>";
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    });
  });

  // Insert Template into Editor
  document.getElementById("btnInsertTemplateToEditor").addEventListener("click", () => {
    jsonEditor.value = JSON.stringify(STARTER_SCHEMA, null, 2);
    applyRecipe(STARTER_SCHEMA);
    closeModal();
    // Switch to Recipe tab
    const recipeTabBtn = document.querySelector(".tab-btn[data-tab='instructions']");
    if (recipeTabBtn) recipeTabBtn.click();
  });
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
  document.getElementById("captionFontSelect").value = font;
  document.getElementById("captionFontSize").value = size;
  document.getElementById("captionTextColor").value = color;
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

    // Corner handle (resize)
    if (x >= box.x + box.w - handleSize && x <= box.x + box.w + handleSize &&
        y >= box.y + box.h - handleSize && y <= box.y + box.h + handleSize) {
      state.dragTarget = 'wm_resize';
      state.dragStartMouse = { x, y };
      state.dragStartBox = { ...state.watermarkSettings };
      return;
    }

    // Inside box (move)
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
    if (state.videoDuration <= 0) return;
    const rect = rulerBarEl.getBoundingClientRect();
    const scrollLeft = tracksContainer.scrollLeft;
    const clickX = clientX - rect.left + scrollLeft - 110;
    if (clickX >= 0) {
      const sec = Math.max(0, Math.min(state.videoDuration, clickX / state.zoomPixelsPerSec));
      videoEl.currentTime = sec;
      state.currentTime = sec;
      updatePlayheadPosition();
      timecodeDisplay.textContent = `${formatTime(state.currentTime)} / ${formatTime(state.videoDuration)}`;
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
  if (state.videoDuration <= 0) {
    document.getElementById("videoUploadInput").click();
    return;
  }
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

  const curSecLabel = document.getElementById("btnVOCurTime");
  if (curSecLabel) curSecLabel.textContent = `${(Math.round(state.currentTime * 10) / 10).toFixed(1)}s`;
}

function formatTime(sec) {
  if (!sec || isNaN(sec) || sec <= 0) return "00:00.0";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
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
  if (duckingPill) {
    duckingPill.textContent = `${Math.round(targetVol * 100)}% Vol`;
    duckingPill.classList.toggle("active", targetVol < 0.95);
  }
}

// Timeline Ruler Rendering
function renderTimelineRuler() {
  rulerBarEl.innerHTML = "";
  const duration = Math.max(state.videoDuration, 10);
  const totalWidth = (duration + 5) * state.zoomPixelsPerSec;
  rulerBarEl.style.width = `${totalWidth + 110}px`;

  for (let s = 0; s <= duration; s += 1) {
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
  const duration = Math.max(state.videoDuration, 10);
  const trackWidth = (duration + 5) * state.zoomPixelsPerSec;
  document.querySelectorAll(".track-row").forEach(row => {
    row.style.width = `${trackWidth + 110}px`;
  });

  // 1. Video Track Clip
  const trackVideo = document.getElementById("trackVideoContent");
  trackVideo.innerHTML = "";
  if (state.videoDuration > 0) {
    const vidClip = document.createElement("div");
    vidClip.className = "timeline-clip clip-video";
    vidClip.style.left = "0px";
    vidClip.style.width = `${state.videoDuration * state.zoomPixelsPerSec}px`;
    vidClip.textContent = state.videoFileName ? `🎬 ${state.videoFileName}` : "🎬 Main Video Stream";
    trackVideo.appendChild(vidClip);
  } else {
    trackVideo.innerHTML = '<span class="empty-track-placeholder">No video loaded. Click "Load Video" or drop a video above.</span>';
  }

  // 2. Ducking Intervals
  const trackDucking = document.getElementById("trackDuckingContent");
  trackDucking.innerHTML = "";
  if (state.duckingIntervals.length > 0) {
    state.duckingIntervals.forEach((rule) => {
      const el = document.createElement("div");
      el.className = "timeline-clip clip-ducking";
      el.style.left = `${rule.start_sec * state.zoomPixelsPerSec}px`;
      el.style.width = `${Math.max(20, (rule.end_sec - rule.start_sec) * state.zoomPixelsPerSec)}px`;
      el.textContent = `🔉 Duck ${Math.round(rule.original_volume * 100)}%`;
      trackDucking.appendChild(el);
    });
  } else {
    trackDucking.innerHTML = '<span class="empty-track-placeholder">No ducking intervals configured.</span>';
  }

  // 3. Voiceover Track Clips
  const trackVO = document.getElementById("trackVoContent");
  trackVO.innerHTML = "";
  if (state.voiceoverClips.length > 0) {
    state.voiceoverClips.forEach((vo) => {
      const el = document.createElement("div");
      el.className = "timeline-clip clip-vo";
      el.style.left = `${vo.timestamp_sec * state.zoomPixelsPerSec}px`;
      el.style.width = `${Math.max(60, 6.0 * state.zoomPixelsPerSec)}px`;
      el.textContent = `🎙️ ${vo.voice || 'am_eric'}: "${vo.text.substring(0, 20)}..."`;
      trackVO.appendChild(el);
    });
  } else {
    trackVO.innerHTML = '<span class="empty-track-placeholder">No voiceover commentary clips.</span>';
  }

  // 4. Captions Track Clips
  const trackCaptions = document.getElementById("trackCaptionsContent");
  trackCaptions.innerHTML = "";
  if (state.captionsData && state.captionsData.segments && state.captionsData.segments.length > 0) {
    state.captionsData.segments.forEach((seg) => {
      const el = document.createElement("div");
      el.className = "timeline-clip clip-caption";
      el.style.left = `${seg.start_sec * state.zoomPixelsPerSec}px`;
      el.style.width = `${Math.max(30, (seg.end_sec - seg.start_sec) * state.zoomPixelsPerSec)}px`;
      el.textContent = `💬 "${(seg.text || 'Caption').substring(0, 24)}"`;
      trackCaptions.appendChild(el);
    });
  } else {
    trackCaptions.innerHTML = '<span class="empty-track-placeholder">No captions configured.</span>';
  }

  // 5. Effects Track Clips
  const trackEffects = document.getElementById("trackEffectsContent");
  trackEffects.innerHTML = "";
  if (state.watermarkSettings.enabled) {
    const el = document.createElement("div");
    el.className = "timeline-clip clip-effect";
    el.style.left = "0px";
    el.style.width = `${duration * state.zoomPixelsPerSec}px`;
    el.textContent = "💧 Watermark Mask (Active)";
    trackEffects.appendChild(el);
  } else {
    trackEffects.innerHTML = '<span class="empty-track-placeholder">No active visual effects.</span>';
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
    // True Pixelation Mosaic: sample down & upscale without smoothing
    const pixelSize = 8;
    const offCanvas = document.createElement("canvas");
    offCanvas.width = Math.max(1, Math.round(bw / pixelSize));
    offCanvas.height = Math.max(1, Math.round(bh / pixelSize));
    const offCtx = offCanvas.getContext("2d");

    offCtx.drawImage(videoEl, bx, by, bw, bh, 0, 0, offCanvas.width, offCanvas.height);

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

  // Visual Bounding Box & Resizing Handles
  ctx.strokeStyle = "rgba(0, 242, 254, 0.85)";
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);

  const handleSize = 10;
  ctx.fillStyle = "#00f2fe";
  ctx.fillRect(bx + bw - handleSize, by + bh - handleSize, handleSize, handleSize);

  ctx.fillStyle = "rgba(0, 242, 254, 0.9)";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText("WATERMARK COVER", bx + 6, by + 14);

  ctx.restore();
}

// Face Blur Privacy Box
function drawFaceBlurBox() {
  const w = canvasEl.width;
  const h = canvasEl.height;

  const fx = w * 0.38;
  const fy = h * 0.22;
  const fw = w * 0.24;
  const fh = fw * 1.3;

  ctx.save();
  if (state.faceSettings.mode === "emoji") {
    ctx.font = `${fw * 0.8}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("😎", fx + fw / 2, fy + fh * 0.7);
  } else if (state.faceSettings.mode === "mosaic") {
    const pixelSize = 10;
    const offCanvas = document.createElement("canvas");
    offCanvas.width = Math.max(1, Math.round(fw / pixelSize));
    offCanvas.height = Math.max(1, Math.round(fh / pixelSize));
    const offCtx = offCanvas.getContext("2d");
    offCtx.drawImage(videoEl, fx, fy, fw, fh, 0, 0, offCanvas.width, offCanvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offCanvas, 0, 0, offCanvas.width, offCanvas.height, fx, fy, fw, fh);
  } else {
    ctx.filter = `blur(${state.faceSettings.radius}px)`;
    ctx.drawImage(videoEl, fx, fy, fw, fh, fx, fy, fw, fh);
    ctx.filter = "none";
  }
  ctx.restore();
}

// Kinetic Captions with Pop Bounce & Active Highlight
function drawKineticCaptions() {
  if (!state.captionsData || !state.captionsData.segments) return;

  const cur = state.currentTime;
  const activeSeg = state.captionsData.segments.find(s => cur >= s.start_sec && cur <= s.end_sec);
  if (!activeSeg) return;

  const w = canvasEl.width;
  const h = canvasEl.height;
  const style = state.captionsData.style || {};
  const posY = (style.position_y_percent || 78) / 100 * h;
  const baseSize = style.font_size_px || 42;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const textToDisplay = activeSeg.text || "";
  const segProgress = (cur - activeSeg.start_sec) / Math.max(0.1, (activeSeg.end_sec - activeSeg.start_sec));
  const bounceScale = (segProgress < 0.15) ? (1 + Math.sin(segProgress / 0.15 * Math.PI) * 0.22) : 1.0;

  ctx.font = `900 ${Math.round(baseSize * bounceScale)}px ${style.font_family || 'Impact, sans-serif'}`;

  // Heavy Black Stroke Outline
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.round(baseSize * 0.18);
  ctx.strokeText(textToDisplay, w / 2, posY);

  // Highlight Color Fill
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
    progressEl.textContent = "Browser export notice: " + err.message + ". You can also use Option 2 for 4K Python export.";
  }
}

function updateCliCommandBox(videoName = "input.mp4") {
  const box = document.getElementById("ffmpegCodeBox");
  box.textContent = `python engine.py --video "${videoName}" --instructions instructions.json --output master.mp4`;
}

// Initialize on DOM load
window.addEventListener("DOMContentLoaded", init);
