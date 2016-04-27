'use strict'

// Based on hapi-common-log
// https://github.com/rockbot/hapi-common-log
//
// Copyright (c) 2014, Raquel Vélez <raquel@rckbt.me>
//
// Permission to use, copy, modify, and/or distribute this software for any
// purpose with or without fee is hereby granted, provided that the above
// copyright notice and this permission notice appear in all copies.
//
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
// WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
// ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
// WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
// ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
// OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

const moment = require('moment-tokens')

function toCommonLogFormat (request, options) {
  const rawRequest = request.raw.req

  const method = rawRequest.method
  const path = rawRequest.url
  const httpProtocol = rawRequest.client
    ? rawRequest.client.npnProtocol
    : 'HTTP/' + rawRequest.httpVersion

  let clientIp = request.info.remoteAddress
  if (options && options.ipHeader && request.headers[options.ipHeader]) {
    clientIp = request.headers[options.ipHeader]
  }

  const clientId = '-'
  const userId = request.id
  const time = '[' + moment().strftime('%d/%b/%Y:%H:%M:%S %z') + ']'
  const requestLine = '"' + [method, path, httpProtocol].join(' ') + '"'
  const statusCode = request.response.statusCode || request.response.output.statusCode
  const objectSize = '-'

  return [clientIp, clientId, userId, time, requestLine, statusCode, objectSize].join(' ')
}

module.exports = toCommonLogFormat
