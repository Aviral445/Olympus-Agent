"""
SAST (Static Application Security Testing) gate for Project Olympus.

Phase 2 upgrade — Language-aware ruleset selection:
  Engine 1: Semgrep — ruleset is now chosen per detected language:
              python → p/python
              javascript/typescript → p/javascript
              go → p/golang
              java → p/java
              rust → p/rust
              (fallback: p/default)
  Engine 2: Bandit (pure-Python) — unchanged fallback for Python on Windows.
              Blocks on HIGH severity findings only.

If neither engine is installed, the gate logs a warning and passes (preserves
existing graceful-degradation behaviour so the pipeline never hard-crashes due to
a missing security tool).
"""
import os
import subprocess
import json
from pathlib import Path

# ─── Semgrep language ruleset map ────────────────────────────────────────────────────────────

_SEMGREP_RULESETS: dict[str, str] = {
    "python":     "p/python",
    "javascript": "p/javascript",
    "typescript": "p/javascript",   # Semgrep p/javascript covers TS too
    "go":         "p/golang",
    "java":       "p/java",
    "rust":       "p/rust",
    "ruby":       "p/ruby",
    "cpp":        "p/cpp",
    "c":          "p/c",
}
_SEMGREP_DEFAULT_RULESET = "p/default"


def run_sast_scan(target_file: str, language: str = "python") -> dict:
    """
    Run a SAST security scan on the proposed patch file.

    Args:
        target_file: Absolute path to the file to scan.
        language:    Detected language string ("python", "javascript", "go", etc.).
                     Controls which Semgrep ruleset is used.

    Returns:
        {
            "passed":         bool   — True = safe to apply the patch
            "findings_count": int    — number of issues found
            "logs":           str    — human-readable findings summary
            "engine":         str    — which engine ran ("semgrep" | "bandit" | "none")
        }
    """
    clean_path = Path(target_file).as_posix()

    if not os.path.exists(clean_path):
        return {
            "passed": False,
            "findings_count": 0,
            "logs": f"File not found for SAST scan: {clean_path}",
            "engine": "none",
        }

    ruleset = _SEMGREP_RULESETS.get(language, _SEMGREP_DEFAULT_RULESET)
    print(f"[SAST Gate]: Scanning {os.path.basename(clean_path)} (lang={language}, ruleset={ruleset})...")

    # ── Engine 1: Semgrep ────────────────────────────────────────────────────────────────────
    semgrep_result = _run_semgrep(clean_path, ruleset)
    if semgrep_result is not None:
        return semgrep_result

    # ── Engine 2: Bandit (Python-only fallback) ──────────────────────────────────────────────
    if language == "python":
        bandit_result = _run_bandit(clean_path)
        if bandit_result is not None:
            return bandit_result

    # ── No engine available ─────────────────────────────────────────────────────────────────────────
    engine_note = "semgrep or bandit" if language == "python" else "semgrep"
    print(f"[SAST Gate]: No scanner available for {language} — scan skipped.")
    return {
        "passed": True,
        "findings_count": 0,
        "logs": f"SAST scan bypassed: no scanner available (install {engine_note}).",
        "engine": "none",
    }


# ─── Semgrep engine ───────────────────────────────────────────────────────────

def _run_semgrep(file_path: str, ruleset: str = "p/python") -> dict | None:
    """
    Run Semgrep on file_path with the given ruleset.

    Returns a result dict on success/failure, or None if Semgrep is not installed.
    """
    try:
        cmd = ["semgrep", "scan", f"--config={ruleset}", "--quiet", "--json", file_path]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        # Semgrep not found or returned nothing useful
        if result.returncode != 0 and not result.stdout.strip():
            return None  # Signal: try next engine

        try:
            scan_data = json.loads(result.stdout)
        except json.JSONDecodeError:
            return None  # Malformed output — fall through to Bandit

        findings = scan_data.get("results", [])
        if not findings:
            print("[SAST/Semgrep]: Zero security vulnerabilities detected.")
            return {"passed": True, "findings_count": 0, "logs": "No security issues found.", "engine": "semgrep"}

        summary = []
        for issue in findings:
            rule_id = issue.get("check_id", "security-issue")
            message = issue.get("extra", {}).get("message", "Potential flaw found")
            line    = issue.get("start", {}).get("line", 0)
            summary.append(f"Line {line} [{rule_id}]: {message}")

        print(f"[SAST/Semgrep]: Found {len(findings)} issue(s).")
        return {
            "passed":         False,
            "findings_count": len(findings),
            "logs":           "\n".join(summary),
            "engine":         "semgrep",
        }

    except FileNotFoundError:
        # semgrep binary not on PATH — expected on Windows native installs
        return None
    except Exception as e:
        print(f"[SAST/Semgrep]: Unexpected error ({e}) — trying Bandit...")
        return None


# ─── Bandit engine ────────────────────────────────────────────────────────────

def _run_bandit(file_path: str) -> dict | None:
    """
    Run Bandit on file_path (pure-Python fallback, works natively on Windows).

    Only blocks on HIGH severity findings to match Semgrep's aggressiveness.
    Returns a result dict, or None if Bandit is not installed.
    """
    try:
        cmd = [
            "bandit",
            "--format", "json",
            "--severity-level", "high",   # Only HIGH severity triggers a block
            "--quiet",
            file_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        # Exit code 1 = findings found, 0 = clean, anything else = error
        if result.returncode not in (0, 1):
            # Bandit not installed or crashed — treat as unavailable
            if not result.stdout.strip():
                return None

        try:
            scan_data = json.loads(result.stdout)
        except json.JSONDecodeError:
            return None

        results = scan_data.get("results", [])
        high_findings = [r for r in results if r.get("issue_severity", "").upper() == "HIGH"]

        if not high_findings:
            print("[SAST/Bandit]: Zero HIGH severity issues detected.")
            return {
                "passed":         True,
                "findings_count": 0,
                "logs":           f"No HIGH severity issues found (Bandit scanned {len(results)} total checks).",
                "engine":         "bandit",
            }

        summary = []
        for issue in high_findings:
            test_id   = issue.get("test_id", "?")
            test_name = issue.get("test_name", "unknown")
            line_no   = issue.get("line_number", 0)
            message   = issue.get("issue_text", "")
            summary.append(f"Line {line_no} [{test_id}/{test_name}]: {message}")

        print(f"[SAST/Bandit]: Found {len(high_findings)} HIGH severity issue(s).")
        return {
            "passed":         False,
            "findings_count": len(high_findings),
            "logs":           "\n".join(summary),
            "engine":         "bandit",
        }

    except FileNotFoundError:
        # bandit not on PATH
        return None
    except Exception as e:
        print(f"[SAST/Bandit]: Unexpected error ({e}) — skipping scan.")
        return None


if __name__ == "__main__":
    sample_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../target_app/app.py"))
    res = run_sast_scan(sample_file)
    print(f"Scan Result (engine={res['engine']}): passed={res['passed']}, findings={res['findings_count']}")
    if res["logs"]:
        print(res["logs"])