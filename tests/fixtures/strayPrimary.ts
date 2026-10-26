export {};
if (!process.env.CLUSTER_ROLE) process.on('SIGUSR2', () => {
  setTimeout(() => { throw new Error('planted stray exception in the primary'); });
  void Promise.reject(new Error('planted stray rejection in the primary'));
});

await import('../../src/server/main');
