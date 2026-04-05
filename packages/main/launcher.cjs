(async () => {
  try {
    await import('./dist/mainBackend.js');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
