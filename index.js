'use strict'
let request = require('request')
let util = require('util')
let selectn = require('selectn')

function popSmoke (serviceUrl, message) {
  if (!serviceUrl) {
    throw new Error('popSmoke::serviceUrl is required')
  }
  if (!message) {
    throw new Error('popSmoke::message is required')
  }
  request.post({
    uri: serviceUrl,
    json: true,
    body: { msg: message }
  }, function (err, res, body) {
    if (err) { throw new Error('popSmoke::' + JSON.stringify(err)) }
    console.log('signal sent ' + util.inspect(body))
  })
}

function retreiveIt (opts, done) {
  let self = this
  let headers = null
  let body = null
  request.get(opts)
    .on('response', function (result) {
      headers = result.headers
    })
    .on('data', function (chunk) {
      body = (Buffer.isBuffer(body)) ?
        Buffer.concat([body, new Buffer(chunk)]) : new Buffer(chunk)
    })
    .on('end', function () {
      done(null, {
        headers: headers,
        body: body && body.toString('utf8') || null
      })
    })
    .on('error', function (e) {
      done(e, null)
    })
}

function Watcher (url) {
  var self = this
  let intervalId = null
  let cache = null
  return {
    watch: function (interval, done) {
      if (! interval || ! parseInt(interval)) {
        throw new Error('Watcher::watch : interval must be an integer')
      }
      intervalId = setInterval(function intervalFn () {
        // var etag = (cache && cache.headers && cache.headers.etag) ? cache.headers.etag : 'cold'
        let etag = selectn('headers.etag', cache) || 'cold'
        console.log('ETAG : ', etag)
        retreiveIt({
          method: 'GET',
          url: url,
          headers: {
            'If-None-Match': etag
          }
        }, function (e, r) {
          if (e) {
            throw new Error('watch::retreiveIt : ' +
              e + ' ' + JSON.stringify(e))
          }
          // console.log('cache ' + util.inspect(cache))
          // console.log('r.headers ' + util.inspect(r.headers))
          // are we done and not bootstrapping
          if (etag !== r.headers.etag && etag !== 'cold') {
            console.log('DONE!')
            clearInterval(intervalId)
            return done(null, r)
          }
          cache = r
        })
        return intervalFn
      }(), interval)
    }
  }
}

let slackUrl = process.env.SLACK_URL
let msg = 'http://starfighters.io was updated'
let w = new Watcher('http://starfighters.io')
w.watch(300000, function (e, r) {
  if (e) { throw new Error(e); } else {
    console.log(msg + JSON.stringify(r.headers))
    popSmoke(slackUrl, msg + ' ' + JSON.stringify(r.headers))
  }
})
