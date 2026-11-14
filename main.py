import os
from pathlib import Path

# Ensure bundled ffmpeg/ffprobe binaries in bin/ are in PATH
bin_dir = Path(__file__).resolve().parent / "bin"
if bin_dir.is_dir() and str(bin_dir) not in os.environ.get("PATH", ""):
    os.environ["PATH"] = f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}"

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from ai.pipeline import analyze_segments
from preprocessing.media_preprocessor import MediaPreprocessor
from services import upload_service
from services.upload_service import (
    UploadValidationError,
    get_video_details,
    list_uploaded_videos,
    save_video,
)
from services.video_service import get_video_info

app = FastAPI(
    title="Multi-Modal Deepfake Detection API",
    description="Backend API and web interface for multimodal deepfake detection",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ROOT = Path(__file__).resolve().parent

# Mount static folder if it exists
static_path = PROJECT_ROOT / "static"
if static_path.is_dir():
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/upload", status_code=201)
async def upload_video(file: UploadFile = File(...)):
    try:
        result = await save_video(file)
        return result
    except UploadValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError:
        raise HTTPException(
            status_code=500, detail="Could not store the uploaded video."
        ) from None


@app.get("/videos")
def get_uploaded_videos():
    videos = list_uploaded_videos()
    return {
        "count": len(videos),
        "videos": videos,
    }


@app.get("/videos/{filename}")
def get_video(filename: str):
    result = get_video_details(filename)
    if result is None:
        raise HTTPException(status_code=404, detail="Video not found.")
    return result


@app.get("/videos/{filename}/info")
def get_video_information(filename: str):
    result = get_video_info(filename)
    if result is None:
        raise HTTPException(
            status_code=400,
            detail="Could not read video information. Check that the video exists and is readable.",
        )
    return {
        "filename": filename,
        "video_info": result,
    }


@app.post("/videos/{filename}/analyze")
@app.get("/videos/{filename}/analyze")
@app.post("/analyze/{filename}")
@app.get("/analyze/{filename}")
def analyze_video_endpoint(filename: str):
    """Run multimodal deepfake detection pipeline on an uploaded video."""
    video_path = upload_service.UPLOAD_DIR / filename
    if not video_path.is_file():
        raise HTTPException(status_code=404, detail="Video not found.")

    try:
        video_info = get_video_info(filename)
        preprocessor = MediaPreprocessor()
        segments = preprocessor.preprocess(video_path)
        analysis_result = analyze_segments(segments)

        return {
            "filename": filename,
            "video_info": video_info,
            "analysis": analysis_result.to_dict(),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(exc)}",
        ) from exc


# Web UI routes
@app.get("/", response_class=HTMLResponse)
def serve_home():
    index_file = PROJECT_ROOT / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    return HTMLResponse("<h1>Multi-Modal Deepfake Detection API is running.</h1>")


@app.get("/dashboard", response_class=HTMLResponse)
def serve_dashboard():
    dashboard_file = PROJECT_ROOT / "dashboard.html"
    if dashboard_file.is_file():
        return FileResponse(dashboard_file)
    return FileResponse(PROJECT_ROOT / "index.html")


@app.get("/style.css")
def serve_css():
    css_file = PROJECT_ROOT / "style.css"
    return FileResponse(css_file, media_type="text/css")


@app.get("/app.js")
def serve_js():
    js_file = PROJECT_ROOT / "app.js"
    return FileResponse(js_file, media_type="application/javascript")


if __name__ == "__main__":
    import uvicorn

    print("Starting Multi-Modal Deepfake Detection server on http://127.0.0.1:8000 ...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)

