"use client";
import { createContext, useContext, type ReactNode } from "react";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { arcTestnet } from "viem/chains";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  type Hex,
  type Address,
} from "viem";
import { PRIVY_APP_ID } from "@/lib/app-config";

type PreparedTransaction = {
  to: Address;
  data: Hex;
  value: string;
  chainId: number;
  account: Address;
  expiresAt: number;
};
type WalletState = {
  ready: boolean;
  address: string | null;
  connect: () => void;
  disconnect: () => void;
  send: (tx: PreparedTransaction) => Promise<Hex>;
};
const WalletContext = createContext<WalletState>({
  ready: false,
  address: null,
  connect: () => {},
  disconnect: () => {},
  send: async () => {
    throw new Error("Wallet unavailable.");
  },
});
export const useHunterWallet = () => useContext(WalletContext);
function WalletBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const wallet = authenticated ? wallets[0] : undefined;
  async function send(tx: PreparedTransaction): Promise<Hex> {
    if (!wallet || wallet.address.toLowerCase() !== tx.account.toLowerCase())
      throw new Error("Wallet changed. Prepare the action again.");
    if (tx.chainId !== arcTestnet.id || tx.expiresAt < Date.now())
      throw new Error("Transaction is stale or uses the wrong network.");
    await wallet.switchChain(arcTestnet.id);
    const provider = await wallet.getEthereumProvider();
    const client = createWalletClient({
      chain: arcTestnet,
      transport: custom(provider),
      account: wallet.address as Address,
    });
    if ((await client.getChainId()) !== arcTestnet.id)
      throw new Error("Switch to Arc testnet before continuing.");
    const hash = await client.sendTransaction({
      to: tx.to,
      data: tx.data,
      value: BigInt(tx.value),
    });
    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    });
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
      timeout: 60000,
    });
    if (receipt.status !== "success")
      throw new Error(`Transaction reverted: ${hash}`);
    return hash;
  }
  return (
    <WalletContext.Provider
      value={{
        ready: ready && walletsReady,
        address: wallet?.address || null,
        connect: login,
        disconnect: () => {
          void logout();
        },
        send,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        supportedChains: [arcTestnet],
        defaultChain: arcTestnet,
        loginMethods: ["email", "wallet"],
        appearance: {
          theme: "light",
          accentColor: "#326BFF",
          walletChainType: "ethereum-only",
        },
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      <WalletBridge>{children}</WalletBridge>
    </PrivyProvider>
  );
}
