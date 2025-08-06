import React, { useEffect, useState } from "react"

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

  const walletManager = WalletManager.getInstance()

  useEffect(() => {
    loadWalletData()
  }, [])

  const loadWalletData = async () => {
    try {
      const state = await walletManager.getWalletState()
      if (state) {
        setWalletState(state)
        await Promise.all([loadBalance(), testNetworkConnection()])
      }
    } catch (err) {
      console.error("加载钱包数据失败:", err)
    } finally {
      setLoading(false)
    }
  }

  const loadBalance = async () => {
    // try {
    //   const bal = await walletManager.getBalance()
    //   setBalance(bal)
    // } catch (err) {
    //   console.error('获取余额失败:', err)
    //   setBalance('0')
    //   setError('获取余额失败，请检查网络连接')
    // }
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
    await Promise.all([loadBalance(), testNetworkConnection()])
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
      <div className="dashboard-header">
        <div className="header-top">
          <h1 className="wallet-title">💎 我的钱包</h1>
          <div className="flex items-center gap-2">
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
            {parseFloat(balance).toFixed(4)} {currentNetwork?.symbol || "ETH"}
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
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              📊 交易记录
            </h3>
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📝</div>
              <div className="text-slate-500 font-medium">暂无交易记录</div>
              <div className="text-slate-400 text-sm mt-2">
                您的交易历史将在这里显示
              </div>
            </div>
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

            <div className="space-y-4">
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
