/*
  Simple compact HTTP library in vanilla Node.js
  Ben Coleman, 2020
*/

const URL = require('url')

module.exports = class HTTP {
  baseUrl = ''
  auth = null
  baseHeaders = {}
  parseResults = true
  checkStatus = true
  debug = false

  constructor(base, parseResults = true, auth = null, headers = {}, checkStatus = true) {
    this.baseUrl = base
    this.parseResults = parseResults
    this.checkStatus = checkStatus

    if (auth) {
      if (!auth.creds) throw 'HTTP error: auth creds must be set to `token` or `user:password`'
      switch (auth.type.toLowerCase()) {
        case 'bearer':
          this.baseHeaders = { Authorization: `Bearer ${auth.creds}`, ...headers }
          break
        case 'basic':
          let basicAuthBuff = Buffer.from(auth.creds)
          this.baseHeaders = { Authorization: `Basic ${basicAuthBuff.toString('base64')}`, ...headers }
          break
        default:
          throw "HTTP error: auth type must be 'basic' or 'bearer'"
      }
    } else {
      this.baseHeaders = headers
    }
  }

  // HTTP GET wrapper
  async get(path, headers = {}) {
    return await this.request(path, 'GET', headers)
  }

  // HTTP POST wrapper
  async post(path, data, contentType = 'application/json', headers = {}) {
    const reqBody = typeof data == 'object' ? JSON.stringify(data) : data
    return await this.request(path, 'POST', { 'Content-Type': contentType, ...headers }, reqBody)
  }

  // HTTP PUT wrapper
  async put(path, data, contentType = 'application/json', headers = {}) {
    const reqBody = typeof data == 'object' ? JSON.stringify(data) : data
    return await this.request(path, 'PUT', { 'Content-Type': contentType, ...headers }, reqBody)
  }

  // HTTP DELETE wrapper
  async delete(path, data, contentType = 'application/json', headers = {}) {
    const reqBody = typeof data == 'object' ? JSON.stringify(data) : data
    return await this.request(path, 'DELETE', { 'Content-Type': contentType, ...headers }, reqBody)
  }

  // Generic low level HTTP request wrapped as a promise
  request(path, method = 'GET', headers = {}, reqBody = null) {
    let req = URL.parse(`${this.baseUrl}${path}`)
    req.headers = { ...this.baseHeaders, ...headers }
    req.method = method

    return new Promise((resolve, reject) => {
      const httpLib = req.protocol && req.protocol.startsWith('https') ? require('https') : require('http')

      if (reqBody) {
        req.headers['Content-Length'] = reqBody.length
      }

      if (this.debug) console.log('### HTTP client request:', req, '\n### HTTP client body:', reqBody)

      const request = httpLib.request(req, (response) => {
        let body = []
        response.on('data', (chunk) => body.push(chunk))
        response.on('end', () => {
          let data
          try {
            data = this.parseResults ? JSON.parse(body.join('')) : body.join('')
          } catch (err) {
            reject(`JSON parsing of response body failed  - ${err}`)
          }

          // Our custom response result wrapper, with Axios like fields
          const resp = {
            headers: response.headers,
            status: response.statusCode,
            statusText: response.statusMessage,
            data,
          }

          if (this.debug) console.log(`### HTTP client response:`, resp)
          if (this.checkStatus && (response.statusCode < 200 || response.statusCode > 299)) {
            console.error('Error! Request failed with status code: ' + response.statusCode)
            reject(resp)
          }
          resolve(resp)
        })
      })

      request.on('error', (err) => reject(err))
      if (reqBody) request.write(reqBody)
      request.end()
    })
  }
}
