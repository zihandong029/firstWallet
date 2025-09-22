import React, { useEffect, useState } from "react"

import type { Transaction } from "~lib/transaction-history"
import { WalletManager, type Account, type WalletState } from "~lib/wallet"

interface WalletDashboardProps {
  onWalletLocked: () => void
}

const WalletDashboard: React.FC<WalletDashboardProps> = ({
  onWalletLocked
}) => {
  const [walletState, setWalletState] = useState<WalletState | null>(null)
  const [balance, setBalance] = useState("0")
  const [activeTab, setActiveTab] = useState<"assets" | "activity" | "send">(
    "assets"
  )
  const [loading, setLoading] = useState(true)
  const [sendForm, setSendForm] = useState({
    to: "",
    amount: "",
    gasLimit: "",
    gasPrice: ""
  })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [networkStatus, setNetworkStatus] = useState<{
    connected: boolean
    rpcUrl?: string
  }>({ connected: false })
  const [testingNetwork, setTestingNetwork] = useState(false)
  const [showNetworkSelector, setShowNetworkSelector] = useState(false)
  const [switchingNetwork, setSwitchingNetwork] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)

  const walletManager = WalletManager.getInstance()

  useEffect(() => {
    loadWalletData()
  }, [])

  // 当切换到活动标签时加载交易历史
  useEffect(() => {
    if (activeTab === "activity" && walletState && transactions.length === 0) {
      loadTransactionHistory()
    }
  }, [activeTab, walletState])

  const loadWalletData = async () => {
    try {
      const state = await walletManager.getWalletState()
      if (state) {
        setWalletState(state)
        await Promise.all([
          loadBalance(),
          testNetworkConnection(),
          loadTransactionHistory() // 添加交易历史加载
        ])
      }
    } catch (err) {
      console.error("加载钱包数据失败:", err)
    } finally {
      setLoading(false)
    }
  }

  const loadBalance = async () => {
    try {
      console.log("🔍 [余额查询] 开始获取余额...")
      const bal = await walletManager.getBalance()
      console.log("✅ [余额查询] 获取余额成功:", bal)
      setBalance(bal)
    } catch (err) {
      console.error("❌ [余额查询] 获取余额失败:", err)
      setBalance("0")
      setError("获取余额失败，请检查网络连接")
    }
  }

  const testNetworkConnection = async () => {
    if (!walletState) return

    setTestingNetwork(true)
    try {
      const currentNetwork = walletState.networks[
        walletState.currentNetwork
      ] || { chainId: 1 }
      const result = await walletManager.testNetworkConnection(
        currentNetwork.chainId
      )
      setNetworkStatus({
        connected: result.success,
        rpcUrl: result.rpcUrl
      })

      if (!result.success) {
        setError(`网络连接失败: ${result.error}`)
      }
    } catch (err) {
      setNetworkStatus({ connected: false })
      setError("网络测试失败")
    } finally {
      setTestingNetwork(false)
    }
  }

  const loadTransactionHistory = async () => {
    if (activeTab !== "activity") return // 只在活动页面加载

    setLoadingTransactions(true)
    try {
      console.log("🔍 [交易历史] 开始获取交易记录...")
      const txHistory = await walletManager.getTransactionHistory({ limit: 20 })
      console.log("✅ [交易历史] 获取成功:", txHistory.length, "条记录")
      setTransactions(txHistory)
    } catch (err) {
      console.error("❌ [交易历史] 获取失败:", err)
      setError("获取交易历史失败: " + (err as Error).message)
    } finally {
      setLoadingTransactions(false)
    }
  }

  const handleLock = async () => {
    await walletManager.lockWallet()
    onWalletLocked()
  }

  const handleSend = async () => {
    if (!sendForm.to || !sendForm.amount) {
      setError("请填写收款地址和金额")
      return
    }

    setSending(true)
    setError("")
    setSuccess("")

    try {
      const txHash = await walletManager.sendTransaction(
        sendForm.to,
        sendForm.amount,
        sendForm.gasLimit || undefined,
        sendForm.gasPrice || undefined
      )
      setSuccess(`交易发送成功! 哈希: ${txHash}`)
      setSendForm({ to: "", amount: "", gasLimit: "", gasPrice: "" })
      await loadBalance() // 刷新余额
    } catch (err) {
      setError("发送失败: " + (err as Error).message)
    } finally {
      setSending(false)
    }
  }

  const handleAddAccount = async () => {
    try {
      await walletManager.addAccount()
      await loadWalletData()
    } catch (err) {
      setError("添加账户失败: " + (err as Error).message)
    }
  }

  const handleSwitchAccount = async (index: number) => {
    try {
      await walletManager.switchAccount(index)
      await loadWalletData()
    } catch (err) {
      setError("切换账户失败: " + (err as Error).message)
    }
  }

  const handleRefresh = async () => {
    console.log("手动刷新余额和网络状态")
    setError("")
    setSuccess("")
    await Promise.all([
      loadBalance(),
      testNetworkConnection(),
      loadTransactionHistory() // 也刷新交易历史
    ])
  }

  const handleSwitchNetwork = async (chainId: number) => {
    if (switchingNetwork) return

    setSwitchingNetwork(true)
    setError("")
    setSuccess("")

    try {
      console.log("🔄 切换到网络 Chain ID:", chainId)

      const success = await walletManager.switchNetwork(chainId)
      if (success) {
        setSuccess("✅ 网络切换成功")
        setShowNetworkSelector(false)
        // 重新加载钱包数据
        await loadWalletData()
      }
    } catch (err) {
      console.error("切换网络失败:", err)
      setError(
        `切换网络失败: ${err instanceof Error ? err.message : "未知错误"}`
      )
    } finally {
      setSwitchingNetwork(false)
      setTimeout(() => {
        setError("")
        setSuccess("")
      }, 3000)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setSuccess("✅ 已复制到剪贴板")
      setTimeout(() => setSuccess(""), 2000)
    } catch (err) {
      console.error("复制失败:", err)
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner border-white"></div>
          <span>加载中...</span>
        </div>
      </div>
    )
  }

  if (!walletState) {
    return <div className="loading">钱包状态错误</div>
  }

  const currentAccount = walletState.accounts[walletState.currentAccount] || {
    address: ""
  }
  const currentNetwork = walletState.networks[walletState.currentNetwork] || {
    name: "未知网络",
    chainId: 1,
    symbol: "ETH",
    rpcUrls: []
  }

  return (
    <div className="dashboard">
      {/* 网络选择器弹窗 */}
      {showNetworkSelector && (
        <div
          className="network-selector-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
          <div
            className="network-selector-modal"
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "20px",
              maxWidth: "400px",
              width: "90%",
              maxHeight: "80vh",
              overflowY: "auto"
            }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">选择网络</h3>
              <button
                onClick={() => setShowNetworkSelector(false)}
                className="text-slate-500 hover:text-slate-700"
                style={{ fontSize: "20px" }}>
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {walletState.networks.map((network, index) => (
                <button
                  key={network.chainId}
                  onClick={() => handleSwitchNetwork(network.chainId)}
                  disabled={
                    switchingNetwork ||
                    network.chainId === currentNetwork.chainId
                  }
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    network.chainId === currentNetwork.chainId
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{network.name}</div>
                      <div className="text-sm text-slate-500">
                        Chain ID: {network.chainId} • {network.symbol}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {network.chainId === currentNetwork.chainId && (
                        <span className="text-green-500 text-sm">✓ 当前</span>
                      )}
                      {switchingNetwork && (
                        <div className="text-sm text-slate-500">切换中...</div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-header">
        <div className="header-top">
          <h1 className="wallet-title">我的钱包1</h1>
          <div className="flex items-center gap-2">
            {/* 网络选择器 */}
            <button
              className="network-selector-button"
              onClick={() => setShowNetworkSelector(!showNetworkSelector)}
              title="选择网络"
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                borderRadius: "8px",
                padding: "4px 8px",
                color: "white",
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}>
              🌐 {currentNetwork?.name || "未知网络"}
              <span style={{ fontSize: "10px" }}>▼</span>
            </button>

            {/* 网络状态指示器 */}
            <div
              className={`w-3 h-3 rounded-full ${networkStatus.connected ? "bg-green-400" : "bg-red-400"}`}
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: networkStatus.connected
                  ? "#4ade80"
                  : "#f87171",
                marginRight: "8px"
              }}
              title={
                networkStatus.connected
                  ? `已连接: ${networkStatus.rpcUrl}`
                  : "网络连接失败"
              }></div>
            <button
              className="lock-button"
              onClick={handleLock}
              title="锁定钱包">
              🔒
            </button>
          </div>
        </div>

        <div className="account-info">
          <div
            className="account-address cursor-pointer hover:text-white/90 transition-colors"
            onClick={() => copyToClipboard(currentAccount.address)}
            title="点击复制地址">
            {formatAddress(currentAccount.address)}
            <span className="ml-2 text-xs">📋</span>
          </div>
          <div className="account-balance">
            {parseFloat(balance).toFixed(6)} {currentNetwork?.symbol || "ETH"}
          </div>
          <div className="balance-usd">≈ $0.00 USD</div>
        </div>

        <div className="action-buttons">
          <button
            className="action-button"
            onClick={() => copyToClipboard(currentAccount.address)}
            title="复制地址">
            <div className="action-icon">📋</div>
            <div className="action-text">复制</div>
          </button>
          <button
            className="action-button"
            onClick={() => setActiveTab("send")}
            title="发送代币">
            <div className="action-icon">📤</div>
            <div className="action-text">发送</div>
          </button>
          <button
            className="action-button"
            onClick={handleRefresh}
            title="刷新余额1"
            disabled={testingNetwork}>
            <div className="action-icon">{testingNetwork ? "⏳" : "🔄"}</div>
            <div className="action-text">刷新1</div>
          </button>
        </div>
      </div>

      <div className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === "assets" ? "active" : ""}`}
          onClick={() => setActiveTab("assets")}>
          💼 资产
        </button>
        <button
          className={`nav-tab ${activeTab === "activity" ? "active" : ""}`}
          onClick={() => setActiveTab("activity")}>
          📊 活动
        </button>
        <button
          className={`nav-tab ${activeTab === "send" ? "active" : ""}`}
          onClick={() => setActiveTab("send")}>
          🚀 发送
        </button>
      </div>

      <div className="tab-content">
        {/* 全局提示信息 */}
        {error && <div className="error-message mb-4">{error}</div>}
        {success && <div className="success-message mb-4">{success}</div>}

        {activeTab === "assets" && (
          <div className="space-y-6">
            {/* 余额卡片 */}
            <div className="balance-card">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="balance-main">
                    {parseFloat(balance).toFixed(4)}{" "}
                    {currentNetwork?.symbol || "ETH"}
                  </div>
                  <div className="balance-secondary">≈ $0.00 USD</div>
                </div>
                <div className="text-right">
                  <div className="text-white/80 text-xs">总资产</div>
                  <div className="text-white font-semibold">
                    ${parseFloat(balance) * 0}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-white/70 text-sm">
                <span>24h 变化</span>
                <span className="text-green-300">+0.00%</span>
              </div>
            </div>

            {/* 快速操作 */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <button
                className="bg-primary-50 hover:bg-primary-100 text-primary-700 p-4 rounded-xl transition-all duration-200 hover:scale-105"
                onClick={() => setActiveTab("send")}>
                <div className="text-2xl mb-2">📤</div>
                <div className="text-sm font-semibold">发送</div>
              </button>
              <button
                className="bg-green-50 hover:bg-green-100 text-green-700 p-4 rounded-xl transition-all duration-200 hover:scale-105"
                onClick={() => copyToClipboard(currentAccount.address)}>
                <div className="text-2xl mb-2">📥</div>
                <div className="text-sm font-semibold">接收</div>
              </button>
              <button
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 p-4 rounded-xl transition-all duration-200 hover:scale-105"
                onClick={handleRefresh}
                disabled={testingNetwork}>
                <div className="text-2xl mb-2">
                  {testingNetwork ? "⏳" : "🔄"}
                </div>
                <div className="text-sm font-semibold">刷新</div>
              </button>
            </div>

            {/* 账户管理 */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  👥 账户 ({walletState.accounts.length})
                </h3>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={handleAddAccount}>
                  ➕ 添加账户
                </button>
              </div>

              <div className="account-selector">
                {walletState.accounts.map((account, index) => (
                  <div
                    key={index}
                    className={`account-option ${index === walletState.currentAccount ? "selected" : ""}`}
                    onClick={() => handleSwitchAccount(index)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-primary-400 to-secondary-400 rounded-full flex items-center justify-center text-white font-bold">
                        {index + 1}
                      </div>
                      <div className="account-details">
                        <div className="account-name">账户 {index + 1}</div>
                        <div className="account-address-short">
                          {formatAddress(account.address)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="account-balance-small">
                        {parseFloat(balance).toFixed(4)}{" "}
                        {currentNetwork?.symbol || "ETH"}
                      </div>
                      <div className="text-xs text-slate-400">≈ $0.00</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 网络信息 */}
            <div className="network-card">
              <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                🌐 网络信息
                <div
                  className={`w-2 h-2 rounded-full ${networkStatus.connected ? "bg-green-500" : "bg-red-500"}`}></div>
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500 mb-1">网络名称</div>
                  <div className="text-sm font-semibold text-slate-700">
                    {currentNetwork?.name || "未知网络"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Chain ID</div>
                  <div className="text-sm font-semibold text-slate-700">
                    {currentNetwork?.chainId || "未知"}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-slate-500 mb-1">当前RPC</div>
                <div className="text-xs text-slate-600 font-mono bg-slate-100 p-2 rounded">
                  {networkStatus.rpcUrl || "未连接"}
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-slate-500 mb-1">可用RPC节点</div>
                <div className="text-xs text-slate-600">
                  {currentNetwork.rpcUrls?.length || 0} 个备用节点
                </div>
              </div>
              <button
                className="mt-3 btn btn-secondary btn-small w-full"
                onClick={testNetworkConnection}
                disabled={testingNetwork}>
                {testingNetwork ? "测试中..." : "测试网络连接"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                📊 交易记录
              </h3>
              <button
                className="btn btn-secondary btn-small"
                onClick={loadTransactionHistory}
                disabled={loadingTransactions}>
                {loadingTransactions ? "🔄 加载中..." : "🔄 刷新"}
              </button>
            </div>

            {loadingTransactions ? (
              <div className="text-center py-8">
                <div className="spinner mx-auto mb-4"></div>
                <div className="text-slate-500">正在获取交易记录...</div>
              </div>
            ) : transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((tx, index) => (
                  <div
                    key={`${tx.hash}-${index}`}
                    className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                            tx.type === "send"
                              ? "bg-red-100 text-red-600"
                              : "bg-green-100 text-green-600"
                          }`}>
                          {tx.type === "send" ? "📤" : "📥"}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">
                            {tx.type === "send" ? "发送" : "接收"} {tx.symbol}
                          </div>
                          <div className="text-xs text-slate-500">
                            {new Date(tx.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-semibold ${
                            tx.type === "send"
                              ? "text-red-600"
                              : "text-green-600"
                          }`}>
                          {tx.type === "send" ? "-" : "+"}
                          {parseFloat(tx.valueFormatted).toFixed(6)} {tx.symbol}
                        </div>
                        <div
                          className={`text-xs px-2 py-1 rounded ${
                            tx.status === "success"
                              ? "bg-green-100 text-green-700"
                              : tx.status === "failed"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                          }`}>
                          {tx.status === "success"
                            ? "成功"
                            : tx.status === "failed"
                              ? "失败"
                              : "待确认"}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-slate-500 mb-1">发送方</div>
                        <div className="font-mono text-xs">
                          {formatAddress(tx.from)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 mb-1">接收方</div>
                        <div className="font-mono text-xs">
                          {formatAddress(tx.to)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                      <div className="text-xs text-slate-500">
                        区块: {tx.blockNumber}
                      </div>
                      {tx.explorerUrl && (
                        <a
                          href={tx.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                          查看详情 🔗
                        </a>
                      )}
                    </div>
                  </div>
                ))}

                {transactions.length >= 20 && (
                  <div className="text-center py-4">
                    <button className="btn btn-secondary btn-small">
                      加载更多
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📝</div>
                <div className="text-slate-500 font-medium">暂无交易记录</div>
                <div className="text-slate-400 text-sm mt-2">
                  您的交易历史将在这里显示
                </div>
                <button
                  className="btn btn-secondary btn-small mt-4"
                  onClick={loadTransactionHistory}>
                  🔄 重新加载
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "send" && (
          <div className="send-form">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              🚀 发送 {currentNetwork?.symbol || "ETH"}
            </h3>

            {/* 网络状态警告 */}
            {!networkStatus.connected && (
              <div className="warning-box mb-4">
                <div className="warning-text">
                  ⚠️ 网络连接不稳定，可能影响交易发送。请检查网络连接。
                </div>
              </div>
            )}

            <div className="space-y-4 overflow-y-auto">
              <div className="input-group">
                <label className="input-label">📍 收款地址</label>
                <input
                  type="text"
                  className="input-field"
                  value={sendForm.to}
                  onChange={(e) =>
                    setSendForm({ ...sendForm, to: e.target.value })
                  }
                  placeholder="0x..."
                />
              </div>

              <div className="input-group">
                <label className="input-label">💰 金额</label>
                <div className="relative">
                  <input
                    type="number"
                    className="input-field pr-20"
                    value={sendForm.amount}
                    onChange={(e) =>
                      setSendForm({ ...sendForm, amount: e.target.value })
                    }
                    placeholder="0.0"
                    step="0.0001"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium">
                    {currentNetwork?.symbol || "ETH"}
                  </div>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  可用余额: {balance} {currentNetwork?.symbol || "ETH"}
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleSend}
                disabled={
                  sending ||
                  !sendForm.to ||
                  !sendForm.amount ||
                  !networkStatus.connected
                }>
                {sending ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="spinner"></div>
                    发送中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    🚀 发送交易
                  </span>
                )}
              </button>
              <div className="gas-settings">
                <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                  ⛽ Gas 设置 (可选)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="input-group">
                    <label className="input-label">Gas 限制</label>
                    <input
                      type="number"
                      className="input-field"
                      value={sendForm.gasLimit}
                      onChange={(e) =>
                        setSendForm({ ...sendForm, gasLimit: e.target.value })
                      }
                      placeholder="21000"
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Gas 价格 (Gwei)</label>
                    <input
                      type="number"
                      className="input-field"
                      value={sendForm.gasPrice}
                      onChange={(e) =>
                        setSendForm({ ...sendForm, gasPrice: e.target.value })
                      }
                      placeholder="自动"
                    />
                  </div>
                </div>
              </div>

              {/* 交易预览 */}
              {sendForm.to && sendForm.amount && (
                <div className="bg-slate-50/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200">
                  <h5 className="font-semibold text-slate-800 mb-3">
                    📋 交易预览
                  </h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">发送金额:</span>
                      <span className="font-semibold">
                        {sendForm.amount} {currentNetwork?.symbol || "ETH"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">收款地址:</span>
                      <span className="font-mono text-xs">
                        {formatAddress(sendForm.to)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">预估手续费:</span>
                      <span className="text-slate-500">
                        ≈ 0.001 {currentNetwork?.symbol || "ETH"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">网络状态:</span>
                      <span
                        className={
                          networkStatus.connected
                            ? "text-green-600"
                            : "text-red-600"
                        }>
                        {networkStatus.connected ? "✅ 已连接" : "❌ 连接失败"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default WalletDashboard
