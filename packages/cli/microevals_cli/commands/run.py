"""Run command: executes a batch benchmark dataset or preset across models."""

import asyncio
import os
from pathlib import Path
import click
from microevals_core.batch.engine import BatchEngine
from microevals_core.builtin_presets.loader import TestCaseItem, load_builtin_presets
from microevals_core.runner.openai_runner import OpenAICompatibleRunner


@click.command("run")
@click.argument("target")
@click.option("-m", "--model", "models", multiple=True, required=True, help="Model name(s) to evaluate")
@click.option("--base-url", default="https://api.openai.com/v1", help="API base URL")
@click.option("--api-key", default="", help="API Key (defaults to OPENAI_API_KEY env var)")
@click.option("--concurrency", default=3, type=int, help="Concurrency limit")
def run_cmd(target: str, models: tuple[str, ...], base_url: str, api_key: str, concurrency: int):
    """Run batch evaluation on a preset slug (e.g. 'strawberryeval') or a local file."""
    api_key = api_key or os.getenv("OPENAI_API_KEY", "")

    # Check if target is a preset slug
    presets = load_builtin_presets()
    matching_preset = next((p for p in presets if target.lower() in p.slug.lower() or target.lower() in p.title.lower()), None)

    cases = []
    if matching_preset:
        click.echo(f"Loaded built-in preset: '{matching_preset.title}' ({len(matching_preset.cases)} cases)")
        cases = matching_preset.cases
    elif Path(target).exists():
        import json
        with open(target, "r", encoding="utf-8") as f:
            for idx, line in enumerate(f):
                line = line.strip()
                if not line:
                    continue
                item = json.loads(line)
                cases.append(TestCaseItem(
                    id=f"c_{idx+1}",
                    prompt=item.get("prompt", ""),
                    ground_truth=item.get("ground_truth"),
                ))
        click.echo(f"Loaded {len(cases)} cases from file: {target}")
    else:
        click.echo(f"Error: Target '{target}' is neither an existing file nor a recognized preset slug.")
        return

    async def _run():
        runners = [OpenAICompatibleRunner(model_name=m, base_url=base_url, api_key=api_key) for m in models]
        engine = BatchEngine(concurrency=concurrency)

        click.echo(f"Executing batch run across {len(models)} model(s)...")

        async def on_progress(completed, total, case_res):
            status = {
                "passed": "[PASS]",
                "failed": "[FAIL]",
                "unevaluated": "[UNEVALUATED]",
            }[case_res.verdict]
            click.echo(f"[{completed}/{total}] {case_res.model_name:<16} | {case_res.case_id:<12} | {status}")

        summary = await engine.run_batch(cases=cases, runners=runners, on_progress=on_progress)

        click.echo("\n" + "=" * 70)
        click.echo("BATCH EVALUATION SUMMARY LEADERBOARD")
        click.echo("=" * 70)
        header = f"{'Model':<20} | {'Pass Rate':<10} | {'Avg TTFT':<10} | {'Avg Speed':<12} | {'Total Cost':<10}"
        click.echo(header)
        click.echo("-" * 70)

        for name, s in summary.model_summaries.items():
            pass_rate = f"{s.pass_rate:.1f}%" if s.pass_rate is not None else "N/A"
            total_cost = f"${s.total_cost_usd:.5f}" if s.total_cost_usd is not None else "N/A"
            click.echo(
                f"{name:<20} | {pass_rate:>10} | {s.avg_ttft_ms:>8.0f}ms | {s.avg_tokens_per_second:>8.1f} t/s | {total_cost:>10}"
            )
            click.echo(
                f"  verdicts: {s.passed_cases} passed, {s.failed_cases} failed, "
                f"{s.unevaluated_cases} unevaluated"
            )
        click.echo("=" * 70 + "\n")

    asyncio.run(_run())
