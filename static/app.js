"use strict";

// ==========================================
// CONFIG & ELEMENTS
// ==========================================

const API_BASE_URL = window.location.origin.includes(":8000")
    ? window.location.origin
    : "http://127.0.0.1:8000";

const videoFile = document.getElementById("videoFile");
const dropZone = document.getElementById("dropZone");
const fileDetails = document.getElementById("fileDetails");
const fileName = document.getElementById("fileName");
const fileInfo = document.getElementById("fileInfo");
const videoPreview = document.getElementById("videoPreview");
const fileMessage = document.getElementById("fileMessage");
const removeVideo = document.getElementById("removeVideo");
const analyzeButton = document.getElementById("analyzeButton");
const analysisNotice = document.getElementById("analysisNotice");
const resultsSection = document.getElementById("resultsSection");

let selectedVideo = null;
let previewUrl = null;

// ==========================================
// HELPERS
// ==========================================

function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function resetAnalysis() {
    resultsSection.hidden = true;
    analysisNotice.textContent = "Select a video and click Analyze Video to begin multimodal forensics.";

    // Reset cards to default
    const resultItems = document.querySelectorAll(".results-grid .result-item");
    if (resultItems.length >= 4) {
        const visualBadge = resultItems[0].querySelector(".result-status");
        if (visualBadge) {
            visualBadge.textContent = "Awaiting analysis";
            visualBadge.style.background = "#101d30";
            visualBadge.style.color = "#a9c7ff";
            visualBadge.style.borderColor = "#314663";
        }
        const audioBadge = resultItems[1].querySelector(".result-status");
        if (audioBadge) {
            audioBadge.textContent = "Awaiting analysis";
            audioBadge.style.background = "#101d30";
            audioBadge.style.color = "#a9c7ff";
            audioBadge.style.borderColor = "#314663";
        }
        const syncBadge = resultItems[2].querySelector(".result-status");
        if (syncBadge) {
            syncBadge.textContent = "Awaiting analysis";
            syncBadge.style.background = "#101d30";
            syncBadge.style.color = "#a9c7ff";
            syncBadge.style.borderColor = "#314663";
        }
        const finalStatus = resultItems[3].querySelector(".final-result-status");
        if (finalStatus) {
            finalStatus.textContent = "No prediction available";
            finalStatus.style.background = "#17263a";
            finalStatus.style.color = "#b6c9e8";
            finalStatus.style.borderColor = "#314663";
        }
        const disclaimer = resultItems[3].querySelector(".result-disclaimer");
        if (disclaimer) {
            disclaimer.textContent = "No authenticity verdict has been generated.";
        }
    }

    const metadataPanel = document.getElementById("videoMetadata");
    if (metadataPanel) metadataPanel.remove();

    const segmentsPanel = document.getElementById("segmentsBreakdown");
    if (segmentsPanel) segmentsPanel.remove();
}

// ==========================================
// CLEAR SELECTED VIDEO
// ==========================================

function clearVideo() {
    videoPreview.pause();
    videoPreview.removeAttribute("src");
    videoPreview.load();

    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }

    selectedVideo = null;
    videoFile.value = "";

    fileDetails.hidden = true;
    analyzeButton.disabled = true;

    fileName.textContent = "";
    fileInfo.textContent = "";
    fileMessage.textContent = "No video selected yet.";

    resetAnalysis();
}

// ==========================================
// SELECT VIDEO
// ==========================================

function selectVideo(file) {
    if (!file) return;

    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
        fileMessage.textContent = "Please select a valid video file (MP4, MOV, or AVI).";
        return;
    }

    clearVideo();

    selectedVideo = file;
    previewUrl = URL.createObjectURL(file);

    fileName.textContent = file.name;
    fileInfo.textContent = formatFileSize(file.size);

    fileDetails.hidden = false;
    analyzeButton.disabled = false;
    fileMessage.textContent = "Video selected successfully.";

    videoPreview.src = previewUrl;

    videoPreview.onloadedmetadata = () => {
        if (selectedVideo !== file) return;
        if (Number.isFinite(videoPreview.duration)) {
            fileInfo.textContent = `${formatFileSize(file.size)} • ${formatDuration(videoPreview.duration)}`;
        }
    };

    videoPreview.onerror = () => {
        if (selectedVideo !== file) return;
        fileMessage.textContent = "The video preview could not be loaded in browser. File is still valid for analysis.";
    };

    resetAnalysis();
}

// ==========================================
// EVENT LISTENERS: FILE INPUT & DRAG/DROP
// ==========================================

videoFile.addEventListener("change", () => {
    if (videoFile.files && videoFile.files[0]) {
        selectVideo(videoFile.files[0]);
    }
});

removeVideo.addEventListener("click", clearVideo);

dropZone.addEventListener("click", (event) => {
    if (event.target.closest("input, label, button")) return;
    videoFile.click();
});

dropZone.addEventListener("keydown", (event) => {
    if (event.target !== dropZone) return;
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        videoFile.click();
    }
});

["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.add("drag-over");
    });
});

["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.remove("drag-over");
    });
});

dropZone.addEventListener("drop", (event) => {
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
        selectVideo(event.dataTransfer.files[0]);
    }
});

// ==========================================
// ANALYSIS FLOW
// ==========================================

analyzeButton.addEventListener("click", async () => {
    if (!selectedVideo) {
        fileMessage.textContent = "Please select a video before continuing.";
        return;
    }

    analyzeButton.disabled = true;
    resultsSection.hidden = false;
    analysisNotice.textContent = "Uploading video to server...";

    resultsSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    try {
        // Step 1: Upload the video
        const formData = new FormData();
        formData.append("file", selectedVideo);

        const uploadResponse = await fetch(`${API_BASE_URL}/upload`, {
            method: "POST",
            body: formData,
        });

        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok) {
            throw new Error(uploadResult.detail || "Video upload failed.");
        }

        const filename = uploadResult.filename;
        if (!filename) {
            throw new Error("Upload succeeded, but no filename was returned.");
        }

        // Step 2: Get Video Metadata
        analysisNotice.textContent = "Extracting video metadata...";
        const infoResponse = await fetch(`${API_BASE_URL}/videos/${encodeURIComponent(filename)}/info`);
        const infoResult = await infoResponse.json();
        const info = infoResult.video_info || {};

        fileInfo.textContent =
            `${formatFileSize(selectedVideo.size)} • ` +
            `${info.width || '?'} × ${info.height || '?'} • ` +
            `${Number(info.fps || 0).toFixed(2)} FPS • ` +
            `${formatDuration(info.duration_seconds || 0)}`;

        renderMetadataPanel(info, filename);

        // Step 3: Run Multimodal Forensics Analysis
        analysisNotice.textContent = "Running Multimodal Forensics (Xception + BlazeFace + AASIST)... This may take a few moments.";

        const analyzeResponse = await fetch(`${API_BASE_URL}/videos/${encodeURIComponent(filename)}/analyze`, {
            method: "POST",
        });

        const analyzeData = await analyzeResponse.json();
        if (!analyzeResponse.ok) {
            throw new Error(analyzeData.detail || "Multimodal analysis failed.");
        }

        renderAnalysisResults(analyzeData.analysis);
        analysisNotice.textContent = "Analysis completed successfully.";

    } catch (error) {
        console.error("Forensic analysis error:", error);
        analysisNotice.textContent = `Error: ${error.message}`;
    } finally {
        analyzeButton.disabled = !selectedVideo;
    }
});

// ==========================================
// RENDERERS
// ==========================================

function renderMetadataPanel(info, filename) {
    let metadataPanel = document.getElementById("videoMetadata");
    if (!metadataPanel) {
        metadataPanel = document.createElement("article");
        metadataPanel.id = "videoMetadata";
        metadataPanel.className = "result-item";
        metadataPanel.style.gridColumn = "1 / -1";
        metadataPanel.style.marginBottom = "12px";
        resultsSection.querySelector(".results-grid").prepend(metadataPanel);
    }

    metadataPanel.innerHTML = `
        <span class="result-number">METADATA</span>
        <h3>Technical Video Profile</h3>
        <p style="color: #9db0cc; font-size: 13px; line-height: 1.6;">
            <strong>Server Filename:</strong> <code>${filename}</code><br>
            <strong>Resolution:</strong> ${info.width || '?'} × ${info.height || '?'} px<br>
            <strong>Frame Rate:</strong> ${Number(info.fps || 0).toFixed(2)} FPS<br>
            <strong>Total Frames:</strong> ${info.total_frames || '?'}<br>
            <strong>Duration:</strong> ${Number(info.duration_seconds || 0).toFixed(2)} s (${formatDuration(info.duration_seconds || 0)})
        </p>
    `;
}

function renderAnalysisResults(analysis) {
    if (!analysis) return;

    const resultItems = document.querySelectorAll(".results-grid .result-item:not(#videoMetadata)");
    if (resultItems.length < 4) return;

    // 1. Visual Analysis
    const visualItem = resultItems[0];
    const visualBadge = visualItem.querySelector(".result-status");
    if (visualBadge) {
        if (analysis.video_score !== null && analysis.video_score !== undefined) {
            const vPct = (analysis.video_score * 100).toFixed(1);
            if (analysis.video_score >= 0.5) {
                visualBadge.textContent = `${vPct}% Fake Probability (Suspicious)`;
                visualBadge.style.background = "rgba(239, 68, 68, 0.15)";
                visualBadge.style.color = "#fca5a5";
                visualBadge.style.borderColor = "#ef4444";
            } else {
                visualBadge.textContent = `${vPct}% Fake Probability (Authentic)`;
                visualBadge.style.background = "rgba(34, 197, 94, 0.15)";
                visualBadge.style.color = "#86efac";
                visualBadge.style.borderColor = "#22c55e";
            }
        } else {
            visualBadge.textContent = "No face detected in sampled frames";
            visualBadge.style.background = "#20283a";
            visualBadge.style.color = "#cbd5e1";
            visualBadge.style.borderColor = "#334155";
        }
    }

    // 2. Audio Analysis
    const audioItem = resultItems[1];
    const audioBadge = audioItem.querySelector(".result-status");
    if (audioBadge) {
        if (analysis.audio_score !== null && analysis.audio_score !== undefined) {
            const aPct = (analysis.audio_score * 100).toFixed(1);
            if (analysis.audio_score >= 0.5) {
                audioBadge.textContent = `${aPct}% Fake Probability (Synthetic Speech)`;
                audioBadge.style.background = "rgba(239, 68, 68, 0.15)";
                audioBadge.style.color = "#fca5a5";
                audioBadge.style.borderColor = "#ef4444";
            } else {
                audioBadge.textContent = `${aPct}% Fake Probability (Natural Voice)`;
                audioBadge.style.background = "rgba(34, 197, 94, 0.15)";
                audioBadge.style.color = "#86efac";
                audioBadge.style.borderColor = "#22c55e";
            }
        } else {
            audioBadge.textContent = "No audio stream found";
            audioBadge.style.background = "#20283a";
            audioBadge.style.color = "#cbd5e1";
            audioBadge.style.borderColor = "#334155";
        }
    }

    // 3. Audio-Video Sync
    const syncItem = resultItems[2];
    const syncBadge = syncItem.querySelector(".result-status");
    if (syncBadge) {
        syncBadge.textContent = "Temporal consistency evaluated";
        syncBadge.style.background = "rgba(139, 92, 246, 0.15)";
        syncBadge.style.color = "#c4b5fd";
        syncBadge.style.borderColor = "#8b5cf6";
    }

    // 4. Final Detection Result
    const finalItem = resultItems[3];
    const finalStatus = finalItem.querySelector(".final-result-status");
    const disclaimer = finalItem.querySelector(".result-disclaimer");

    const isFake = analysis.prediction === "FAKE";
    const confidencePct = analysis.confidence !== null ? (analysis.confidence * 100).toFixed(1) : "0.0";
    const overallPct = analysis.overall_score !== null ? (analysis.overall_score * 100).toFixed(1) : "0.0";

    if (finalStatus) {
        if (analysis.prediction === "inconclusive") {
            finalStatus.textContent = "INCONCLUSIVE ASSESSMENT";
            finalStatus.style.background = "rgba(234, 179, 8, 0.15)";
            finalStatus.style.color = "#fef08a";
            finalStatus.style.borderColor = "#eab308";
        } else if (isFake) {
            finalStatus.innerHTML = `⚠️ DETECTED AS DEEPFAKE / MANIPULATED <span style="margin-left: 8px; font-weight: normal; font-size: 13px;">(${confidencePct}% confidence)</span>`;
            finalStatus.style.background = "rgba(239, 68, 68, 0.2)";
            finalStatus.style.color = "#f87171";
            finalStatus.style.borderColor = "#ef4444";
        } else {
            finalStatus.innerHTML = `✅ DETECTED AS AUTHENTIC / REAL <span style="margin-left: 8px; font-weight: normal; font-size: 13px;">(${confidencePct}% confidence)</span>`;
            finalStatus.style.background = "rgba(34, 197, 94, 0.2)";
            finalStatus.style.color = "#4ade80";
            finalStatus.style.borderColor = "#22c55e";
        }
    }

    if (disclaimer) {
        disclaimer.innerHTML = `Overall Multimodal Score: <strong>${overallPct}%</strong> fake probability. Model evaluated ${analysis.segments ? analysis.segments.length : 0} time segments.`;
    }

    // 5. Segments Timeline Table
    if (analysis.segments && analysis.segments.length > 0) {
        renderSegmentsTimeline(analysis.segments);
    }
}

function renderSegmentsTimeline(segments) {
    let panel = document.getElementById("segmentsBreakdown");
    if (!panel) {
        panel = document.createElement("article");
        panel.id = "segmentsBreakdown";
        panel.className = "result-item";
        panel.style.gridColumn = "1 / -1";
        panel.style.marginTop = "14px";
        resultsSection.querySelector(".results-grid").appendChild(panel);
    }

    let rowsHtml = segments.map((seg, idx) => {
        const vScoreStr = seg.video_fake_score !== null ? `${(seg.video_fake_score * 100).toFixed(1)}%` : "N/A";
        const aScoreStr = seg.audio_fake_score !== null ? `${(seg.audio_fake_score * 100).toFixed(1)}%` : "N/A";
        return `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); text-align: left;">
                <td style="padding: 8px 12px; font-family: monospace;">#${idx + 1} (${seg.start_sec.toFixed(1)}s - ${seg.end_sec.toFixed(1)}s)</td>
                <td style="padding: 8px 12px; color: ${seg.video_fake_score !== null && seg.video_fake_score >= 0.5 ? '#f87171' : '#4ade80'};">${vScoreStr}</td>
                <td style="padding: 8px 12px; color: ${seg.audio_fake_score !== null && seg.audio_fake_score >= 0.5 ? '#f87171' : '#4ade80'};">${aScoreStr}</td>
            </tr>
        `;
    }).join("");

    panel.innerHTML = `
        <span class="result-number">TIMELINE FORENSICS</span>
        <h3>Segment-by-Segment Analysis</h3>
        <p style="color: #9db0cc; font-size: 13px; margin-bottom: 12px;">Detailed fake probability scores across 5-second overlapping time windows:</p>
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="border-bottom: 1px solid #314663; color: #a9c7ff;">
                        <th style="padding: 8px 12px; text-align: left;">Segment Interval</th>
                        <th style="padding: 8px 12px; text-align: left;">Video Modality Score</th>
                        <th style="padding: 8px 12px; text-align: left;">Audio Modality Score</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;
}
