from click.testing import CliRunner
from microevals_cli.main import cli

def test_cli_help():
    runner = CliRunner()
    result = runner.invoke(cli, ["--help"])
    assert result.exit_code == 0
    assert "compare" in result.output
    assert "run" in result.output
    assert "serve" in result.output

def test_cli_compare_help():
    runner = CliRunner()
    result = runner.invoke(cli, ["compare", "--help"])
    assert result.exit_code == 0
    assert "--model" in result.output

def test_cli_run_help():
    runner = CliRunner()
    result = runner.invoke(cli, ["run", "--help"])
    assert result.exit_code == 0
    assert "TARGET" in result.output
