// 扩展 Window 接口以包含自定义属性
declare global {
  interface Window {
    myWallet?: {
      connect: () => Promise<any>
      disconnect: () => Promise<any>
      getAccount: () => Promise<any>
      signMessage: (message: string) => Promise<string>
      getStatus: () => any
    }
    myWalletInjected?: boolean
    hello?: {
      world: string
      myWalletVersion?: string
      coolNumber?: number
    }
  }
}

export {}