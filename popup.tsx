import React, { useEffect, useState } from "react"

import { AuthorizeConnection } from "~components/AuthorizeConnection"
import EIP6963AuthorizationPage from "~components/EIP6963AuthorizationPage"
import WalletDashboard from "~components/WalletDashboard"
import WalletSetup from "~components/WalletSetup"
import WalletUnlock from "~components/WalletUnlock"
import { WalletManager } from "~lib/wallet"

import "./style.css"
import "./popup.module.css"

function IndexPopup() {
  const [walletExists, setWalletExists] = useState<boolean>(false)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  // Check URL hash for authorization route
  const hash = window.location.hash
  const isAuthorizePage = hash.startsWith("#/authorize")
  const origin = isAuthorizePage
    ? new URLSearchParams(hash.split("?")[1]).get("origin")
    : null

  // 检查 URL 参数以确定是否为 EIP-6963 特殊页面
  const urlParams = new URLSearchParams(window.location.search)
  const action = urlParams.get("action")
  const requestId = urlParams.get("requestId")
  const legacyOrigin = urlParams.get("origin")

  const walletManager = WalletManager.getInstance()

  useEffect(() => {
    // 如果是 EIP-6963 授权页面，不需要检查钱包状态
    if (action === "eip6963-connect" && requestId && origin) {
      setLoading(false)
      return
    }

    // 如果是钱包连接页面，检查钱包状态
    if (action === "wallet-connect" && origin) {
      setLoading(false)
      checkWalletStatus()
      return
    }

    // 如果是解锁页面，检查钱包状态
    if (action === "unlock" && origin) {
      setLoading(false)
      checkWalletStatus()
      return
    }

    checkWalletStatus()
  }, [action, requestId, origin])

  const checkWalletStatus = async () => {
    try {
      const exists = await walletManager.walletExists()
      setWalletExists(exists)

      if (exists) {
        const walletState = await walletManager.getWalletState()
        setIsUnlocked(!!walletState && !walletState.isLocked)
      }
    } catch (error) {
      console.error("检查钱包状态失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleWalletCreated = () => {
    setWalletExists(true)
    setIsUnlocked(true)

    // 如果是钱包连接模式，通知 background script
    if (action === "wallet-connect") {
      chrome.runtime.sendMessage({
        type: "WALLET_CONNECT_RESULT",
        success: true
      })
      window.close()
    }
  }

  const handleWalletUnlocked = () => {
    console.log(`🔓 [Popup] 钱包解锁成功，action:`, action)
    setIsUnlocked(true)

    // 如果是钱包连接模式，通知 background script
    if (action === "wallet-connect") {
      console.log(`📤 [Popup] 发送 WALLET_CONNECT_RESULT 消息`)
      chrome.runtime.sendMessage({
        type: "WALLET_CONNECT_RESULT",
        success: true
      })
      window.close()
    }

    // 如果是解锁模式，通知 background script
    if (action === "unlock") {
      console.log(`📤 [Popup] 发送 WALLET_UNLOCK_RESULT 消息`)
      chrome.runtime.sendMessage(
        {
          type: "WALLET_UNLOCK_RESULT",
          success: true
        },
        (response) => {
          console.log(`✅ [Popup] WALLET_UNLOCK_RESULT 消息发送响应:`, response)
        }
      )
      // 稍微延迟关闭窗口，确保消息被发送
      setTimeout(() => {
        console.log(`🚪 [Popup] 关闭解锁窗口`)
        window.close()
      }, 50)
    }
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

  // Handle authorization page (new route: #/authorize?origin=...)
  if (isAuthorizePage && origin) {
    const handleApprove = () => {
      chrome.runtime.sendMessage({
        type: "AUTHORIZATION_RESPONSE",
        approved: true,
        origin: decodeURIComponent(origin)
      })
    }

    const handleReject = () => {
      chrome.runtime.sendMessage({
        type: "AUTHORIZATION_RESPONSE",
        approved: false,
        origin: decodeURIComponent(origin)
      })
    }

    return (
      <AuthorizeConnection
        origin={decodeURIComponent(origin)}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    )
  }

  // 渲染 EIP-6963 授权页面
  if (action === "eip6963-connect" && requestId && legacyOrigin) {
    return (
      <EIP6963AuthorizationPage
        requestId={requestId}
        origin={decodeURIComponent(legacyOrigin)}
        onClose={() => window.close()}
      />
    )
  }

  // 渲染解锁页面
  if (action === "unlock" && legacyOrigin) {
    if (!walletExists) {
      return (
        <div className="wallet-container">
          <div className="wallet-connect-header">
            <h2>❌ 连接到 {decodeURIComponent(origin)}</h2>
            <p>钱包不存在，请先创建钱包</p>
            <button
              onClick={() => {
                chrome.runtime.sendMessage({
                  type: "WALLET_UNLOCK_RESULT",
                  success: false,
                  error: "钱包不存在"
                })
                window.close()
              }}
              className="btn btn-secondary">
              关闭
            </button>
          </div>
        </div>
      )
    }

    if (!isUnlocked) {
      return (
        <div className="wallet-container">
          <div className="wallet-connect-header">
            <h2>🔓 连接到 {decodeURIComponent(origin)}</h2>
            <p>请解锁钱包以允许此网站连接</p>
          </div>
          <WalletUnlock
            onWalletUnlocked={handleWalletUnlocked}
            onCancel={() => {
              console.log(`❌ [Popup] 用户取消解锁`)
              chrome.runtime.sendMessage(
                {
                  type: "WALLET_UNLOCK_RESULT",
                  success: false,
                  error: "用户取消解锁"
                },
                (response) => {
                  console.log(`✅ [Popup] 取消解锁消息发送响应:`, response)
                }
              )
              setTimeout(() => {
                console.log(`🚪 [Popup] 关闭解锁窗口(取消)`)
                window.close()
              }, 50)
            }}
          />
        </div>
      )
    }

    // 钱包已解锁，应该会自动关闭
    return (
      <div className="wallet-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <span className="ml-3">连接中...</span>
        </div>
      </div>
    )
  }

  // 渲染钱包连接页面（设置或解锁）
  if (action === "wallet-connect" && origin) {
    if (!walletExists) {
      return (
        <div className="wallet-container">
          <div className="wallet-connect-header">
            <h2>🔗 连接到 {decodeURIComponent(origin)}</h2>
            <p>请先创建钱包以继续</p>
          </div>
          <WalletSetup onWalletCreated={handleWalletCreated} />
        </div>
      )
    }

    if (!isUnlocked) {
      return (
        <div className="wallet-container">
          <div className="wallet-connect-header">
            <h2>🔓 连接到 {decodeURIComponent(origin)}</h2>
            <p>请解锁钱包以继续</p>
          </div>
          <WalletUnlock
            onWalletUnlocked={handleWalletUnlocked}
            onCancel={() => {
              chrome.runtime.sendMessage({
                type: "WALLET_CONNECT_RESULT",
                success: false,
                error: "用户取消解锁"
              })
              window.close()
            }}
          />
        </div>
      )
    }

    // 钱包已解锁，应该会自动关闭
    return (
      <div className="wallet-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <span className="ml-3">连接中...</span>
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
