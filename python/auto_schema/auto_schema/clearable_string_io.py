import io

class ClearableStringIO(io.StringIO):
    
    def __init__(self, initial_value: str | None = None, newline: str | None = None) -> None:
        super().__init__(initial_value, newline)
        self.chunks = []
        if initial_value is not None:
            self.chunks.append(initial_value)
    
    def write(self, s):
        super().write(s)
        self.chunks.append(s)

    def clear(self):
        self.seek(0)
        self.truncate(0) 
        self.chunks = []
        
    def chunk_len(self):
        return len(self.chunks)
    
    def get_chunk(self, i):
        return self.chunks[i]