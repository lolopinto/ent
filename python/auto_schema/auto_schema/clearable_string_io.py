import io

class ClearableStringIO(io.StringIO):
    def clear(self):
        self.seek(0)
        self.truncate(0) 