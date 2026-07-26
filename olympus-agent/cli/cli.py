"""
olympus - Command-line interface for Project Olympus SRE Engine.

Installation:
    cd olympus-agent
    pip install -e .

Usage:
    olympus health
    olympus trigger --repo-url https://github.com/user/repo --max-attempts 5
    olympus trigger --target-file src/app.py --repo-url https://github.com/user/repo
    olympus status <run-id>
    olympus history [--limit 20]
    olympus rag-query "ValueError price must be positive" --collection codebase_chunks
"""

import sys
import io
# Force UTF-8 output on Windows so Rich emoji render correctly
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import json
import os
import time
from typing import Optional

import typer
import httpx
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.progress import Progress, SpinnerColumn, TimeElapsedColumn, TextColumn
from rich.syntax import Syntax
from rich.live import Live
from rich.layout import Layout
from rich import box
from dotenv import load_dotenv

# ─── App setup ────────────────────────────────────────────────────────────────

load_dotenv()

app = typer.Typer(
    name="olympus",
    help="Project Olympus -- Autonomous SRE Engine CLI",
    add_completion=False,
    rich_markup_mode=None,
    pretty_exceptions_show_locals=False,
)
console = Console()


def _api_url() -> str:
    """Read backend URL from OLYMPUS_API_URL env var (default localhost:8000)."""
    return os.getenv("OLYMPUS_API_URL", "http://localhost:8000").rstrip("/")


def _client() -> httpx.Client:
    return httpx.Client(base_url=_api_url(), timeout=30.0)


# ─── Health ───────────────────────────────────────────────────────────────────

@app.command()
def health():
    """Check the backend service status."""
    with _client() as client:
        try:
            r = client.get("/health")
            r.raise_for_status()
            data = r.json()
        except httpx.ConnectError:
            console.print(
                Panel(
                    f"[red]Cannot connect to Olympus backend at [bold]{_api_url()}[/bold]\n"
                    "Make sure the server is running: [cyan]python src/server.py[/cyan]",
                    title="❌ Connection Error",
                    border_style="red",
                )
            )
            raise typer.Exit(1)

    kafka_badge = (
        "[green]● Kafka ON[/green]" if data.get("kafka_enabled")
        else "[yellow]○ In-memory mode[/yellow]"
    )
    console.print(
        Panel(
            f"[green]✓[/green] Service : [bold]{data.get('service')}[/bold]\n"
            f"[green]✓[/green] Status  : [bold green]{data.get('status')}[/bold green]\n"
            f"[green]✓[/green] Version : {data.get('version', 'unknown')}\n"
            f"    Streaming: {kafka_badge}",
            title="🏛️  Olympus Health",
            border_style="green",
        )
    )


# ─── Trigger ──────────────────────────────────────────────────────────────────

@app.command()
def trigger(
    repo_url: Optional[str] = typer.Option(None, "--repo-url", "-r", help="GitHub repo URL to clone & fix"),
    repo_name: Optional[str] = typer.Option(None, "--repo-name", help="owner/repo for PR creation (auto-parsed if omitted)"),
    target_file: Optional[str] = typer.Option("", "--target-file", "-f", help="Relative path to the file to patch (auto-detected if omitted)"),
    max_attempts: int = typer.Option(5, "--max-attempts", "-n", help="Maximum patch-retry attempts (1–200)"),
    bug_description: str = typer.Option("CLI trigger", "--desc", "-d", help="Optional bug description"),
    no_stream: bool = typer.Option(False, "--no-stream", help="Print run_id and exit without streaming logs"),
):
    """
    Trigger a self-healing patch pipeline and stream the live logs.

    [dim]Example:[/dim]
        [cyan]olympus trigger --repo-url https://github.com/user/repo --max-attempts 3[/cyan]
    """
    payload = {
        "bug_description": bug_description,
        "target_file":     target_file or "",
        "repo_url":        repo_url or "",
        "repo_name":       repo_name or "",
        "max_attempts":    max_attempts,
    }

    console.print(Panel(
        f"  Repo URL     : [cyan]{repo_url or 'local target_app'}[/cyan]\n"
        f"  Target file  : [cyan]{target_file or 'Auto-detect'}[/cyan]\n"
        f"  Max attempts : [yellow]{max_attempts}[/yellow]",
        title="🚀 Launching Olympus Pipeline",
        border_style="blue",
    ))

    with _client() as client:
        try:
            r = client.post("/api/v1/trigger", json=payload)
            r.raise_for_status()
        except httpx.ConnectError:
            console.print("[red]Cannot connect to backend. Is server running?[/red]")
            raise typer.Exit(1)
        except httpx.HTTPStatusError as e:
            console.print(f"[red]Trigger failed: {e.response.text}[/red]")
            raise typer.Exit(1)

    data = r.json()
    run_id = data["run_id"]
    console.print(f"\n[dim]Run ID:[/dim] [bold yellow]{run_id}[/bold yellow]")

    if no_stream:
        console.print("[dim]Use: [cyan]olympus status {run_id}[/cyan] to check progress.[/dim]")
        return

    _stream_logs(run_id)


# ─── Log streaming ────────────────────────────────────────────────────────────

def _stream_logs(run_id: str):
    """Connect to the SSE stream and pretty-print logs until completion."""
    url = f"{_api_url()}/api/v1/stream/{run_id}"
    console.print(f"\n[dim]Streaming logs from:[/dim] [cyan]{url}[/cyan]\n")

    result = None
    diff   = ""

    try:
        with httpx.Client(timeout=None) as client:
            with client.stream("GET", url) as response:
                for line in response.iter_lines():
                    if not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if not raw:
                        continue
                    try:
                        event = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    if event.get("type") == "log":
                        _print_log_line(event.get("message", ""))
                    elif event.get("type") == "complete":
                        result = event.get("result")
                        diff   = event.get("diff", "")
                        break

    except KeyboardInterrupt:
        console.print("\n[yellow]⚠ Stream interrupted by user.[/yellow]")
        return
    except httpx.ConnectError:
        console.print("[red]Lost connection to backend.[/red]")
        return

    # ─── Final result panel ───────────────────────────────────────────────────
    if result == "PASS":
        console.print(Panel(
            "[bold green]✅ All tests passed — patch applied & PR opened![/bold green]",
            title="🎉 PASS",
            border_style="green",
        ))
    else:
        console.print(Panel(
            "[bold red]❌ Max attempts exhausted — escalated to human review.[/bold red]",
            title="🚨 FAIL",
            border_style="red",
        ))

    if diff:
        console.print("\n[bold]📋 Git Diff (last patch):[/bold]")
        console.print(Syntax(diff, "diff", theme="monokai", line_numbers=False))


def _print_log_line(msg: str):
    """Apply colour coding based on emoji prefixes used by the pipeline."""
    style_map = {
        "✅": "green",
        "🎉": "bold green",
        "❌": "red",
        "🚨": "bold red",
        "⚠️":  "yellow",
        "📡": "cyan",
        "🧠": "magenta",
        "🌲": "green",
        "🔍": "blue",
        "🎯": "blue",
        "🤖": "cyan",
        "🧪": "cyan",
        "📝": "dim",
    }
    colour = "white"
    for emoji, c in style_map.items():
        if msg.startswith(emoji):
            colour = c
            break
    console.print(f"  [{colour}]{msg}[/{colour}]")


# ─── Status ───────────────────────────────────────────────────────────────────

@app.command()
def status(
    run_id: str = typer.Argument(..., help="Run ID returned by `olympus trigger`"),
):
    """
    Stream live logs for an existing run by its run_id.

    [dim]Example:[/dim]
        [cyan]olympus status abc123-...[/cyan]
    """
    console.print(f"[dim]Attaching to run:[/dim] [bold yellow]{run_id}[/bold yellow]\n")
    _stream_logs(run_id)


# ─── History ──────────────────────────────────────────────────────────────────

@app.command()
def history(
    limit: int = typer.Option(20, "--limit", "-n", help="Number of recent runs to show"),
):
    """
    Display recent patch run history from the SQLite audit log.

    [dim]Example:[/dim]
        [cyan]olympus history --limit 30[/cyan]
    """
    with _client() as client:
        try:
            r = client.get("/api/v1/runs", params={"limit": limit})
            r.raise_for_status()
        except httpx.ConnectError:
            console.print("[red]Cannot connect to backend.[/red]")
            raise typer.Exit(1)

    runs = r.json().get("runs", [])
    if not runs:
        console.print("[yellow]No runs recorded yet.[/yellow]")
        return

    table = Table(
        title=f"📜 Olympus Run History (last {len(runs)})",
        box=box.ROUNDED,
        highlight=True,
    )
    table.add_column("ID",          style="dim",         width=6)
    table.add_column("Timestamp",   style="cyan",        width=20)
    table.add_column("Target File", style="white",       width=28)
    table.add_column("Attempt",     justify="center",    width=8)
    table.add_column("Status",      justify="center",    width=8)
    table.add_column("Error (preview)", style="dim",     width=40)

    for run in runs:
        status_text = (
            "[green]PASS[/green]" if run["status"] == "PASS"
            else "[red]FAIL[/red]"
        )
        error_preview = (run.get("error_logs") or "")[:60].replace("\n", " ")
        table.add_row(
            str(run["id"]),
            run["timestamp"],
            os.path.basename(run["target_file"]),
            str(run["attempt"]),
            status_text,
            error_preview,
        )

    console.print(table)


# ─── RAG Query ────────────────────────────────────────────────────────────────

@app.command(name="rag-query")
def rag_query(
    query: str = typer.Argument(..., help="Search query (error log, description, code snippet)"),
    top_k: int = typer.Option(3, "--top-k", "-k", help="Number of results to return"),
    collection: str = typer.Option(
        "codebase_chunks",
        "--collection", "-c",
        help="Collection to search: codebase_chunks | patch_experience",
    ),
):
    """
    Query the RAG knowledge base and display ranked results.

    [dim]Examples:[/dim]
        [cyan]olympus rag-query "ValueError price cannot be negative"[/cyan]
        [cyan]olympus rag-query "FAILED test_calculator" --collection patch_experience --top-k 5[/cyan]
    """
    with _client() as client:
        try:
            r = client.post(
                "/api/v1/rag/query",
                json={"query": query, "top_k": top_k, "collection": collection},
            )
            r.raise_for_status()
        except httpx.ConnectError:
            console.print("[red]Cannot connect to backend.[/red]")
            raise typer.Exit(1)
        except httpx.HTTPStatusError as e:
            console.print(f"[red]RAG query error: {e.response.text}[/red]")
            raise typer.Exit(1)

    data = r.json()
    results = data.get("results", [])

    if not results:
        console.print(
            Panel(
                f"[yellow]No results found in [bold]{collection}[/bold] for query:[/yellow]\n"
                f"  [italic]{query}[/italic]\n\n"
                "[dim]Tip: Run a trigger first to index the codebase.[/dim]",
                border_style="yellow",
            )
        )
        return

    console.print(Panel(
        f"Collection : [cyan]{collection}[/cyan]\n"
        f"Query      : [italic]{query}[/italic]\n"
        f"Results    : [bold]{len(results)}[/bold] chunk(s) (hybrid BM25 + vector)",
        title="🔍 RAG Query Results",
        border_style="blue",
    ))

    for item in results:
        rank = item.get("rank", "?")
        meta = item.get("metadata", {})
        file_name = meta.get("file", "unknown")
        symbol    = meta.get("symbol", "")
        doc       = item.get("document", "")

        label = f"#{rank} — {file_name}" + (f" :: {symbol}" if symbol else "")
        console.print(f"\n[bold blue]{label}[/bold blue]")
        console.print(Syntax(doc, "python", theme="monokai", line_numbers=False))


# ─── Entry point ──────────────────────────────────────────────────────────────

def main():
    app()


if __name__ == "__main__":
    main()
