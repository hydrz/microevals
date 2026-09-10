"""Serve command: starts the FastAPI backend server."""

import click
import uvicorn


@click.command("serve")
@click.option("--host", default="127.0.0.1", help="Bind host")
@click.option("--port", default=8000, type=int, help="Port to listen on")
@click.option("--reload", is_flag=True, default=False, help="Enable hot reload")
def serve_cmd(host: str, port: int, reload: bool):
    """Start the MicroEvals backend API server."""
    click.echo(f"Starting MicroEvals API server on http://{host}:{port} ...")
    uvicorn.run("app.main:app", host=host, port=port, reload=reload)
