"""Main CLI group."""

import click
from microevals_cli.commands.compare import compare_cmd
from microevals_cli.commands.run import run_cmd
from microevals_cli.commands.serve import serve_cmd


@click.group()
@click.version_option(version="0.1.0", prog_name="microevals")
def cli():
    """MicroEvals: LLM Benchmarking & Evaluation Toolkit."""
    pass


cli.add_command(compare_cmd)
cli.add_command(run_cmd)
cli.add_command(serve_cmd)


if __name__ == "__main__":
    cli()
