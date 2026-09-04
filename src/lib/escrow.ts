import { parseAbi } from "viem";
export const escrowAbi = parseAbi([
  "function openMission(bytes32 id, bytes32 thesisHash, bytes32 expectedReportHash, address executor, address service, uint256 fee, uint64 deadline) payable",
  "function completeMission(bytes32 id, bytes32 reportHash)",
  "function closeMission(bytes32 id)",
  "function missions(bytes32) view returns (address owner, address executor, address service, uint256 remaining, uint256 fee, uint64 deadline, bool completed, bool closed, bytes32 thesisHash, bytes32 reportHash, bytes32 expectedReportHash)",
  "event MissionOpened(bytes32 indexed id, address indexed owner, bytes32 thesisHash, uint256 budget, uint256 fee, address executor, address service, uint64 deadline)",
  "event MissionCompleted(bytes32 indexed id, bytes32 reportHash, uint256 fee)",
  "event MissionClosed(bytes32 indexed id, uint256 refund)",
]);
