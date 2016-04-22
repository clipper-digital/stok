function proxy (object, method, proxyFn) {
  const original = object[method]
  object[method] = proxyFn(function () {
    return original.apply(object, arguments)
  })
}

exports.proxy = proxy
