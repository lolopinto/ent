import os

async def async_walk(dir):
  dirs, nondirs = [], []
  for entry in os.scandir(dir):
      if entry.is_dir():
          dirs.append(entry.name)
      else:
          nondirs.append(entry.name)

  yield dir, dirs, nondirs

  for d in dirs:
      path = os.path.join(dir, d)
      async for x in async_walk(path):
          yield x
            
            
            
async def delete_py_files(dir):
    async for root, dirs, files in async_walk(dir):
        for file in files:
            if file.endswith('.py'):
                file_path = os.path.join(root, file)
                os.remove(file_path)
