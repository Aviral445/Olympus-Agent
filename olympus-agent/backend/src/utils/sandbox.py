import subprocess
import os
from pathlib import Path

def find_project_root(current_path: str, anchor: str = ".env") -> str:
    dirname = Path(current_path).resolve()
    while True:
        if (dirname / anchor).exists():
            return dirname.as_posix()
        parent = dirname.parent
        if parent == dirname:
            raise FileNotFoundError(f"Could not locate project root containing '{anchor}' anchor.")
        dirname = parent

def run_in_sandbox(target_file_path: str, test_dir: str = "") -> dict:
    """
    Executes pytest inside the olympus-sandbox Docker container.
    
    Args:
        target_file_path: The source file being patched (used for root discovery fallback).
        test_dir: Optional explicit directory to mount. Use for external/cloned repos.
                  If empty, falls back to the local backend/target_app directory.
    """
    try:
        if test_dir and os.path.isdir(test_dir):
            # FIX: use provided workspace dir directly for external repos
            target_dir = Path(test_dir).resolve()
        else:
            root_dir = find_project_root(os.path.dirname(target_file_path))
            target_dir = (Path(root_dir) / "backend" / "target_app").resolve()

            # Fallback if backend/target_app isn't found at the root level directly
            if not target_dir.exists():
                target_dir = (Path(root_dir) / "target_app").resolve()

        clean_target_dir = target_dir.as_posix()

    except Exception as e:
        return {"exit_code": -1, "logs": f"Path Discovery Error: {str(e)}"}

    # Build native Docker CLI execution command with POSIX pathing and Pytest isolated cache
    docker_cmd = [
        "docker", "run", "--rm",
        "-v", f"{clean_target_dir}:/workspace",
        "-w", "/workspace",
        "-e", "PYTHONUNBUFFERED=1",
        "olympus-sandbox",
        "pytest", "tests/", "--tb=short", "-o", "cache_dir=/tmp/.pytest_cache"
    ]

    try:
        result = subprocess.run(
            docker_cmd,
            capture_output=True,
            text=True,
            check=False
        )
        
        combined_logs = (result.stdout + "\n" + result.stderr).strip()

        return {
            "exit_code": result.returncode,
            "logs": combined_logs if combined_logs else "No logs recorded from container."
        }

    except Exception as e:
        return {
            "exit_code": -1,
            "logs": f"Subprocess Execution Error: {str(e)}"
        }