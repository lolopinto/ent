import subprocess
import sys

import pytest


@pytest.mark.parametrize("mode", ["--all_sql", "--run_and_all_sql"])
@pytest.mark.parametrize("fails", [False, True])
def test_snapshot_cli_exit_status(mode, fails):
    # Exercise main in another interpreter: catching an exception in-process
    # does not establish the status returned to a shell or console entry point.
    script = f'''
from unittest.mock import Mock, patch
from auto_schema.cli import main
runner = Mock()
if {fails!r}:
    runner.all_sql.side_effect = ValueError("missing extension dependency metadata")
with patch("sys.argv", ["auto_schema", "-s", ".", "-e", "postgresql://unused", {mode!r}]), \\
     patch("auto_schema.cli.import_module"), \\
     patch("auto_schema.cli.Runner.from_command_line", return_value=runner):
    main()
runner.all_sql.assert_called_once()
'''
    result = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True)
    assert result.returncode == (1 if fails else 0)
    assert result.stdout == ""
    if fails:
        assert "auto_schema error: missing extension dependency metadata" in result.stderr
    else:
        assert result.stderr == ""
