from typing import Any, TextIO

# set in runner.Runner.__init__
metadata: Any | None = None
connection: Any | None = None
# set in Runner.progressive_sql
output_buffer: TextIO | None = None
# dev branch schema support (set in Runner.__init__)
schema_name: str | None = None
include_public: bool | None = None
