const factory_abi = require('./abi/factory.js')
const BigNumber = require('bignumber.js');
const buffer_abi = require('./abi/buffer.js')
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
    let { title, members } = o
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

    const cidDigest = ipfsh.ctod(cid)
    const script = new Merklescript(s)
    const root = script.root()
    const factory = new this.web3.eth.Contract(factory_abi, constants.factory[this.network]);
    if (this.key) {
      let wallet = this.web3.eth.accounts.privateKeyToAccount("0x" + this.key)
      let action = factory.methods.genesis(title, root, cidDigest)
      let data = action.encodeABI()
      let o = {
        from: wallet.address,
        to: factory.options.address,
        data: data,
      }
      let estimate = await action.estimateGas(o)
      o.gas = estimate
      const signedTx = await wallet.signTransaction(o)
      let tx = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      let address = this.web3.eth.abi.decodeParameter('address', tx.logs[0].topics[2])
      return { tx, address }
    } else {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      let accounts = await this.web3.eth.getAccounts()
      let tx = await factory.methods.genesis(title, root, cidDigest).send({ from: accounts[0] })
      let address = tx.events.ContractDeployed.returnValues.group
      return { tx, address }
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
  ////////////////////////////////////////////////////////////////////////////////////////
  //
  //    let groups = await stream.groups([owner_address])
  //
  ////////////////////////////////////////////////////////////////////////////////////////
  async groups(account) {
    if (!account) account = await this.current_account()
    const factory = new this.web3.eth.Contract(factory_abi, constants.factory[this.network])
    let logs = await factory.getPastEvents("ContractDeployed", {
      filter: { owner: account },
      fromBlock: 0,
      toBlock  : "latest",
    })
    return logs.map((log) => {
      return {
        cid: ipfsh.dtoc(log.returnValues.cid),
        owner: log.returnValues.owner,
        group: log.returnValues.group,
        title: log.returnValues.title
      }
    })
  }
  ////////////////////////////////////////////////////////////////////////////////////////
  //
  //    let group = await buffer.get(buffer_address)
  //
  ////////////////////////////////////////////////////////////////////////////////////////
  async get(buffer_address) {
    await this.checkNetwork()
    const factory = new this.web3.eth.Contract(factory_abi, constants.factory[this.network])
    let logs = await factory.getPastEvents("ContractDeployed", {
      filter: { group: buffer_address },
      fromBlock: 0,
      toBlock  : "latest",
    })
    if (logs.length > 0) {
      return {
        cid: ipfsh.dtoc(logs[0].returnValues.cid),
        owner: logs[0].returnValues.owner,
        group: logs[0].returnValues.group,
        title: logs[0].returnValues.title
      }
    } else {
      throw new Error("buffer does not exist at " + buffer_address)
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
      let value = filtered[0]
      let balance = totalReceived
        .times(new BigNumber(value))
        .dividedBy(new BigNumber(10**12))
        .minus(withdrawn)
      let balanceEth = balance.dividedBy(new BigNumber(Number(10**18).toString()))
      let withdrawnEth = withdrawn.dividedBy(new BigNumber(Number(10**18).toString()))
      let totalReceivedEth = totalReceived.dividedBy(new BigNumber(Number(10**18).toString()))
      return {
        withdrawn, balance, balanceEth, withdrawnEth, totalReceived, totalReceivedEth
      }
    } else {
      return null
    }
  }
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  //    let { tx } = await buffer.withdraw(contract_address)
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////
  async withdraw(address) {
    await this.checkNetwork()
    const contract = new this.web3.eth.Contract(buffer_abi, address)
    if (this.key) {
      const wallet = this.web3.eth.accounts.privateKeyToAccount("0x" + this.key)
      const account = wallet.address;
      const { value, proof } = await this.merkleproof(address, account)
      const action = contract.methods.withdraw(
        account,
        value,
        proof
      )
      const data = action.encodeABI()
      const o = {
        from: account,
        to: contract.options.address,
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
        proof
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
    const factory = new this.web3.eth.Contract(factory_abi, constants.factory[this.network]);
    let logs = await factory.getPastEvents("ContractDeployed", {
      filter: { group: contract_address },
      fromBlock: 0,
      toBlock  : "latest",
    })
    const cid = ipfsh.dtoc(logs[0].returnValues.cid)
    let url = constants.ipfs.replace("{{cid}}", cid)
    let merklescript = await axios.get(url).then((r) => {
      return r.data.merklescript
    })
    return merklescript
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
