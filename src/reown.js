import { createAppKit } from '@reown/appkit'
import {
  mainnet,
  base,
  bsc,
  polygon,
  arbitrum,
  optimism,
  avalanche,
  linea,
  celo,
  gnosis,
  scroll,
  zksync,
  mantle,
  fantom,
  cronos
} from '@reown/appkit/networks'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'

const projectId = 'f35797a6487f1faf465ec8f8c62eef10'

// Wait briefly for EIP-6963 wallet announcements before deciding whether
// Reown is needed. Injected providers may announce asynchronously after page load.
function getNativeOkxProvider() {
  const announced = window.__babyCatsOkxProvider
  const candidates = [
    window.okxwallet,
    window.okxwallet?.ethereum,
    announced,
    (window.ethereum?.isOkxWallet || window.ethereum?.isOKXWallet) ? window.ethereum : null
  ]
  return candidates.find(provider => provider && typeof provider.request === 'function') || null
}

if (!getNativeOkxProvider()) {
  await new Promise(resolve => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.removeEventListener('eip6963:announceProvider', onAnnouncement)
      clearTimeout(timer)
      resolve()
    }
    const onAnnouncement = event => {
      const info = event?.detail?.info || {}
      const provider = event?.detail?.provider
      const isOkx = String(info.rdns || '').toLowerCase().includes('okx') ||
        String(info.name || '').toLowerCase().includes('okx')
      if (isOkx && provider && typeof provider.request === 'function') {
        window.__babyCatsOkxProvider = provider
        finish()
      }
    }
    const timer = setTimeout(finish, 700)
    window.addEventListener('eip6963:announceProvider', onAnnouncement)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    if (getNativeOkxProvider()) finish()
  })
}

// In the OKX in-app browser, use its injected EIP-1193 provider directly.
// Do not initialize a second modal/provider that could negotiate a fixed chain list.
const nativeOkx = getNativeOkxProvider()
if (nativeOkx) {
  console.info('Native OKX provider detected; skipping Reown initialization.')
} else {

// Baby Cats NFT ownership is checked on Base by the backend.
// The wallet itself may connect while using any configured EVM network.
const networks = [
  mainnet,
  base,
  bsc,
  polygon,
  arbitrum,
  optimism,
  avalanche,
  linea,
  celo,
  gnosis,
  scroll,
  zksync,
  mantle,
  fantom,
  cronos
]

const metadata = {
  name: 'Baby Cats Mining',
  description: 'Connect an EVM wallet to verify Baby Cats NFT ownership on Base.',
  url: window.location.origin,
  icons: [new URL('/baby-cats-logo.webp', window.location.origin).toString()]
}

const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks,
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
let connectingAddress = null

function status(message) {
  const element = document.getElementById('walletStatus')
  if (element) element.textContent = message
}

async function connectSelectedAccount() {
  if (!accountState?.isConnected || !accountState?.address || !eip155Provider) return

  const address = accountState.address.toLowerCase()
  if (connectingAddress === address) return
  connectingAddress = address

  try {
    // Do not switch the user's wallet network. NFT ownership is checked
    // independently by the server against the Baby Cats contract on Base.
    const accounts = await eip155Provider.request({ method: 'eth_accounts' })
    if (!Array.isArray(accounts) || !accounts[0] ||
        accounts[0].toLowerCase() !== address) {
      throw new Error('La cuenta de la wallet no coincide con la seleccionada.')
    }

    status('Wallet conectada. Verificando tus Baby Cats en Base...')
    if (typeof window.babyCatsOnConnected === 'function') {
      const verified = await window.babyCatsOnConnected(eip155Provider, address)
      if (verified !== true) connectingAddress = null
    }
  } catch (error) {
    connectingAddress = null
    console.error('Reown AppKit connection error:', error)
    status(error?.message || 'No se pudo conectar con Reown AppKit.')
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

appKit.subscribeNetwork(() => {
  // A network change must never trigger an automatic chain switch.
  // Reown updates its provider; the account callback handles verification.
})

window.babyCatsOpenAppKit = () => appKit.open()
window.babyCatsDisconnect = () => appKit.disconnect()

window.addEventListener('beforeunload', () => {
  eip155Provider = null
  accountState = null
})

console.info('Baby Cats Reown AppKit initialized for multiple EVM networks.')
}
