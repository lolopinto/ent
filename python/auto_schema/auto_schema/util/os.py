import os
from collections.abc import AsyncGenerator


async def async_walk(root_dir: str) -> AsyncGenerator[tuple[str, list[str], list[str]], None]:
    dirs: list[str] = []
    nondirs: list[str] = []
    for entry in os.scandir(root_dir):
        if entry.is_dir():
            dirs.append(entry.name)
        else:
            nondirs.append(entry.name)

    yield root_dir, dirs, nondirs

    for dir_name in dirs:
        path = os.path.join(root_dir, dir_name)
        async for child in async_walk(path):
            yield child


async def delete_py_files(root_dir: str) -> None:
    async for root, _, files in async_walk(root_dir):
        for file in files:
            if file.endswith('.py'):
                file_path = os.path.join(root, file)
                os.remove(file_path)
