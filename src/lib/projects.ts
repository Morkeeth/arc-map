export type Project = {
  id: string;
  name: string;
  symbol: string;
  category: string;
  summary: string;
  question: string;
  context: string;
  website: string;
  reference: string;
  relation: string;
  repo?: string;
  contract?: string;
  researchKind?: "token" | "contract";
};

// A curated source catalog, not invented activity or a complete ecosystem census.
export const projects: Project[] = [
  {
    id: "sun-token",
    name: "Sun Token",
    symbol: "SUN",
    category: "Experiments",
    summary: "An Arc testnet token with a distribution worth inspecting.",
    question: "A crowd of holders. But who came back?",
    context:
      "Holder totals tell us about addresses, not people. Inspect transfers before inferring adoption.",
    website:
      "https://testnet.arcscan.app/token/0x02A0545E0f6Dce7E0Fb68Bc4ed0e9688e29e6Ee1",
    reference:
      "https://testnet.arcscan.app/token/0x02A0545E0f6Dce7E0Fb68Bc4ed0e9688e29e6Ee1",
    relation:
      "Contract identity comes from Arcscan. No official website, social account or repository association has been established.",
    contract: "0x02A0545E0f6Dce7E0Fb68Bc4ed0e9688e29e6Ee1",
  },
  {
    id: "arc-node",
    name: "Arc node",
    symbol: "ARC",
    category: "Infrastructure",
    summary: "The open-source software behind Arc Testnet.",
    question: "What is changing beneath the chain?",
    context:
      "A repository change is evidence of code work, not proof that the running network has upgraded.",
    website: "https://github.com/circlefin/arc-node",
    reference:
      "https://community.arc.io/public/blogs/arc-opens-its-code-its-nodes-and-a-formal-path-to-break-it-before-mainnet",
    relation:
      "Arc's published open-source announcement links to this repository.",
    repo: "circlefin/arc-node",
  },
  {
    id: "circle-agent-stack",
    name: "Circle Agent Stack",
    symbol: "CAS",
    category: "Agents",
    summary:
      "Starter kits for agents that use wallets, services and USDC payments.",
    question: "An agent with a wallet. What can it actually do?",
    context:
      "Read the code trail and integration requirements. A starter kit is not a deployed autonomous business.",
    website: "https://www.circle.com/agent-stack",
    reference: "https://github.com/circlefin/agent-stack-starter-kits",
    relation:
      "Circle-owned source repository for Agent Stack. Multichain tooling, not an Arc-only deployed contract.",
    repo: "circlefin/agent-stack-starter-kits",
  },
  {
    id: "dromos-labs",
    name: "Dromos Labs",
    symbol: "DR",
    category: "Trading",
    summary:
      "Named among the DEX teams in Circle's Arc public-testnet announcement.",
    question: "Announced is one thing. What is live?",
    context:
      "The announcement establishes an ecosystem association. This catalog has not verified its live app or Arc contracts.",
    website:
      "https://www.circle.com/pressroom/circle-launches-arc-public-testnet",
    reference:
      "https://www.circle.com/pressroom/circle-launches-arc-public-testnet",
    relation:
      "Circle's announcement names Dromos Labs. No contract or repository is inferred from the name.",
  },
];

export const findProject = (id: string) =>
  projects.find((project) => project.id === id);
export const graphCovers = (address: string) =>
  address.toLowerCase() === projects[0].contract!.toLowerCase();
export const sourceIds = (project: Project) => [
  ...(project.repo ? [`github:${project.repo}`] : []),
  ...(project.contract
    ? [`arc-testnet:${project.contract.toLowerCase()}`]
    : []),
];
