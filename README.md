# moneypipe.js

> JavaScript library for splitting money on ethereum

moneypipe is a collection of composable building blocks (smart contracts) for playing with money on ethereum. Basically you can create a custom address that represents a group, and simply send money to it, and the funds get auto-split to the members, either synchronously **(stream)** or asynchronously **(buffer)**.

<br>
<a class='btn' href="https://github.com/moneypipe-org/moneypipejs"><i class="fa-brands fa-github"></i> GitHub</a>
<a class='btn' href="https://discord.gg/BZtp5F6QQM"><i class="fa-brands fa-discord"></i> Discord</a>
<a class='btn' href="https://twitter.com/skogard"><i class="fa-brands fa-twitter"></i> Twitter</a>

---

# intro

moneypipe is all about controlling the flow of money. there are currently 2 modules:

1. stream
2. buffer


## 1. stream (synchronous split)

stream lets you create a group that auto-splits and streams money to members in realtime.

![stream.png](stream.png)

## 2. buffer (asynchronous split)

buffer lets you create a group to collect money and let members withdraw their share.


![buffer.png](buffer.png)

---

# install

## 1. browser

```html
<script src="https://unpkg.com/moneypipe/dist/moneypipe.js"></script>
```

## 2. node.js

Install package:

```
npm install moneypipe
```

and require in your code:

```javascript
const Moneypipe = require('moneypipe')
```

---

# api

## 1. stream

stream lets you create a group that auto-splits and streams money to members in realtime.

![stream.png](stream.png)

### 1.1. constructor

#### syntax

```javascript
const stream = new Moneypipe.stream({
  key: privateKey,  // optional
  web3: web3,
  network: network
})
```

#### parameters

- **web3:** an instantiated web3 object
- **network:** `"rinkeby"` or `"main"` (optional. default is "main")
- **key:** a private key string (optional. ONLY in node.js)

#### return values

- **stream:** the instantiated stream object


### 1.2. create

#### syntax

Use the constructed stream object:

```javascript
let { tx, address } = await stream.create({
  title: title,
  members: members
})
```

#### parameters

- **title:** the name of the stream
- **members:** an array of members where each member is an object made up of the attributes:
  - **account:** user address
  - **value:** each account's share of the pie

#### return values

- **tx:** the resulting transaction object
- **address:** the deployed stream address

### 1.3. members

get all members and their shares of a contract at `stream_address`

#### syntax

Use the constructed stream object:

```javascript
let members = await stream.members(stream_address)
```

#### parameters

- **stream_address:** the stream contract address to fetch the members from

#### return values

- **members:** the members array where each member is an object made up of:
  - **account:** user address
  - **value:** each account's share of the pie
  - **total:** the total amount

#### example

<iframe width="100%" height="500" src="//jsfiddle.net/skogard/sknqrgwb/embedded/html,result/dark/" allowfullscreen="allowfullscreen" allowpaymentrequest frameborder="0"></iframe>

---

## 2. buffer

buffer lets you create a group to collect money and let members withdraw their share.

![buffer.png](buffer.png)

while stream is a "push technology", buffer is a "pull technology". The members need to withdraw funds they can claim.

This structure means:

1. **requires a transaction to claim:** while stream doesn't need an additional transaction, in case of buffer, each member needs to make a "claim" transaction to claim their share.
2. **Hyper scalable:** Pipe can be used for groups with small number of members because the payout is handled in realtime and requires gas. However buffer doesn't have this overhead because each user withdraws on their own and there are no loops. Therefore a buffer can scale to as many members as you want, for example thousands or  millions of members.
3. **requires IPFS integration:** stream does everything in the smart contract. buffer requires a merkle tree. The merkle tree is stored on IPFS and its cid is stored on the smart contract, so to implement a buffer, you either need to use the official moneypipe buffer interface at https://buffer.moneypipe.xyz or run your own [microipfs](https://github.com/factoria/microipfs) instance.

### 2.1. constructor


#### syntax

```javascript
const buffer = new Moneypipe.buffer({
  web3: web3,
  ipfs: ipfsPinFunction,
  key: key,
  network: network
})
```

#### parameters

- **web3:** an instantiated web3 object
- **ipfs:** a function that stores the mekle tree JSON on IPFS and returns the CID.
- **key:** a private key string (ONLY in node.js)
- **network:** `"rinkeby"` or `"main"` (optional. default is "main")

The "ipfs" function can be implemented with [microipfs](https://github.com/factoria/microipfs). Example code below:

#### return values

- **buffer:** the instantiated buffer object

#### example

In the browser:

```javascript
const buffer = new Moneypipe.buffer({
  web3: new Web3(window.ethereum),
  ipfs: async (json) => {
    let cid = await fetch("https://microipfs.com/add", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        object: json
      })
    }).then((r) => {
      return r.json()
    }).then((r) => {
      return r.success
    })
    return cid
  }
})
```

In node.js:

```javascript
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const buffer = new Moneypipe.buffer({
  key: privateKey,
  web3: createAlchemyWeb3(API_URL),
  ipfs: async (json) => {
    let cid = await fetch("https://microipfs.com/add", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        object: json
      })
    }).then((r) => {
      return r.json()
    }).then((r) => {
      return r.success
    })
    return cid
  }
})
```

### 2.2. create

#### syntax

```javascript
let { tx, address } = await buffer.create({
  title: title,
  members: members
})
```

#### parameters

- **title:** the name of the stream
- **members:** an array of members where each member is an object made up of the attributes:
  - **account:** user address
  - **value:** each account's share of the pie

#### return values

- **tx:** the buffer creatinon transaction
- **address:** the contract address for the created buffer

#### example

```javascript
let { tx, address } = await buffer.create({
  title: "testing",
  members: [{
    account: addr1,
    value: 1
  }, {
    account: addr2,
    value: 3
  }, {
    account: addr3,
    value: 6
  }]
})
```

### 2.3. members

get all members and their shares of a contract at `buffer_address`

#### syntax

Use the constructed stream object:

```javascript
let members = await buffer.members(buffer_address)
```

#### parameters

- **buffer_address:** the contract address of the buffer to fetch the members from

#### return values

- **members:** the members array where each member is an object made up of:
  - **account:** user address
  - **value:** each account's share of the pie
  - **total:** the total amount

#### example

```javascript
let members = await buffer.members("0x05A9c70d7827c936c96896Da36676E81C878BFF0")
```

<iframe width="100%" height="500" src="//jsfiddle.net/skogard/9z0vcqnr/embedded/html,result/dark/" allowfullscreen="allowfullscreen" allowpaymentrequest frameborder="0"></iframe>

### 2.4. withdraw

#### syntax

```javascript
let { tx } = await buffer.withdraw(buffer_address)
```

#### parameters

- **buffer_address:** the address of the buffer contract to withdraw balance from

#### return values

- **tx:** the withdraw transaction object

#### example

```javascript
let { tx } = await buffer.withdraw("0x05A9c70d7827c936c96896Da36676E81C878BFF0")
```

### 2.5. status

get the current balance of a user

#### syntax

```javascript
let status = await buffer.status(buffer_address[, account])
```

#### parameters

- **buffer_address:** the buffer address
- **account:** (optional) the account for which get the status. If omitted, the currently signed-in user.

#### return values

- **status:**
  - **withdrawn:** the total withdrawn amount for the current user
  - **balance:** the total amount that can be withdrawn by the current user (in wei)
  - **balanceEth:** the **balance** calculated in ETH

#### example

```javascript
const BUFFER_ADDRESS = "0x66360Caf43A1ee1F1D0A2dc8D0246a86d9522539"
let status = await buffer.status(BUFFER_ADDRESS)
for(let key in status) {
  console.log(key, status[key].toString())
}
```

<iframe width="100%" height="500" src="//jsfiddle.net/skogard/Lnk3hxgv/embedded/html,result/dark/" allowfullscreen="allowfullscreen" allowpaymentrequest frameborder="0"></iframe>

### 2.6. merkleproof

Get the current user's share value in the merkle tree and its proof

#### syntax

```javascript
let { value, proof } = await buffer.merkleproof(buffer_address[, user_address])
```

#### parameters

- **buffer_address:** the address of the buffer contract
- **user_address:** (optional) the address of the user account to get the proof for. if omitted, the currently signed in account.


#### return values

- **value:** the user's share value in the merkle tree
- **proof:** the user's merkle proof

#### example

```javascript
await window.ethereum.request({ method: 'eth_requestAccounts' })
const accounts = await this.web3.eth.getAccounts()
let { value, proof } = await buffer.merkleproof(
  "0x66360Caf43A1ee1F1D0A2dc8D0246a86d9522539",
  accounts[0]
)
console.log(value, proof)
```

<iframe width="100%" height="500" src="//jsfiddle.net/skogard/t978xonh/embedded/html,result/dark/" allowfullscreen="allowfullscreen" allowpaymentrequest frameborder="0"></iframe>
