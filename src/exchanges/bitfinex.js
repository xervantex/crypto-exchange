const Api = require('bitfinex')
const _ = require('lodash')

/**
 * NOTE: Bittrex API returns pairs in "quote-base" order.
 */

class Bitfinex {

  constructor({ key, secret }) {
    this.bitfinex = new Api(key, secret)
  }

  // Public Methods

  ticker(pair) {
    return new Promise((resolve, reject) => {
      pair = _.reduce(Bitfinex.alts, (value, sym, alt) => value.replace(sym, alt), pair)
      pair = pair.replace('_','')
      this.bitfinex.ticker(pair,
        (err, tick) => {
          if(err) {
            reject(err.message)
          } else {
            let { last_price, ask, bid, high, low, volume, timestamp } = tick
            resolve({
              last: parseFloat(last_price),
              ask: parseFloat(ask),
              bid: parseFloat(bid),
              high: parseFloat(high),
              low: parseFloat(low),
              volume: parseFloat(volume),
              timestamp: Math.floor(parseFloat(timestamp) * 1000)
            })
          }
        })
    })
  }

  assets() {
    return new Promise((resolve, reject) => {
      this.pairs()
        .then( pairs => {
          let alt, assets = _.reduce(pairs, (result, p) => result.concat(p.split('_')), [])
          assets = _.uniq(assets)
          assets = _.map(assets, a => (alt = Bitfinex.alts[a]) ? alt : a)
          resolve(assets)
        })
        .catch(reject)
    })
  }

  pairs() {
    return new Promise((resolve, reject) => {
      this.bitfinex.get_symbols(
        (err, pairs) => {
          if(err)
            return reject(err.message)

          pairs = _.map(pairs, pair => {
            pair = pair.replace(/(.{3})(.{3})/, '$1_$2').toUpperCase()
            pair = _.reduce(Bitfinex.alts, (value, sym, alt) => value.replace(alt, sym), pair)
            return pair
          })
          resolve(pairs)
        })
    })
  }

  depth(pair, count=50) {
    return new Promise((resolve, reject) => {
      pair = _.reduce(Bitfinex.alts, (value, sym, alt) => value.replace(sym, alt), pair)
      pair = pair.replace('_','')
      this.bitfinex.orderbook(pair, { limit_asks: count, limit_bids: count },
        (err, depth) => {
          if(err) {
            reject(err.message)
          } else {
            _.each(depth, (entries, type) => {
              depth[type] = _.map(entries, entry => {
                return [
                  parseFloat(entry.price),
                  parseFloat(entry.amount)
                ]
              })
            })
            resolve(depth)
          }
        })
    })
  }

  // Authenticated Methods

  buy() {
    return privateMethods.addOrder.apply(this, ['buy', ...arguments])
  }

  sell() {
    return privateMethods.addOrder.apply(this, ['sell', ...arguments])
  }

  balances() {
    return new Promise((resolve, reject) => {
      this.bitfinex.wallet_balances(
        (err, balances) => {
          if(err) {
            reject(err.message)
          } else {
            balances = _.filter(balances, b => b.type === 'exchange')
            balances = _.reduce(balances, (result, b) => {
              let asset = b.currency.toUpperCase()
              asset = (alt = Bitfinex.alts[asset]) ? alt : asset
              let balance = parseFloat(b.amount)
              let available = parseFloat(b.available)

              result[asset] = {
                balance,
                available,
                pending: balance - available
              }

              return result
            }, {})
            resolve(balances)
          }
        })
    })
  }

  address(asset) {
    return new Promise((resolve, reject) => {
      asset = _.reduce(Bitfinex.alts, (value, sym, alt) => value.replace(sym, alt), asset)
      let method = Bitfinex.methods[asset]
      if(method) {
        this.bitfinex.new_deposit(null, method, 'exchange',
          (err, response) => {
            if(err){
              reject(err.message)
            } else {
              resolve(response.address)
            }
          })
      } else {
        reject(`Cannot deposit ${asset}.`)
      }
    })
  }

}

module.exports = Bitfinex

Bitfinex.alts = {
  'DSH': 'DASH'
}

Bitfinex.methods = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'ETC': 'ethereumc',
  'LTC': 'litecoin',
  'ZEC': 'zcash',
  'XEM': 'monero',
  'IOTA': 'iota'
}

const privateMethods = {

  addOrder(type, pair, amount, rate) {
    return new Promise((resolve, reject) => {
      pair = _.reduce(Bitfinex.alts, (value, sym, alt) => value.replace(sym, alt), pair)
      pair = pair.replace('_','')
      amount = amount.toString()
      rate = rate.toString()
      this.bitfinex.new_order(pair, amount, rate, 'bitfinex', type, 'limit',
        (err, res) => {
          if(err) {
            reject(err.message)
          } else {
            resolve(res)
          }
        })
    })
  }

}
