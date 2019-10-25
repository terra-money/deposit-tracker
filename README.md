# Deposit Tracker

After loading all deposit txs of `receiver_address` from `start_height`, subscribe websocket to track real-time deposit tracking. The users can add their logic to `parseAndEmitTx` function like webhook to deliver txs.

## Install
```
$ git clone https://github.com/terra-project/deposit-tracker
```

## Install depencancies
```
$ yarn
```

## Start tracking
```
$ yarn start
```

## Configs
```
{
    "node_url": "http://127.0.0.1:26657", // full node url for rpc quering
    "query_interval": 500,                // query delay (ms)
    "query_height_unit": 100,             // # of block range per each query; ex) 100~200, 200~300
    "query_per_page": 100,                // # of txs(= page size) to prevent huge response
    "start_height": 1880650,              // tracking start point; it can be past block height
    "receiver_address": "terra13u66u4knssnws7n7w0n38mzyyqak5ygp807gyl" // tracking target address
}
```