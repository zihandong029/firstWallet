import React, { useState, useEffect } from "react"
import { WalletManager } from "~lib/wallet"
import WalletSetup from "~components/WalletSetup"
import WalletUnlock from "~components/WalletUnlock"
import WalletDashboard from "~components/WalletDashboard"

import "./style.css"
import "./popup.module.css"

function IndexPopup() {
  const [walletExists, setWalletExists] = useState<boolean>(false)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  const walletManager = WalletManager.getInstance()

  useEffect(() => {
    checkWalletStatus()
  }, [])

  const checkWalletStatus = async () => {
    try {
      const exists = await walletManager.walletExists()
      setWalletExists(exists)
      
      if (exists) {
        const walletState = await walletManager.getWalletState()
        setIsUnlocked(!!walletState && !walletState.isLocked)
      }
    } catch (error) {
      console.error('检查钱包状态失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleWalletCreated = () => {
    setWalletExists(true)
    setIsUnlocked(true)
  }

  const handleWalletUnlocked = () => {
    setIsUnlocked(true)
  }

  const handleWalletLocked = () => {
    setIsUnlocked(false)
  }

  if (loading) {
    return (
      <div className="wallet-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <span className="ml-3">加载中...</span>
        </div>
      </div>
    )
  }

  if (!walletExists) {
    return (
      <div className="wallet-container">
        <WalletSetup onWalletCreated={handleWalletCreated} />
      </div>
    )
  }

  if (!isUnlocked) {
    return (
      <div className="wallet-container">
        <WalletUnlock onWalletUnlocked={handleWalletUnlocked} />
      </div>
    )
  }

  return (
    <div className="wallet-container">
      <WalletDashboard onWalletLocked={handleWalletLocked} />
    </div>
  )
}

export default IndexPopup
