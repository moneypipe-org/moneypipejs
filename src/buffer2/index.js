const factory_abi = require('./abi/factory.js')
const BigNumber = require('bignumber.js');
const buffer_abi = require('./abi/buffer2.js')
const ipfsh = require('ipfsh')
const constants = require("./constants")
const Merklescript = require('merklescript')
const retry = require('async-retry');
const axios = require('axios')
class buffer {
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  //  # In the browser
  //  const buffer = new Moneypipe.buffer({
  //    web3: new Web3(window.ethereum),      // required
  //    network: "rinkeby",
  //    ipfs: async (json) => {               // required. a function to PIN json to IPFS and return cid
  //      let cid = await fetch("https://microipfs.com/add", {
  //        method: "post",
  //        headers: { "Content-Type": "application/json" },
  //        body: JSON.stringify({
  //          object: json
  //        })
  //      }).then((r) => {
  //        return r.json()
  //      }).then((r) => {
  //        return r.success
  //      })
  //      return cid
  //    }
  //  })
  // 
  //  # Node.js
  //  const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
  //  const buffer = new Moneypipe.buffer({
  //    key: privateKey,                      // required for node.js
  //    web3: createAlchemyWeb3(API_URL),     // required
  //    network: "rinkeby",
  //    ipfs: async (json) => {               // required. a function to PIN json to IPFS and return cid
  //      let cid = await fetch("https://microipfs.com/add", {
  //        method: "post",
  //        headers: { "Content-Type": "application/json" },
  //        body: JSON.stringify({
  //          object: json
  //        })
  //      }).then((r) => {
  //        return r.json()
  //      }).then((r) => {
  //        return r.success
  //      })
  //      return cid
  //    }
  //  })
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  constructor(o) {
    this.ipfs = o.ipfs;
    this.web3 = o.web3;
    this.key = o.key;
    this.network = (o.network ? o.network : "main");
    this.abi = {
      factory: factory_abi,
      buffer: buffer_abi
    }
    this.factory = new this.web3.eth.Contract(factory_abi, constants.factory[this.network]);
    this.constants = constants
  }
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  //    let { tx, address } = await buffer.create({
  //      index: 0,
  //      title: "testing",
  //      members: [{
  //        account: addr1,
  //        value: 1
  //      }, {
  //        account: addr2,
  //        value: 3
  //      }, {
  //        account: addr3,
  //        value: 6
  //      }]
  //    })
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  async create(o) {
    await this.checkNetwork()
    let { title, members, index } = o
    let total = 0;
    for(let member of members) {
      total += member.value
    }
    let values = members.map((member) => {
      return [
        member.account,
        Math.floor((member.value / total) * Math.pow(10, 12))
      ]
    })
    // convert to merkle tree
    const s = {
      title,
      types: ["address", "uint256"],
      values: values
    }
    const cid = await this.ipfs({ merklescript: s })
    // wait until the file is found on ipfs
    // must not create a transaction unless the merkle tree is absolutely stored on IPFS
    let r = await retry(
      async(bail, num) => {
        console.log("trying to fetch merklescript from IPFS...", cid)
        let url = constants.ipfs.replace("{{cid}}", cid)
        let merklescript = await axios.get(url, {
          timeout: 5000
        }).then((r) => {
          return r.data.merklescript
        })
        return merklescript
      },
      {
        retries: 10,
        onRetry: (e) => {
          console.log("retrying", cid)
        }
      }
    )
    console.log("found merklescript on IPFS!")

    const { digest, encoding } = ipfsh.fromCid(cid)
    const script = new Merklescript(s)
    const root = script.root()
    const factory = new this.web3.eth.Contract(factory_abi, constants.factory[this.network]);

    if (this.key) {
      let wallet = this.web3.eth.accounts.privateKeyToAccount("0x" + this.key)
      const deploy_address = (await this.find({
        creator: wallet.address, start: index, count: 1
      }))[0]
      let action = factory.methods.genesis(
        root,
        digest,
        (encoding === "dag-pb" ? 1 : 0),
        index
      )
      let data = action.encodeABI()
      let o = {
        from: wallet.address,
        to: factory.address,
        data: data,
      }
      let estimate = await action.estimateGas(o)
      o.gas = estimate
      const signedTx = await wallet.signTransaction(o)
      let tx = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      return { tx, address: deploy_address }
    } else {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      let accounts = await this.web3.eth.getAccounts()
      const deploy_address = (await this.find({
        creator: accounts[0], start: index, count: 1
      }))[0]
      let tx = await factory.methods.genesis(
        root,
        digest,
        (encoding === "dag-pb" ? 1 : 0),
        index
      ).send({ from: accounts[0] })
      return { tx, address: deploy_address }
    }
  }
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  //    let members = await buffer.members("0x05A9c70d7827c936c96896Da36676E81C878BFF0")
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  async members(address) {
    const merklescript = await this.merklescript(address)
    return merklescript.values.map((val) => {
      return {
        account: val[0],
        value: val[1],
        total: Math.pow(10, 12)
      }
    })
  }
  async find(query) {
    if (!query.creator) throw new Error("query object requires 'creator'")
    const factory = (query.factory ? query.factory : constants.factory[this.network]);
    const implementation = (query.implementation ? query.implementation : constants.implementation[this.network])

    const creator = query.creator
    const start = (query.start ? query.start : 0)
    const count = (query.count ? query.count : 100)
    let addresses = []
    for(let i=start; i<start+count; i++) {
      const salt = this.web3.utils.soliditySha3(creator, i)
      const bytecode = `0x3d602d80600a3d3981f3363d3d373d3d3d363d73${implementation.slice(2)}5af43d82803e903d91602b57fd5bf3`
      const parts = [
        'ff',
        factory.slice(2),
        salt.slice(2),
        this.web3.utils.sha3(bytecode).slice(2),
      ]
      const partsHash = this.web3.utils.sha3(`0x${parts.join('')}`)
      addresses.push(`0x${partsHash.slice(-40)}`.toLowerCase())
    }
    return addresses
  }
  async title(address) {
    const merklescript = await this.merklescript(address)
    return merklescript.title
  }

  ////////////////////////////////////////////////////////////////////////////////////////
  //
  //    let group = await buffer.get(buffer_address)
  //
  ////////////////////////////////////////////////////////////////////////////////////////
  async get(buffer_address) {
    await this.checkNetwork()
    const contract = new this.web3.eth.Contract(buffer_abi, buffer_address)
    const cid = await contract.methods.cid().call()
    const merklescript = await this.merklescript(buffer_address)
    return {
      cid,
      title: merklescript.title,
      group: buffer_address
    }
  }
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  //    // get leaf value and merkle proof of an account for a buffer at contract_address
  //    await buffer.merkleproof(contract_address, account)
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  async merkleproof(contract_address, account) {
    await this.checkNetwork()
    if (!account) account = await this.current_account()
    const merklescript = await this.merklescript(contract_address)
    let value = merklescript.values.filter((val) => {
      return val[0].toLowerCase() === account.toLowerCase()
    }).map((val) => {
      return val[1]
    })[0]
    const compiled = new Merklescript(merklescript)
    const proof = compiled.proof([ account, value ])
    return { value, proof }
  }
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  //    let status = await buffer.status(contract_address[, account])
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  async status(contract_address, account) {
    await this.checkNetwork()
    if (!account) account = await this.current_account()
    // withdrawn
    const contract = new this.web3.eth.Contract(buffer_abi, contract_address)
    let withdrawnStr = await contract.methods.withdrawn(account).call() 
    let withdrawn = new BigNumber(withdrawnStr);
    // total received
    let totalReceivedStr = await contract.methods.totalReceived().call()
    let totalReceived = new BigNumber(totalReceivedStr)
    // payment
    const merklescript = await this.merklescript(contract_address)
    let filtered = merklescript.values.filter((val) => {
      return val[0].toLowerCase() === account.toLowerCase()
    }).map((val) => {
      return val[1]
    })



    if (filtered.length > 0) {
      // ETH
      let value = filtered[0]
      let balance = totalReceived
        .times(new BigNumber(value))
        .dividedBy(new BigNumber(10**12))
        .minus(withdrawn)
      let balanceEth = balance.dividedBy(new BigNumber(Number(10**18).toString()))
      let withdrawnEth = withdrawn.dividedBy(new BigNumber(Number(10**18).toString()))
      let totalReceivedEth = totalReceived.dividedBy(new BigNumber(Number(10**18).toString()))

      // WETH
      try {
        const weth = new this.web3.eth.Contract([{
          "constant": true,
          "inputs": [ { "name": "_owner", "type": "address" } ],
          "name": "balanceOf",
          "outputs": [ { "name": "balance", "type": "uint256" } ],
          "payable": false,
          "stateMutability": "view",
          "type": "function"
        }], constants.weth[this.network])

        const user_weth_withdrawn = new BigNumber(await contract.methods.token_withdrawn(constants.weth[this.network], account).call())
        const total_weth_withdrawn = new BigNumber(await contract.methods.total_token_withdrawn(constants.weth[this.network]).call())
        const total_weth_balance = new BigNumber(await weth.methods.balanceOf(contract_address).call())
        const total_weth_received = total_weth_balance.plus(total_weth_withdrawn)
        const user_weth_balance = total_weth_received
          .times(value)
          .dividedBy(new BigNumber(10**12))
          .minus(user_weth_withdrawn)

        const user_weth_withdrawn_in_eth = user_weth_withdrawn.dividedBy(new BigNumber(Number(10**18).toString()))
        const total_weth_withdrawn_in_eth = total_weth_withdrawn.dividedBy(new BigNumber(Number(10**18).toString()))
        const total_weth_balance_in_eth = total_weth_balance.dividedBy(new BigNumber(Number(10**18).toString()))
        const total_weth_received_in_eth = total_weth_received.dividedBy(new BigNumber(Number(10**18).toString()))
        const user_weth_balance_in_eth = user_weth_balance.dividedBy(new BigNumber(Number(10**18).toString()))
        return {
          withdrawn, balance, balanceEth, withdrawnEth, totalReceived, totalReceivedEth,
          user_weth_withdrawn, user_weth_balance,
          user_weth_withdrawn_in_eth, user_weth_balance_in_eth,
          total_weth_withdrawn, total_weth_balance, total_weth_received,
          total_weth_withdrawn_in_eth, total_weth_balance_in_eth, total_weth_received_in_eth,
        }
      } catch (e) {
        return {
          withdrawn, balance, balanceEth, withdrawnEth, totalReceived, totalReceivedEth,
        }
      }
    } else {
      return null
    }
  }
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  //    let { tx } = await buffer.withdraw(contract_address, token_address_array)
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  async withdraw(address, token_address_array) {
    await this.checkNetwork()
    const contract = new this.web3.eth.Contract(buffer_abi, address)
    const tokens = token_address_array ? token_address_array : [constants.weth[this.network]]
    if (this.key) {
      const wallet = this.web3.eth.accounts.privateKeyToAccount("0x" + this.key)
      const account = wallet.address;
      const { value, proof } = await this.merkleproof(address, account)
      const action = contract.methods.withdraw(
        account,
        value,
        proof,
        tokens
      )
      const data = action.encodeABI()
      const o = {
        from: account,
        to: contract.address,
        data: data,
      }
      o.gas = await action.estimateGas(o)
      const signedTx = await wallet.signTransaction(o)
      const tx = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      return { tx }
    } else {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      const accounts = await this.web3.eth.getAccounts()
      const account = accounts[0]
      const { value, proof } = await this.merkleproof(address, account)
      const tx = await contract.methods.withdraw(
        account,
        value,
        proof,
        tokens
      ).send({ from: account })
      return { tx }
    }
  }
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  //    // get the entire mekle tree for a buffer at contract_address
  //    await buffer.merklescript(contract_address)
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  async merklescript(contract_address) {
    await this.checkNetwork()
    const contract = new this.web3.eth.Contract(buffer_abi, contract_address)
    const cid = await contract.methods.cid().call()
    let url = constants.ipfs.replace("{{cid}}", cid)
    let merklescript = await axios.get(url).then((r) => {
      return r.data.merklescript
    })
    return merklescript
  }
  async cid(contract_address) {
    await this.checkNetwork()
    const contract = new this.web3.eth.Contract(buffer_abi, contract_address)
    const cid = await contract.methods.cid().call()
    return cid
  }
  async checkNetwork() {
    let net = await this.web3.eth.net.getNetworkType()
    if (net !== this.network) {
      throw new Error(`Please sign into ${this.network} network`)
    }
  }
  async current_account () {
    await this.checkNetwork()
    if (this.key) {
      const wallet = this.web3.eth.accounts.privateKeyToAccount("0x" + this.key)
      return wallet.address;
    } else {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      const accounts = await this.web3.eth.getAccounts()
      return accounts[0]
    }
  }
}
module.exports = buffer
