import os
import tempfile
from pathlib import Path


_test_db_dir = Path(tempfile.mkdtemp(prefix="microevals-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_test_db_dir / 'test.db').as_posix()}"

