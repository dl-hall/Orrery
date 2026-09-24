// Runs against the Edge already installed on this machine: no browser download needed.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 30000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    channel: 'msedge',
    viewport: { width: 1600, height: 900 },
    reducedMotion: 'reduce',
    acceptDownloads: true,
  },
});
