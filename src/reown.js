import { createAppKit } from '@reown/appkit'
import { base } from '@reown/appkit/networks'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'

const projectId = 'f35797a6487f1faf465ec8f8c62eef10'

const metadata = {
  name: 'Baby Cats Mining',
  description: 'Connect your wallet to verify Baby Cats NFT ownership on Base.',
  url: window.location.origin,
  icons: [new URL('/baby-cats-logo.webp', window.location.origin).toString()]
}

const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [base],
  defaultNetwork: base,
  projectId,
  metadata,
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#ffd45c',
    '--w3m-border-radius-master': '12px'
  },
  features: {
    analytics: false,
    email: false,
    socials: []
  }
})

let eip155Provider = null
let accountState = null
let networkState = null
let connectingAddress = null
let switchInProgress = false

function status(message) {
  const element = document.getElementById('walletStatus')
  if (element) element.textContent = message
}

async function connectSelectedAccount() {
  if (!accountState?.isConnected || !accountState?.address || !eip155Provider) return
  const address = accountState.address.toLowerCase()
  if (connectingAddress === address || switchInProgress) return
  connectingAddress = address

  try {
    const chainHex = await eip155Provider.request({ method: 'eth_chainId' })
    const chainId = Number.parseInt(chainHex, 16)

    if (chainId !== base.id) {
      switchInProgress = true
      status('Cambiando la wallet a Base para verificar tus Baby Cats...')
      await appKit.switchNetwork(base)
      const confirmedChain = Number.parseInt(
        await eip155Provider.request({ method: 'eth_chainId' }),
        16
      )
      if (confirmedChain !== base.id) {
        status('Selecciona la red Base en tu wallet para continuar.')
        return
      }
    }

    connectingAddress = address
    if (typeof window.babyCatsOnConnected === 'function') {
      const verified = await window.babyCatsOnConnected(eip155Provider, address)
      if (verified !== true) connectingAddress = null
    }
  } catch (error) {
    connectingAddress = null
    console.error('Reown AppKit connection error:', error)
    status(error?.message || 'No se pudo conectar con Reown AppKit.')
  } finally {
    switchInProgress = false
  }
}

appKit.subscribeProviders(state => {
  eip155Provider = state?.['eip155'] || null
  if (!eip155Provider) connectingAddress = null
  void connectSelectedAccount()
})

appKit.subscribeAccount(state => {
  accountState = state
  if (!state?.isConnected || !state?.address) {
    connectingAddress = null
    if (typeof window.babyCatsOnDisconnected === 'function') {
      window.babyCatsOnDisconnected()
    }
    return
  }
  void connectSelectedAccount()
})

appKit.subscribeNetwork(state => {
  networkState = state
  if (accountState?.isConnected && state?.chainId === base.id) {
    void connectSelectedAccount()
  }
})

window.babyCatsOpenAppKit = () => appKit.open()
window.babyCatsDisconnect = () => appKit.disconnect()

window.addEventListener('beforeunload', () => {
  // Do not disconnect the wallet on page close; only release local references.
  eip155Provider = null
  accountState = null
  networkState = null
})

console.info('Baby Cats Reown AppKit initialized for Base.')
