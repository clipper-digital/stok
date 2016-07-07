const bole = require('bole')
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
    const now = Date.now()
    const rawRequest = request.raw.req

    let clientIp = request.info.remoteAddress
    if (options && options.ipHeader && request.headers[options.ipHeader]) {
      clientIp = request.headers[options.ipHeader]
    }

    const latency = now - request.timing.start
    const method = rawRequest.method
    const path = rawRequest.url
    const protocol = rawRequest.client
      ? rawRequest.client.npnProtocol
      : 'HTTP/' + rawRequest.httpVersion
    const statusCode = request.response.statusCode || request.response.output.statusCode
    const userAgent = request.headers['user-agent']

    request.logger.info(
      { clientIp, latency, method, path, protocol, statusCode, userAgent },
      'HTTP request'
    )
    reply.continue()
  })

  next()
}

exports.register.attributes = {
  name: 'stok-request-logger',
  version: version
}
