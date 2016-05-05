const bole = require('bole')

function createLogger (name) {
  return bole(name)
}

function logLevel (level) {
  bole.reset()
  bole.output({
    level: level,
    stream: process.stdout
  })
}

// Default to the info log level, but allow future calls to `logLevel()`
// to change this at any time. Don't set a default log level when running
// tests to avoid lots of noise in the middle of the test results.
if (!process.env.STOK_TEST_MODE) {
  logLevel('info')
}

exports.createLogger = createLogger
exports.logLevel = logLevel
