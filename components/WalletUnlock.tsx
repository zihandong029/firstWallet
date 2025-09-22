import React, { useState } from "react"

import { WalletManager } from "~lib/wallet"

interface WalletUnlockProps {
  onWalletUnlocked: () => void
  onCancel?: () => void
}

const WalletUnlock: React.FC<WalletUnlockProps> = ({
  onWalletUnlocked,
  onCancel
}) => {
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const walletManager = WalletManager.getInstance()

  const handleUnlock = async () => {
    if (!password) {
      setError("请输入密码")
      return
    }

    setLoading(true)
    setError("")

    try {
      const success = await walletManager.unlockWallet(password)
      if (success) {
        onWalletUnlocked()
      } else {
        setError("密码错误")
      }
    } catch (err) {
      setError("解锁失败: " + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleUnlock()
    }
  }

  return (
    <div className="unlock-container">
      <div className="unlock-card">
        <div className="unlock-header">
          <div className="unlock-icon">🔐</div>
          <h1 className="unlock-title">解锁钱包</h1>
          <p className="unlock-subtitle">输入密码来解锁您的钱包</p>
        </div>

        <div className="unlock-form">
          <div className="input-wrapper">
            <input
              type="password"
              className="unlock-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入钱包密码"
              autoFocus
            />
            <div className="input-icon">🔒</div>
          </div>

          {error && <div className="unlock-error animate-shake">{error}</div>}

          <button
            className="unlock-button"
            onClick={handleUnlock}
            disabled={loading || !password}>
            {loading ? (
              <span className="button-content">
                <div className="unlock-spinner"></div>
                <span>解锁中...</span>
              </span>
            ) : (
              <span className="button-content">
                <span>解锁钱包</span>
                <span className="button-icon">🔓</span>
              </span>
            )}
          </button>

          {onCancel && (
            <button
              className="unlock-button unlock-button-secondary"
              onClick={onCancel}
              disabled={loading}>
              <span className="button-content">
                <span>取消</span>
                <span className="button-icon">❌</span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default WalletUnlock
