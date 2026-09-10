"""Compare command: runs a prompt across multiple models and prints a terminal comparison table."""

import asyncio
import os
import click
from microevals_core.runner.openai_runner import OpenAICompatibleRunner


@click.command("compare")
@click.argument("prompt")
@click.option("-m", "--model", "models", multiple=True, required=True, help="Model name(s) to evaluate")
@click.option("--base-url", default="https://api.openai.com/v1", help="API base URL")
@click.option("--api-key", default="", help="API Key (defaults to OPENAI_API_KEY env var)")
@click.option("--temperature", default=0.7, type=float, help="Sampling temperature")
def compare_cmd(prompt: str, models: tuple[str, ...], base_url: str, api_key: str, temperature: float):
    """Run PROMPT across multiple models side-by-side with latency, TPS, and cost."""
    api_key = api_key or os.getenv("OPENAI_API_KEY", "")

    async def _run():
        runners = [OpenAICompatibleRunner(model_name=m, base_url=base_url, api_key=api_key) for m in models]
        click.echo(f"\n🚀 Running prompt across {len(runners)} models...\nPrompt: \"{prompt}\"\n")

        tasks = [r.generate([{"role": "user", "content": prompt}]) for r in runners]
        results = await asyncio.gather(*tasks)

        # Print comparison table
        header = f"{'Model':<24} | {'TTFT':<10} | {'Latency':<10} | {'Speed':<12} | {'Tokens':<10} | {'Cost':<10}"
        click.echo("-" * len(header))
        click.echo(header)
        click.echo("-" * len(header))

        for res in results:
            m = res.metrics
            speed_str = f"{m.tokens_per_second:.1f} t/s"
            ttft_str = f"{m.ttft_ms:.0f}ms"
            lat_str = f"{m.total_latency_s:.2f}s"
            tok_str = f"{m.output_tokens} tok"
            cost_str = f"${m.estimated_cost_usd:.5f}" if m.estimated_cost_usd is not None else "N/A"
            click.echo(f"{m.model_name:<24} | {ttft_str:<10} | {lat_str:<10} | {speed_str:<12} | {tok_str:<10} | {cost_str:<10}")

        click.echo("-" * len(header))

    asyncio.run(_run())
