import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Explicitly load <project-root>/.env — backend runs from backend/ so cwd search misses it
load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv()  # also try cwd as fallback

# Add backend dir to path for module resolution
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from contextlib import asynccontextmanager

from storage.cache import init_db
from services import ollama_service
from routers.api import router, _zillow


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database
    await init_db()

    # Detect Ollama
    ok, model = ollama_service.detect_ollama()
    if ok:
        print(f"✓ Ollama ready — selected model: {model}")
    else:
        print("⚠ Ollama not available — using rule-based fallbacks")

    # Load Zillow key if set
    await _zillow.load_key()
    if _zillow.is_configured:
        print("✓ Zillow API configured")
    else:
        print("ℹ Using demo data (set ZILLOW_API_KEY or POST /api/config/zillow-key)")

    yield
    print("Shutting down...")


app = FastAPI(
    title="FindRE — Real Estate Discovery Engine",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

# Serve frontend in production
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        index = frontend_dist / "index.html"
        return FileResponse(str(index))


def _check_port(port: int) -> None:
    """Check if port is in use and offer to kill the occupying process."""
    import socket, subprocess, signal

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(("localhost", port)) != 0:
            return  # Port is free

    # Find the PID holding the port
    try:
        result = subprocess.run(
            ["lsof", "-ti", f":{port}"],
            capture_output=True, text=True, timeout=5
        )
        pids = result.stdout.strip().split()
    except Exception:
        pids = []

    if pids:
        pid_str = ", ".join(pids)
        print(f"\n⚠  Port {port} is already in use (PID {pid_str}).")
        print(f"   This is probably a previous server instance.\n")
        try:
            import sys as _sys
            if not _sys.stdin.isatty():
                answer = "n"
            else:
                answer = input("   Kill it and start fresh? [Y/n] ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            answer = "n"

        if answer in ("", "y", "yes"):
            for pid in pids:
                try:
                    os.kill(int(pid), signal.SIGTERM)
                except ProcessLookupError:
                    pass
            import time
            time.sleep(1)
            print(f"   Killed PID {pid_str}. Starting server...\n")
        else:
            print(f"\n   To kill manually:  kill {pid_str}")
            print(f"   Or force-kill:     kill -9 {pid_str}\n")
            sys.exit(1)
    else:
        print(f"\n⚠  Port {port} is in use but no PID found.")
        print(f"   Try:  lsof -ti :{port} | xargs kill\n")
        sys.exit(1)


if __name__ == "__main__":
    import uvicorn

    PORT = int(os.environ.get("PORT", 8000))
    _check_port(PORT)
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
