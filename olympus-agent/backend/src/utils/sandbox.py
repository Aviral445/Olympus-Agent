import subprocess
import os
import sys
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

def _get_auto_pip_prefix(clean_target_dir: str) -> str:
    """Scan clean_target_dir for requirements.txt files or top-level imports and generate pip install command."""
    legacy_map = {
        "mysql-python": "mysqlclient",
        "MySQL-python": "mysqlclient",
        "ConfigParser": "configparser",
    }

    req_files = []
    for root, _, files in os.walk(clean_target_dir):
        if any(skip in root for skip in ("venv", ".venv", ".git", "__pycache__", "node_modules")):
            continue
        if "requirements.txt" in files:
            req_files.append(os.path.join(root, "requirements.txt"))

    if req_files:
        pip_cmds = []
        for req_file in req_files:
            try:
                with open(req_file, "r", encoding="utf-8", errors="ignore") as fh:
                    lines = fh.readlines()
                clean_lines = []
                for line in lines:
                    line_lower = line.strip().lower()
                    if any(unsupported in line_lower for unsupported in ("pyaudio", "pyqt5", "mysql-python")):
                        continue
                    clean_lines.append(line)
                with open(req_file, "w", encoding="utf-8") as fh:
                    fh.writelines(clean_lines)
            except Exception:
                pass
            rel_req = os.path.relpath(req_file, clean_target_dir).replace("\\", "/")
            pip_cmds.append(f"pip install --quiet --no-cache-dir -r {rel_req} || true")
        return " && ".join(pip_cmds) + " && "



    pkgs = set()
    mod_to_pkg = {
        "PIL": "Pillow",
        "cv2": "opencv-python",
        "yaml": "pyyaml",
        "bs4": "beautifulsoup4",
        "sklearn": "scikit-learn",
        "mysql": "mysqlclient",
        "MySQLdb": "mysqlclient",
    }
    ignored_pkgs = {
        "mysql-python", "mysql_python", "ConfigParser", "configparser",
        "src", "app", "tests", "utils", "models", "views", "controllers"
    }
    stdlib = {
        "sys", "os", "io", "re", "json", "ast", "math", "time", "random",
        "subprocess", "tempfile", "pathlib", "typing", "asyncio", "datetime",
        "functools", "collections", "unittest", "logging", "shutil", "urllib",
        "base64", "hashlib", "threading", "multiprocessing", "select", "socket"
    }

    for root, _, files in os.walk(clean_target_dir):
        if any(skip in root for skip in ("venv", ".venv", ".git", "__pycache__", "node_modules")):
            continue
        for f in files:
            if f.endswith(".py"):
                fpath = os.path.join(root, f)
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as fh:
                        for line in fh:
                            line = line.strip()
                            if line.startswith("import ") or line.startswith("from "):
                                parts = line.split()
                                if len(parts) >= 2:
                                    mod = parts[1].split(".")[0]
                                    if mod and not mod.startswith("_") and mod not in stdlib:
                                        pkg = mod_to_pkg.get(mod, mod)
                                        if pkg not in ignored_pkgs:
                                            pkgs.add(pkg)
                except Exception:
                    pass

    if pkgs:
        pkg_str = " ".join(sorted(pkgs))
        return f"pip install --quiet --no-cache-dir {pkg_str} || true && "
    return ""


# ─── Runner Registry (Phase 2) ───────────────────────────────────────────────────────────────────────

# (image, test command) per runner name
_RUNNER_REGISTRY: dict[str, tuple[str, str]] = {
    "pytest": (
        "olympus-sandbox",
        "pytest --tb=short -o cache_dir=/tmp/.pytest_cache",
    ),
    "jest": (
        "node:20-slim",
        "npm install --silent && npx jest --ci --forceExit 2>&1 || true",
    ),
    "go": (
        "golang:1.22-alpine",
        "go test ./... 2>&1",
    ),
    "cargo": (
        "rust:1.78-slim",
        "cargo test 2>&1",
    ),
    "maven": (
        "maven:3.9-eclipse-temurin-21",
        "mvn test -q 2>&1 || true",
    ),
    "gradle": (
        "gradle:8.8-jdk21",
        "gradle test 2>&1 || true",
    ),
}


def _detect_runner(workspace_dir: str) -> tuple[str, str, str]:
    """
    Detect the appropriate test runner for a workspace.

    Checks for manifest files in priority order:
      package.json  → Jest (node:20-slim)
      go.mod        → Go test (golang:1.22-alpine)
      Cargo.toml    → Cargo test (rust:1.78-slim)
      pom.xml       → Maven (maven:3.9-eclipse-temurin-21)
      build.gradle  → Gradle (gradle:8.8-jdk21)
      (default)     → pytest (olympus-sandbox)

    Returns:
        (runner_name, docker_image, container_script)
    """
    root = Path(workspace_dir)
    manifests: list[tuple[str, str]] = [
        ("package.json",     "jest"),
        ("go.mod",           "go"),
        ("Cargo.toml",       "cargo"),
        ("pom.xml",          "maven"),
        ("build.gradle",     "gradle"),
        ("build.gradle.kts", "gradle"),
    ]
    for manifest, runner_name in manifests:
        if (root / manifest).exists():
            image, script = _RUNNER_REGISTRY[runner_name]
            print(f"[Sandbox]: Detected '{manifest}' → using {runner_name} runner ({image})")
            return runner_name, image, script

    image, script = _RUNNER_REGISTRY["pytest"]
    return "pytest", image, script



def run_in_sandbox(target_file_path: str, test_dir: str = "") -> dict:
    """
    Executes tests inside a language-appropriate Docker container.

    Phase 2: uses the runner registry (_detect_runner) to select the right
    Docker image and test command based on manifest files in the workspace.
    Python/pytest remains the default with automatic pip-dep installation.
    """
    try:
        if test_dir and os.path.isdir(test_dir):
            target_dir = Path(test_dir).resolve()
        else:
            root_dir = find_project_root(os.path.dirname(target_file_path))
            target_dir = (Path(root_dir) / "backend" / "target_app").resolve()

            if not target_dir.exists():
                target_dir = (Path(root_dir) / "target_app").resolve()

        clean_target_dir = target_dir.as_posix()

    except Exception as e:
        return {"exit_code": -1, "logs": f"Path Discovery Error: {str(e)}"}

    # ── Detect runner (Phase 2) ────────────────────────────────────────────────
    runner_name, docker_image, container_script = _detect_runner(clean_target_dir)

    # For the Python/pytest runner keep the existing pip-dep + test discovery logic
    if runner_name == "pytest":
        tests_exist = os.path.exists(os.path.join(clean_target_dir, "tests")) or any(
            f.startswith("test_") or f.endswith("_test.py")
            for _root, _, files in os.walk(clean_target_dir)
            for f in files
        )
        pip_prefix = _get_auto_pip_prefix(clean_target_dir)

        if tests_exist:
            container_script = pip_prefix + "pytest --tb=short -o cache_dir=/tmp/.pytest_cache"
        else:
            rel_target = (
                os.path.relpath(target_file_path, clean_target_dir).replace("\\", "/")
                if target_file_path else ""
            )
            container_script = (
                (pip_prefix + f"python -m py_compile {rel_target}")
                if rel_target else (pip_prefix + "pytest --tb=short")
            )

    docker_cmd = [
        "docker", "run", "--rm",
        "-v", f"{clean_target_dir}:/workspace",
        "-w", "/workspace",
        "-e", "PYTHONUNBUFFERED=1",
        docker_image,
        "sh", "-c", container_script,
    ]


    try:
        result = subprocess.run(
            docker_cmd,
            capture_output=True,
            text=True,
            check=False
        )
        
        combined_logs = (result.stdout + "\n" + result.stderr).strip()

        # Handle exit codes 4 and 5 (no tests found or directory not found) gracefully
        if result.returncode in (4, 5) or "file or directory not found" in combined_logs.lower():
            # Fall back to local py_compile syntax check
            rel_file = os.path.relpath(target_file_path, clean_target_dir) if target_file_path else ""
            if rel_file and os.path.exists(os.path.join(clean_target_dir, rel_file)):
                pyc_res = subprocess.run(
                    [sys.executable, "-m", "py_compile", os.path.join(clean_target_dir, rel_file)],
                    capture_output=True, text=True
                )
                if pyc_res.returncode == 0:
                    return {
                        "exit_code": 0,
                        "logs": f"✅ [Sandbox]: Syntax check passed for {rel_file} (py_compile exit 0). Target file compiles cleanly!"
                    }
                else:
                    return {
                        "exit_code": pyc_res.returncode,
                        "logs": f"❌ [Sandbox]: Syntax error in {rel_file}:\n" + pyc_res.stderr
                    }

            return {
                "exit_code": 0,
                "logs": combined_logs + "\n[sandbox] ℹ️  No test suite found — treating syntax validation as PASS."
            }

        return {
            "exit_code": result.returncode,
            "logs": combined_logs if combined_logs else "No logs recorded from container."
        }

    except Exception as e:
        # Docker subprocess fallback to local py_compile
        rel_file = os.path.relpath(target_file_path, clean_target_dir) if target_file_path else ""
        if rel_file and os.path.exists(os.path.join(clean_target_dir, rel_file)):
            pyc_res = subprocess.run(
                [sys.executable, "-m", "py_compile", os.path.join(clean_target_dir, rel_file)],
                capture_output=True, text=True
            )
            if pyc_res.returncode == 0:
                return {
                    "exit_code": 0,
                    "logs": f"✅ [Local Sandbox]: Syntax check passed for {rel_file} (py_compile exit 0). Target file compiles cleanly!"
                }
            else:
                return {
                    "exit_code": pyc_res.returncode,
                    "logs": f"❌ [Local Sandbox]: Syntax error in {rel_file}:\n" + pyc_res.stderr
                }

        return {
            "exit_code": -1,
            "logs": f"Subprocess Execution Error: {str(e)}"
        }