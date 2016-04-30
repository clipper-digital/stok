const bole = require('bole')
const toCommonLogFormat = require('./common-log')
const version = require('../package').version

exports.register = function (server, options, next) {
  server.ext('onRequest', (request, reply) => {
    request.logger = bole(request.id)
    request.timing = {
      start: Date.now()
    }
    reply.continue()
  })

  server.ext('onPreResponse', (request, reply) => {
    const latency = Date.now() - request.timing.start
    request.logger.info(toCommonLogFormat(request, options), `${latency}ms`)
    reply.continue()
  })

  next()
}

exports.register.attributes = {
  name: 'stok-request-logger',
  version: version
}
