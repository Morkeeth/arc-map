// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Fixed-price research missions. Not an investment vault or a yield token.
/// @dev Native currency only. On Arc the native currency is USDC, with 18 decimal base units.
/// A receipt proves payment and a content commitment, not that research is true.
contract HunterEscrow {
    constructor() { require(block.chainid == 5042002 || block.chainid == 31337, "Test networks only"); }
    struct Mission {
        address owner;
        address executor;
        address payable service;
        uint256 remaining;
        uint256 fee;
        uint64 deadline;
        bool completed;
        bool closed;
        bytes32 thesisHash;
        bytes32 reportHash;
        bytes32 expectedReportHash;
    }
    mapping(bytes32 => Mission) public missions;
    uint256 private entered;
    event MissionOpened(bytes32 indexed id, address indexed owner, bytes32 thesisHash, uint256 budget, uint256 fee, address executor, address service, uint64 deadline);
    event MissionCompleted(bytes32 indexed id, bytes32 reportHash, uint256 fee);
    event MissionClosed(bytes32 indexed id, uint256 refund);
    modifier nonReentrant() { require(entered == 0, "Reentrant"); entered = 1; _; entered = 0; }

    function openMission(bytes32 id, bytes32 thesisHash, bytes32 expectedReportHash, address executor, address payable service, uint256 fee, uint64 deadline) external payable {
        require(id != bytes32(0) && thesisHash != bytes32(0) && expectedReportHash != bytes32(0), "Empty commitment");
        require(missions[id].owner == address(0), "Mission exists");
        require(executor != address(0) && service != address(0), "Zero authority");
        require(fee > 0 && msg.value >= fee && msg.value <= 10 ether, "Invalid budget");
        require(deadline > block.timestamp && deadline <= block.timestamp + 30 days, "Invalid deadline");
        missions[id] = Mission(msg.sender, executor, service, msg.value, fee, deadline, false, false, thesisHash, bytes32(0), expectedReportHash);
        emit MissionOpened(id, msg.sender, thesisHash, msg.value, fee, executor, service, deadline);
    }

    function completeMission(bytes32 id, bytes32 reportHash) external nonReentrant {
        Mission storage m = missions[id];
        require(msg.sender == m.executor, "Executor only");
        require(!m.completed && !m.closed && block.timestamp <= m.deadline, "Inactive mission");
        require(reportHash != bytes32(0), "Empty report");
        require(reportHash == m.expectedReportHash, "Report differs from approval");
        m.completed = true;
        m.reportHash = reportHash;
        m.remaining -= m.fee;
        (bool ok,) = m.service.call{value: m.fee}("");
        require(ok, "Payment failed");
        emit MissionCompleted(id, reportHash, m.fee);
    }

    /// Owner may revoke an uncompleted mission at any time, or withdraw surplus after completion.
    function closeMission(bytes32 id) external nonReentrant {
        Mission storage m = missions[id];
        require(msg.sender == m.owner, "Owner only");
        require(!m.closed, "Already closed");
        uint256 refund = m.remaining;
        m.remaining = 0;
        m.closed = true;
        (bool ok,) = payable(m.owner).call{value: refund}("");
        require(ok, "Refund failed");
        emit MissionClosed(id, refund);
    }
}
