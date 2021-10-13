const { EventEmitter } = require('events')
const { WebSocket } = require('ws')

class DestinyGGClient extends EventEmitter {
  constructor(opts = {}) {
    super()

    this._wsHeaders = DestinyGGClient._createWSHeaders(opts)

    this._wsTimeout = opts.timeout || 20_000

    this._url = opts.url || 'wss://chat.destiny.gg/ws'

    this._reconnect = typeof opts.reconnect === 'boolean' ? opts.reconnect : true

    this._createConnection()
  }

  _createConnection() {
    clearTimeout(this._pingTimeout)

    this._conn = new WebSocket(this._url, {
      perMessageDeflate: false,
      headers: this._wsHeaders
    })

    this._conn.on('open', () => {
      this._wsHeartbeat()

      this.emit('open')
    })


    this._conn.on('close', (closeCode, msg) => {
      this.emit('close')

      this._afterClose()
    })
    
    this._conn.on('message', (data) => {
    
      const { type, obj } = DestinyGGClient._parseWebSocketMessage(data)
      if (!type) {
        console.error('Could not parse message!', typeof data, data)
        return
      }
    
      switch (type) {
        case 'BROADCAST':
        case 'MUTE':
        case 'UNMUTE':
        case 'BAN':
        case 'UNBAN':
        case 'SUBONLY':
        case 'NAMES':
        case 'JOIN':
        case 'QUIT':
          break
        case 'PING': // Should never get here.
          this._conn.send(DestinyGGClient._encodeMessage('PONG', obj))
          break
        case 'ERR':
          switch (obj.description) {
            case 'toomanyconnections':
            case 'needlogin':
            case 'nopermission':
            case 'banned':
              this.emit('error', obj.description)
              break
            case 'muted':
              this.emit('error', 'muted', obj.muteTimeLeft)
              break
            default:
              console.error('Encountered unknown error!', type, obj)
              break
          }

          const closeTypes = [
            'banned'
          ]
    
          if (closeTypes.includes(obj.description)) {
            this._softClose()
          }
          break
        case 'MSG':
          this.emit('message', obj.nick, obj.data, obj.features)
          break
        default:
          console.error('Unhandled message type!', type, obj)
          break
      }
    })
    
    this._conn.on('ping', (data) => {
      this._wsHeartbeat()
    })
    
    this._conn.on('pong', function(data) {
    })
    
    this._conn.on('error', function(err) {
      console.error('Error occurred!', err)
    })
  }

  static _encodeMessage(msgType, jsonObj) {
    return `${msgType} ${JSON.stringify(jsonObj)}`
  }

  static _encodeSendMessage(msg) {
    return DestinyGGClient._encodeMessage('MSG', { data: msg })
  }
  
  static _createWSHeaders(opts) {
    const headers = {}
    if (opts.sid) {
      headers['Cookie'] = `sid=${opts.sid}`
    } else if (opts.authtoken) {
      headers['Cookie'] = `authtoken=${opts.authtoken}`
    }

    return headers
  }

  _wsHeartbeat() {
    clearTimeout(this._pingTimeout)
  
    this._pingTimeout = setTimeout(() => {
      console.error('Ping timed out! Terminating connection.')
      this._conn.terminate()
      this._afterClose()
    }, this._wsTimeout)
  }

  _softClose() {
    this._conn.close()
  }

  _afterClose() {
    this._conn = null
    if (this_reconnect) {
      this._createConnection()
    }
  }

  static _parseWebSocketMessage(data) {
    if (typeof data === 'undefined') {
      console.error('Undefined data!')
      return undefined
    }

    if (typeof data !== 'string') {
      if (typeof data !== 'object') {
        console.error('Data is not an object!')
        return undefined
      }

      data = data.toString()
    }

    const supportedMsgTypes = [
      // Dunno about these, just copied
      'PING',
      'PONG',
      'PRIVMSG',

      'ERR',

      'BROADCAST',

      'MUTE',
      'UNMUTE',
      'BAN',
      'UNBAN',

      'SUBONLY',

      'NAMES',

      'MSG',

      'JOIN',
      'QUIT'
    ]

    for (const type of supportedMsgTypes) {
      if (data.startsWith(type)) {
        let obj = undefined
        try {
          obj = JSON.parse(data.substring(type.length))
        } catch (e) {
          console.error('Failed to parse JSON from string!', data, e)
          return null
        }

        return { type, obj }
      }
    }

    console.error('Encountered unknown message!', data)
    return null
  }

  close() {
    this._softClose()
  }

  message(msg) {
    this._conn.send(DestinyGGClient._encodeSendMessage(msg))
  }

  get connected() {
    return this._conn && this._conn.readyState === WebSocket.OPEN
  }
}

module.exports = DestinyGGClient
