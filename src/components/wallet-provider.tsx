"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
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
import type { PreparedMissionTransaction } from "@/lib/funding-types";

type WalletState = {
  ready: boolean;
  address: string | null;
  wallets: { address: string; kind: "embedded" | "external" }[];
  select: (address: string) => void;
  connect: () => void;
  disconnect: () => void;
  switchToArc: () => Promise<void>;
  send: (tx: PreparedMissionTransaction) => Promise<Hex>;
};
const WalletContext = createContext<WalletState>({
  ready: false,
  address: null,
  wallets: [],
  select: () => {},
  connect: () => {},
  disconnect: () => {},
  switchToArc: async () => {},
  send: async () => {
    throw new Error("Wallet unavailable.");
  },
});
export const useHunterWallet = () => useContext(WalletContext);
function WalletBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const linkedWallets = new Set(
    (user?.linkedAccounts ?? [])
      .filter(
        (account) =>
          (account.type === "wallet" || account.type === "smart_wallet") &&
          "address" in account,
      )
      .map((account) => String(account.address).toLowerCase()),
  );
  const connectedWallets = authenticated
    ? wallets.filter((candidate) =>
        linkedWallets.has(candidate.address.toLowerCase()),
      )
    : [];
  const wallet =
    connectedWallets.find(
      (candidate) =>
        candidate.address.toLowerCase() === selectedAddress?.toLowerCase(),
    ) ?? connectedWallets[0];
  useEffect(() => {
    if (
      connectedWallets.length &&
      !connectedWallets.some(
        (candidate) =>
          candidate.address.toLowerCase() === selectedAddress?.toLowerCase(),
      )
    )
      setSelectedAddress(connectedWallets[0].address);
    if (!connectedWallets.length && selectedAddress) setSelectedAddress(null);
  }, [connectedWallets, selectedAddress]);
  async function switchToArc() {
    if (!wallet) throw new Error("Connect a linked Privy wallet first.");
    await wallet.switchChain(arcTestnet.id);
  }
  async function send(tx: PreparedMissionTransaction): Promise<Hex> {
    if (!wallet || wallet.address.toLowerCase() !== tx.account.toLowerCase())
      throw new Error("Wallet changed. Prepare the action again.");
    if (
      tx.chainId !== arcTestnet.id ||
      Date.parse(tx.expiresAt) < Date.now()
    )
      throw new Error("Transaction is stale or uses the wrong network.");
    if (
      tx.action === "fund" &&
      (!tx.policy ||
        tx.policy.account.toLowerCase() !== wallet.address.toLowerCase() ||
        tx.policy.chainId !== tx.chainId ||
        tx.policy.target.toLowerCase() !== tx.to.toLowerCase() ||
        tx.policy.calldata !== tx.data ||
        tx.policy.amount !== tx.value)
    )
      throw new Error("Prepared funding policy changed before signature.");
    const provider = await wallet.getEthereumProvider();
    const client = createWalletClient({
      chain: arcTestnet,
      transport: custom(provider),
      account: wallet.address as Address,
    });
    if ((await client.getChainId()) !== arcTestnet.id)
      throw new Error(
        "Wrong chain. Switch the linked Privy wallet to Arc testnet before signing.",
      );
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
        wallets: connectedWallets.map((candidate) => ({
          address: candidate.address,
          kind:
            candidate.walletClientType === "privy" ? "embedded" : "external",
        })),
        select: setSelectedAddress,
        connect: login,
        disconnect: () => {
          void logout();
        },
        switchToArc,
        send,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
export function WalletProvider({ children }: { children: ReactNode }) {
  if(process.env.NEXT_PUBLIC_RESEARCH_PREVIEW === "1") return <>{children}</>;
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
