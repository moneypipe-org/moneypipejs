# moneypipe.js

> JavaScript library for splitting money on ethereum

moneypipe is a collection of composable building blocks (smart contracts) for playing with money on ethereum. Basically you can create a custom address that represents a group, and simply send money to it, and the funds get auto-split to the members, either synchronously **(stream)** or asynchronously **(buffer)**.

<br>
<a class='btn' href="https://moneypipe.xyz"><i class="fa-solid fa-house"></i> Homepage</a>
<a class='btn' href="https://github.com/moneypipe-org/moneypipejs"><i class="fa-brands fa-github"></i> GitHub</a>
<a class='btn' href="https://discord.gg/BZtp5F6QQM"><i class="fa-brands fa-discord"></i> Discord</a>
<a class='btn' href="https://twitter.com/skogard"><i class="fa-brands fa-twitter"></i> Twitter</a>

---

# contracts

Here are the factory contracts:

- **goerli testnet**
  - buffer2: [0xF1BA9c045b01402AFf7d571BF2Ff3322e1EE7972](https://goerli.etherscan.io/address/0xF1BA9c045b01402AFf7d571BF2Ff3322e1EE7972)
- **ethereum mainnet**
  - buffer2: [0xF1BA9c045b01402AFf7d571BF2Ff3322e1EE7972](https://etherscan.io/address/0xF1BA9c045b01402AFf7d571BF2Ff3322e1EE7972)
  - stream: [0x88891017548DCFf014EFFAe944D4AB7d2E5Cd8A8](https://etherscan.io/address/0x88891017548DCFf014EFFAe944D4AB7d2E5Cd8A8#code)



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

### 1.4. groups

#### syntax

Use the constructed stream object:

```javascript
let groups = await stream.groups(owner_address)
```

#### parameters

- **owner_address:** (optional) the user address to query all owned streams from. the current signed-in user address if not specified.

#### return values

- **groups:** the groups array where each item is an object made up of:
  - **owner:** the owner address
  - **group:** the stream address
  - **title:** the stream title

#### example

<iframe width="100%" height="500" src="//jsfiddle.net/skogard/75x6mzot/3/embedded/html,result/dark/" allowfullscreen="allowfullscreen" allowpaymentrequest frameborder="0"></iframe>

### 1.5. get

get a stream at address

#### syntax

Use the constructed stream object:

```javascript
let group = await stream.get(stream_address)
```

#### parameters

- **stream_address:** the stream address.

#### return values

- **group:**
  - **owner:** the owner address
  - **group:** the stream address
  - **title:** the stream title

#### example

<iframe width="100%" height="500" src="//jsfiddle.net/skogard/28wsjyrt/1/embedded/html,result/dark/" allowfullscreen="allowfullscreen" allowpaymentrequest frameborder="0"></iframe>

---

## 2. buffer2

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
const buffer2 = new Moneypipe.buffer2({
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

- **buffer2:** the instantiated buffer2 object

#### example

In the browser:

```javascript
const buffer2 = new Moneypipe.buffer2({
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
const buffer2 = new Moneypipe.buffer2({
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
let { tx, address } = await buffer2.create({
  index: index,
  title: title,
  members: members
})
```

#### parameters

- **index:** the integer index of a buffer2 contract to create (0, 1, 2, 3, ...). All buffer2 contracts have deterministic addresses, calculated from the deployer's address and the `index`. It is recommended that you create buffer2 contracts starting from 0, 1, 2, and so on.
- **title:** the name of the stream
- **members:** an array of members where each member is an object made up of the attributes:
  - **account:** user address
  - **value:** each account's share of the pie

#### return values

- **tx:** the buffer2 creatinon transaction
- **address:** the contract address for the created buffer2

#### example

```javascript
let { tx, address } = await buffer2.create({
  index: 0,
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

### 2.3. groups

#### syntax

Use the constructed buffer2 object:

```javascript
let groups = await buffer2.groups(owner_address)
```

#### parameters

- **owner_address:** the user address to query all owned buffers from. the current signed-in user address if not specified.

#### return values

- **groups:** the groups array where each item is an object made up of:
  - **cid:**: IPFS CID at which the merkle tree is stored
  - **owner:** the owner address
  - **group:** the buffer2 address
  - **title:** the buffer2 title

#### example

<iframe width="100%" height="600" src="//jsfiddle.net/skogard/tqrc8f1y/5/embedded/html,result/" allowfullscreen="allowfullscreen" allowpaymentrequest frameborder="0"></iframe>

### 2.4. get

get a buffer2 at address

#### syntax

Use the constructed buffer2 object:

```javascript
let group = await buffer2.get(buffer2_address)
```

#### parameters

- **buffer2_address:** the buffer2 address.

#### return values

- **group:**
  - **cid:**: IPFS CID at which the merkle tree is stored
  - **owner:** the owner address
  - **group:** the buffer2 address
  - **title:** the buffer2 title

#### example

<iframe width="100%" height="500" src="//jsfiddle.net/skogard/gr83f74v/1/embedded/html,result/dark/" allowfullscreen="allowfullscreen" allowpaymentrequest frameborder="0"></iframe>

### 2.5. members

get all members and their shares of a contract at `buffer2_address`

#### syntax

Use the constructed stream object:

```javascript
let members = await buffer2.members(buffer2_address)
```

#### parameters

- **buffer2_address:** the contract address of the buffer2 to fetch the members from

#### return values

- **members:** the members array where each member is an object made up of:
  - **account:** user address
  - **value:** each account's share of the pie
  - **total:** the total amount

#### example

```javascript
let members = await buffer2.members("0x05A9c70d7827c936c96896Da36676E81C878BFF0")
```

<iframe width="100%" height="500" src="//jsfiddle.net/skogard/9z0vcqnr/embedded/html,result/dark/" allowfullscreen="allowfullscreen" allowpaymentrequest frameborder="0"></iframe>

### 2.6. withdraw

#### syntax

```javascript
let { tx } = await buffer2.withdraw(buffer2_address)
```

#### parameters

- **buffer2_address:** the address of the buffer2 contract to withdraw balance from

#### return values

- **tx:** the withdraw transaction object

#### example

```javascript
let { tx } = await buffer2.withdraw("0x05A9c70d7827c936c96896Da36676E81C878BFF0")
```

### 2.7. status

get the current balance of a user

#### syntax

```javascript
let status = await buffer2.status(buffer2_address[, account])
```

#### parameters

- **buffer2_address:** the buffer2 address
- **account:** (optional) the account for which get the status. If omitted, the currently signed-in user.

#### return values

returns `null` if the account is not a member of the buffer2.

otherwise returns:

- **status:**
  - **withdrawn:** the total withdrawn amount for the current user (in wei)
  - **balance:** the total amount that can be withdrawn by the current user (in wei)
  - **balanceEth:** the **balance** calculated in ETH
  - **withdrawnEth:** the total withdrawn amount for the current user, calculated in ETH

#### example

```javascript
const BUFFER2_ADDRESS = "0x66360Caf43A1ee1F1D0A2dc8D0246a86d9522539"
let status = await buffer2.status(BUFFER2_ADDRESS)
for(let key in status) {
  console.log(key, status[key].toString())
}
```

<iframe width="100%" height="500" src="//jsfiddle.net/skogard/Lnk3hxgv/embedded/html,result/dark/" allowfullscreen="allowfullscreen" allowpaymentrequest frameborder="0"></iframe>

### 2.8. merkleproof

Get the current user's share value in the merkle tree and its proof

#### syntax

```javascript
let { value, proof } = await buffer2.merkleproof(buffer2_address[, user_address])
```

#### parameters

- **buffer2_address:** the address of the buffer2 contract
- **user_address:** (optional) the address of the user account to get the proof for. if omitted, the currently signed in account.


#### return values

- **value:** the user's share value in the merkle tree
- **proof:** the user's merkle proof

#### example

```javascript
await window.ethereum.request({ method: 'eth_requestAccounts' })
const accounts = await this.web3.eth.getAccounts()
let { value, proof } = await buffer2.merkleproof(
  "0x66360Caf43A1ee1F1D0A2dc8D0246a86d9522539",
  accounts[0]
)
console.log(value, proof)
```

<iframe width="100%" height="500" src="//jsfiddle.net/skogard/bzptvqg3/embedded/html,result/dark/" allowfullscreen="allowfullscreen" allowpaymentrequest frameborder="0"></iframe>

### 2.9. find

find buffer2 contract addresses based on a query

>
> **Note**
>
> The find() method DOES NOT use any RPC or API and therefore does not require a network connection. It's a simple function that **calculates** contract addresses from any creator account.

Here's the syntax:


#### syntax

```javascript
const addresses = await buffer2.find(query)
```

##### parameters

- `query`: describes the condition to search for
  - `creator`: the creator address. can be anyone's address.
  - `start`: the contract start index to filter from (within the creator's namespace)
  - `count`: the number of results to return

##### return value

- `addresses`: an array of contract addresses that match the condition

#### example

This example returns the first 100 buffer2 contract addresses (from index 0 to index 99) for the account `0x502b2FE7Cc3488fcfF2E16158615AF87b4Ab5C41`:

```javascript
const addresses = await c0.collection.find({
  creator: "0x502b2FE7Cc3488fcfF2E16158615AF87b4Ab5C41",
  start: 0,
  count: 100
})
```

