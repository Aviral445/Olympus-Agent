import os
import sqlite3
from pathlib import Path

# Ensure sqlite DB is stored in backend/database/data/
DB_DIR = Path(__file__).resolve().parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "olympus_logs.db"

def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS patch_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            target_file TEXT,
            attempt INTEGER,
            status TEXT,
            git_diff TEXT,
            error_logs TEXT
        )
    ''')
    conn.commit()
    conn.close()

def log_patch_run(target_file: str, attempt: int, status: str, git_diff: str, error_logs: str):
    init_db()
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO patch_logs (target_file, attempt, status, git_diff, error_logs)
        VALUES (?, ?, ?, ?, ?)
    ''', (target_file, attempt, status, git_diff, error_logs))
    conn.commit()
    log_id = cursor.lastrowid
    conn.close()
    print(f"💾 [Database]: Stored log entry ID #{log_id} ({status})")
    return log_id


def get_runs(limit: int = 50) -> list:
    """Return the most recent patch run records for the history dashboard."""
    init_db()
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute(
        '''
        SELECT id, timestamp, target_file, attempt, status, git_diff, error_logs
        FROM patch_logs
        ORDER BY timestamp DESC
        LIMIT ?
        ''',
        (limit,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id":          row[0],
            "timestamp":   row[1],
            "target_file": row[2],
            "attempt":     row[3],
            "status":      row[4],
            "git_diff":    row[5] or "",
            "error_logs":  (row[6] or "")[:600],  # truncate for API response
        }
        for row in rows
    ]