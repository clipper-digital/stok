'use strict'

const bole = require('bole')
const version = require('../package').version

function hrtimeToMs (hrtime) {
  return hrtime[0] * 1e3 + hrtime[1] / 1e6
}

exports.register = function (server, options, next) {
  server.ext('onRequest', (request, reply) => {
    request.logger = bole(request.id)
    request.timing = {
      start: process.hrtime()
    }
    reply.continue()
  })

  server.ext('onPreResponse', (request, reply) => {
    request.timing.latency = process.hrtime(request.timing.start)
    reply.continue()
  })

  server.on('response', (request) => {
    request.timing.duration = process.hrtime(request.timing.start)
    const rawRequest = request.raw.req

    let clientIp = request.info.remoteAddress
    if (options && options.ipHeader && request.headers[options.ipHeader]) {
      clientIp = request.headers[options.ipHeader]
    }

    const duration = hrtimeToMs(request.timing.duration)
    // `onPreResponse` won't be called if the client disconnects or `reply.close()` is called.
    // In these cases the latency won't be set, so we use the full duration as the latency.
    const latency = hrtimeToMs(request.timing.latency || request.timing.duration)
    const method = rawRequest.method
    const path = rawRequest.url
    const protocol = 'HTTP/' + rawRequest.httpVersion
    const statusCode = request.response.statusCode || request.response.output.statusCode
    const userAgent = request.headers['user-agent']

    request.logger.info(
      { clientIp, duration, latency, method, path, protocol, statusCode, userAgent },
      'HTTP request'
    )
  })

  next()
}

exports.register.attributes = {
  name: 'stok-request-logger',
  version: version
}
