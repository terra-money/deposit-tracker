import { client as WebSocketClient } from 'websocket'
import axios from 'axios'
import * as http from 'http'
import * as https from 'https'
import * as amino from '@terra-money/amino-js'
import * as Promise from 'bluebird'
import * as config from '../config/config.json'
import * as fs from 'fs'

// Load config vaules
const nodeURL = config['node_url']
const websocketURL = nodeURL.replace('https', 'wss').replace('http', 'ws')
const queryInterval = config['query_interval']
const queryHeightUnit = config['query_height_unit']
const queryPerPage = config['query_per_page']
const startHeight = config['start_height']
const receiverAddress = config['receiver_address']

const ax = axios.create({
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
  timeout: 15000
});

function updateConfig(height: number) {
  const newConfig = config
  newConfig['start_height'] = height
  fs.writeFileSync('config/config.json', JSON.stringify(newConfig, null, 4))
}

// Sequential tracking
async function sequentialTracking() {
  let height = startHeight
  for(;;height += queryHeightUnit) {
    // Update config['start_height'] to new start height to prevent redundant querying
    updateConfig(height)

    const status = (await ax.get(`${nodeURL}/status`))['data']['result']['sync_info']
    const latestHeight = parseInt(status['latest_block_height'], 10)
    console.log(`Current Query Height: ${height}, Latest Height: ${latestHeight}`)
    

    let page = 1
    for(;;page+=1) {
      // To prevent huge memory consumption, restrict query with height range
      const queryParams = `query="tx.height>=${height} AND tx.height<${height+queryHeightUnit} AND action='send' AND recipient='${receiverAddress}'"&page=${page}&per_page=${queryPerPage}`
      const res = (await ax.get(`${nodeURL}/tx_search?${queryParams}`))['data']['result']
      const totalCount = res['total_count']
      const txs = res['txs']
      
      for (const idx in txs) {
        parseAndEmitTx(txs[idx]['tx'])
      }

      // Exit condition
      if (totalCount <= page*100) {
        break
      }
    }
    
    // Exit condition
    if (latestHeight < height + queryHeightUnit) {
      break
    }

    await Promise.delay(queryInterval)
  }
}

// Real-time tracking
function realtimeTracking() {
  const client = new WebSocketClient()

  client.on('connectFailed', (error) => {
    console.log(`Connect Error: ${error.toString()}`);
  });
  
  client.on('connect', (connection) => {
    console.log('WebSocket Client Connected');
    connection.on('error', (error) => {
      console.log(`Connection Error: ${error.toString()}`);
    });
    connection.on('close', () => {
      console.log('echo-protocol Connection Closed');
    });
    connection.on('message', async (message) => {
      if (message.type === 'utf8') {
        if (message.utf8Data) {
  
          try {
            const jsonRes = JSON.parse(message.utf8Data)
            if ( !jsonRes['result'] || !jsonRes['result']['data'] || !jsonRes['result']['tags'] ) return
            const txbytes = jsonRes['result']['data']['value']['TxResult']['tx']
            parseAndEmitTx(txbytes)

            // Update start_height config
            const height = parseInt(jsonRes['result']['tags']['tx.height'], 10)
            updateConfig(height)
          } catch (err) {
            console.error(`Parseing Error: ${err}`)
          }
        }
  
      }
    });
  
    connection.send(JSON.stringify({
      'jsonrpc': '2.0',
      'method': 'subscribe',
      'id': '0',
      'params': {
        'query': `tm.event='Tx' AND action='send' AND recipient='${receiverAddress}'`
      }
    }))
  });
  
  client.connect(`${websocketURL}/websocket`);
}

function parseAndEmitTx(txbytes: string) {
  const bz = amino.base64ToBytes(txbytes)
  const tx = amino.decodeTx(bz, true)
  const jsonTx = JSON.parse(amino.bytesToString(tx))

  // TODO - Do whatever you want
  console.log(jsonTx)
}

function main() {
  sequentialTracking().then(() => {
    realtimeTracking()
  }).catch(err => {
    console.error(err)
  })
}

main()