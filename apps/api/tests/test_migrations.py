from sqlalchemy import create_engine, text

from app.core.migrations import MIGRATIONS, Migration, run_migrations


def test_migrations_run_once_in_version_order():
    engine = create_engine("sqlite:///:memory:")
    calls: list[int] = []

    migrations = [
        Migration(1, "first", lambda conn: calls.append(1)),
        Migration(2, "second", lambda conn: calls.append(2)),
    ]

    assert run_migrations(engine, migrations) == [1, 2]
    assert run_migrations(engine, migrations) == []
    assert calls == [1, 2]

    with engine.connect() as conn:
        versions = conn.execute(
            text("SELECT version FROM schema_migrations ORDER BY version")
        ).scalars().all()
    assert versions == [1, 2]


def test_evaluation_reset_migration_preserves_providers():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE providers (id TEXT PRIMARY KEY)"))
        conn.execute(text("CREATE TABLE datasets (id TEXT PRIMARY KEY)"))
        conn.execute(text("CREATE TABLE test_cases (id TEXT PRIMARY KEY)"))
        conn.execute(text("CREATE TABLE eval_runs (id TEXT PRIMARY KEY)"))
        conn.execute(text("INSERT INTO providers VALUES ('provider-1')"))
        conn.execute(text("INSERT INTO datasets VALUES ('dataset-1')"))
        conn.execute(text("INSERT INTO test_cases VALUES ('case-1')"))
        conn.execute(text("INSERT INTO eval_runs VALUES ('run-1')"))

    run_migrations(engine, MIGRATIONS)

    with engine.connect() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM providers")).scalar_one() == 1
        assert conn.execute(text("SELECT COUNT(*) FROM datasets")).scalar_one() == 0
        assert conn.execute(text("SELECT COUNT(*) FROM test_cases")).scalar_one() == 0
        assert conn.execute(text("SELECT COUNT(*) FROM eval_runs")).scalar_one() == 0
