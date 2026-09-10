"""Small, versioned database migrations for the local SQLite store."""

from collections.abc import Callable, Sequence
from dataclasses import dataclass

from sqlalchemy import Engine, text
from sqlalchemy.engine import Connection


@dataclass(frozen=True)
class Migration:
    version: int
    name: str
    apply: Callable[[Connection], None]


def _provider_columns(conn: Connection) -> set[str]:
    rows = conn.execute(text("PRAGMA table_info(providers)")).fetchall()
    return {str(row[1]) for row in rows}


def _add_provider_connection_fields(conn: Connection) -> None:
    columns = _provider_columns(conn)
    if not columns:
        return
    if "timeout_seconds" not in columns:
        conn.execute(text("ALTER TABLE providers ADD COLUMN timeout_seconds INTEGER DEFAULT 60"))
    if "custom_headers_json" not in columns:
        conn.execute(text("ALTER TABLE providers ADD COLUMN custom_headers_json TEXT DEFAULT '{}'"))


def _add_provider_model_pricing(conn: Connection) -> None:
    columns = _provider_columns(conn)
    if columns and "model_pricing_json" not in columns:
        conn.execute(text("ALTER TABLE providers ADD COLUMN model_pricing_json TEXT DEFAULT '{}'"))


def _expand_evaluation_runs(conn: Connection) -> None:
    rows = conn.execute(text("PRAGMA table_info(eval_runs)")).fetchall()
    columns = {str(row[1]) for row in rows}
    if not columns:
        return
    additions = {
        "source_type": "TEXT",
        "source_id": "TEXT",
        "source_title": "TEXT DEFAULT ''",
        "source_snapshot_json": "TEXT DEFAULT '[]'",
        "config_json": "TEXT DEFAULT '{}'",
        "started_at": "INTEGER DEFAULT 0",
        "finished_at": "INTEGER",
        "termination_reason": "TEXT",
        "retry_of_run_id": "TEXT",
    }
    for name, definition in additions.items():
        if name not in columns:
            conn.execute(text(f"ALTER TABLE eval_runs ADD COLUMN {name} {definition}"))


def _reset_legacy_evaluation_data(conn: Connection) -> None:
    for table_name in ("test_cases", "eval_runs", "datasets"):
        exists = conn.execute(
            text("SELECT 1 FROM sqlite_master WHERE type='table' AND name=:name"),
            {"name": table_name},
        ).scalar()
        if exists:
            conn.execute(text(f"DELETE FROM {table_name}"))


def _expand_datasets(conn: Connection) -> None:
    rows = conn.execute(text("PRAGMA table_info(datasets)")).fetchall()
    columns = {str(row[1]) for row in rows}
    if not columns:
        return
    if "updated_at" not in columns:
        conn.execute(text("ALTER TABLE datasets ADD COLUMN updated_at INTEGER DEFAULT 0"))
    if "source_preset_id" not in columns:
        conn.execute(text("ALTER TABLE datasets ADD COLUMN source_preset_id TEXT"))


MIGRATIONS: tuple[Migration, ...] = (
    Migration(1, "add-provider-connection-fields", _add_provider_connection_fields),
    Migration(2, "add-provider-model-pricing", _add_provider_model_pricing),
    Migration(3, "expand-evaluation-runs", _expand_evaluation_runs),
    Migration(4, "reset-legacy-evaluation-data", _reset_legacy_evaluation_data),
    Migration(5, "expand-datasets", _expand_datasets),
)


def run_migrations(
    engine: Engine,
    migrations: Sequence[Migration] = MIGRATIONS,
) -> list[int]:
    """Apply each pending migration once and return the applied versions."""
    applied: list[int] = []
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS schema_migrations ("
                "version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
                ")"
            )
        )
        completed = set(
            conn.execute(text("SELECT version FROM schema_migrations")).scalars().all()
        )
        for migration in sorted(migrations, key=lambda item: item.version):
            if migration.version in completed:
                continue
            migration.apply(conn)
            conn.execute(
                text(
                    "INSERT INTO schema_migrations (version, name) "
                    "VALUES (:version, :name)"
                ),
                {"version": migration.version, "name": migration.name},
            )
            applied.append(migration.version)
    return applied
