# Destiny.gg Chat Client

## Usage

```javascript
const DestinyGGClient = require('destiny.gg-chat')

const client = new DestinyGGClient({
  url: 'wss://chat.destiny.gg/ws',
  reconnect: true,
  timeout: 20000,
  authtoken: 'PUT_AUTHTOKEN_HERE',
  sid: '' // Session id (alternative to authtoken)
})

client.on('open', function() {
  client.message('Hello world!')
})

client.on('message', function(nick, msg, features) {
  client.message(`${nick} you said ${msg}`)
})

client.on('error', function(reason) {
  if (reason === 'banned') {
    console.log('I was banned :(')
  } else if (reason === 'muted') {
    client.close()
  }
})

client.on('close', function() {
  console.log('This is false:', this.connected)
})
```
