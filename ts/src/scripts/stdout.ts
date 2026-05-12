export async function writeJSONToStdout(value: unknown): Promise<void> {
  await writeToStdout(JSON.stringify(value));
}

async function writeToStdout(payload: string): Promise<void> {
  // Bun can exit before a large piped stdout write is fully consumed.
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(payload, (err?: Error | null) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}
