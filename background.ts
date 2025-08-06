import { WalletManager } from './lib/wallet'

const walletManager = WalletManager.getInstance()

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type !== 'WALLET_REQUEST') {
    return false
  }

  handleWalletRequest(request, sender)
    .then(result => {
      sendResponse({ result })
    })
    .catch(error => {
      sendResponse({ error: error.message })
    })

  return true // 保持消息通道开放
})

async function handleWalletRequest(request: any, sender: chrome.runtime.MessageSender): Promise<any> {
  const { method, params } = request

  switch (method) {
    case 'eth_requestAccounts':
      return await handleRequestAccounts()
    
    case 'eth_accounts':
      return await handleGetAccounts()
    
    case 'eth_chainId':
      return await handleGetChainId()
    
    case 'eth_getBalance':
      return await handleGetBalance(params[0], params[1])
    
    case 'eth_sendTransaction':
      return await handleSendTransaction(params[0])
    
    case 'personal_sign':
      return await handlePersonalSign(params[0], params[1])
    
    case 'eth_signTypedData_v4':
      return await handleSignTypedData(params[0], params[1])
    
    case 'eth_getTransactionCount':
      return await handleGetTransactionCount(params[0], params[1])
    
    case 'eth_gasPrice':
      return await handleGetGasPrice()
    
    case 'eth_estimateGas':
      return await handleEstimateGas(params[0])
    
    case 'eth_call':
      return await handleCall(params[0], params[1])
    
    case 'eth_getBlockByNumber':
      return await handleGetBlock(params[0], params[1])
    
    case 'eth_getTransactionByHash':
      return await handleGetTransaction(params[0])
    
    case 'eth_getTransactionReceipt':
      return await handleGetTransactionReceipt(params[0])
    
    default:
      throw new Error(`不支持的方法: ${method}`)
  }
}

async function handleRequestAccounts(): Promise<string[]> {
  const walletState = await walletManager.getWalletState()
  if (!walletState) {
    throw new Error('钱包未解锁')
  }

  // 这里可以显示授权弹窗，暂时自动授权
  const currentAccount = walletState.accounts[walletState.currentAccount]
  return [currentAccount.address]
}

async function handleGetAccounts(): Promise<string[]> {
  const walletState = await walletManager.getWalletState()
  if (!walletState) {
    return []
  }

  const currentAccount = walletState.accounts[walletState.currentAccount]
  return [currentAccount.address]
}

async function handleGetChainId(): Promise<string> {
  const walletState = await walletManager.getWalletState()
  if (!walletState) {
    throw new Error('钱包未解锁')
  }

  const currentNetwork = walletState.networks[walletState.currentNetwork]
  return '0x' + currentNetwork.chainId.toString(16)
}

async function handleGetBalance(address: string, blockTag: string): Promise<string> {
  const balance = await walletManager.getBalance(address)
  // 转换为 wei (字符串格式的十六进制)
  const wei = BigInt(parseFloat(balance) * 1e18)
  return '0x' + wei.toString(16)
}

async function handleSendTransaction(transactionParams: any): Promise<string> {
  // 这里应该显示确认弹窗，暂时自动确认
  const { to, value, gas, gasPrice } = transactionParams
  
  const amount = value ? (BigInt(value) / BigInt(1e18)).toString() : '0'
  const gasLimit = gas ? BigInt(gas).toString() : undefined
  const gasPriceGwei = gasPrice ? (BigInt(gasPrice) / BigInt(1e9)).toString() : undefined

  return await walletManager.sendTransaction(to, amount, gasLimit, gasPriceGwei)
}

async function handlePersonalSign(message: string, account: string): Promise<string> {
  // 这里应该显示签名确认弹窗，暂时自动签名
  return await walletManager.signMessage(message)
}

async function handleSignTypedData(account: string, typedData: string): Promise<string> {
  // 这里应该显示类型化数据签名确认弹窗，暂时返回错误
  throw new Error('暂不支持类型化数据签名')
}

async function handleGetTransactionCount(address: string, blockTag: string): Promise<string> {
  // 这里需要连接到以太坊网络获取 nonce，暂时返回 0
  return '0x0'
}

async function handleGetGasPrice(): Promise<string> {
  // 这里需要连接到以太坊网络获取 gas 价格，暂时返回 20 Gwei
  return '0x' + (20 * 1e9).toString(16)
}

async function handleEstimateGas(transactionObject: any): Promise<string> {
  // 这里需要连接到以太坊网络估算 gas，暂时返回 21000
  return '0x' + (21000).toString(16)
}

async function handleCall(callObject: any, blockTag: string): Promise<string> {
  // 这里需要连接到以太坊网络调用合约，暂时返回空
  return '0x'
}

async function handleGetBlock(blockHashOrTag: string, includeTransactions: boolean): Promise<any> {
  // 这里需要连接到以太坊网络获取区块信息，暂时返回 null
  return null
}

async function handleGetTransaction(transactionHash: string): Promise<any> {
  // 这里需要连接到以太坊网络获取交易信息，暂时返回 null
  return null
}

async function handleGetTransactionReceipt(transactionHash: string): Promise<any> {
  // 这里需要连接到以太坊网络获取交易收据，暂时返回 null
  return null
} 