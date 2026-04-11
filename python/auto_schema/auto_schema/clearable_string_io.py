import io


class ClearableStringIO(io.StringIO):
    def __init__(self, initial_value: str | None = None, newline: str | None = None) -> None:
        normalized_initial_value = initial_value or ""
        super().__init__(normalized_initial_value, newline)
        self.chunks: list[str] = []
        if normalized_initial_value:
            self.chunks.append(normalized_initial_value)

    def write(self, s: str) -> int:
        written = super().write(s)
        self.chunks.append(s)
        return written

    def clear(self) -> None:
        self.seek(0)
        self.truncate(0)
        self.chunks = []

    def chunk_len(self) -> int:
        return len(self.chunks)

    def get_chunk(self, i: int) -> str:
        return self.chunks[i]
