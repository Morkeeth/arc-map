// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "../src/HunterEscrow.sol";
interface Vm { function deal(address,uint256) external; function prank(address) external; function expectRevert(bytes calldata) external; function warp(uint256) external; function chainId(uint256) external; }
contract RejectingPayee { receive() external payable { revert("Rejected"); } }
contract ReenteringPayee {
    HunterEscrow target; bytes32 id; bytes32 report; bool public reentered;
    constructor(HunterEscrow t, bytes32 i, bytes32 r) { target=t;id=i;report=r; }
    receive() external payable { (reentered,) = address(target).call(abi.encodeCall(target.completeMission,(id,report))); }
}
contract HunterEscrowTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    HunterEscrow escrow;
    address owner = address(0x1001);
    address executor = address(0x1002);
    address payable service = payable(address(0x1003));
    bytes32 id = keccak256("mission");
    bytes32 thesis = keccak256("thesis");
    bytes32 report = keccak256("report");
    function setUp() public { escrow = new HunterEscrow(); vm.deal(owner, 10 ether); }
    function open() internal { vm.prank(owner); escrow.openMission{value: 2 ether}(id, thesis, report, executor, service, 0.1 ether, uint64(block.timestamp + 1 days)); }
    function testPayOnceAndRefundSurplus() public {
        open(); vm.prank(executor); escrow.completeMission(id, report);
        require(service.balance == 0.1 ether, "Fixed fee not paid");
        vm.expectRevert(bytes("Inactive mission")); vm.prank(executor); escrow.completeMission(id, report);
        vm.prank(owner); escrow.closeMission(id);
        require(owner.balance == 9.9 ether && address(escrow).balance == 0, "Incorrect refund");
    }
    function testUnauthorizedExecutionAndRefund() public {
        open(); vm.expectRevert(bytes("Executor only")); escrow.completeMission(id, report);
        vm.expectRevert(bytes("Owner only")); escrow.closeMission(id);
    }
    function testCancelRevokesExecutor() public {
        open(); vm.prank(owner); escrow.closeMission(id);
        vm.expectRevert(bytes("Inactive mission")); vm.prank(executor); escrow.completeMission(id, report);
        require(owner.balance == 10 ether, "Lost cancelled funds");
    }
    function testExpiryAndRefund() public {
        open(); vm.warp(block.timestamp + 2 days);
        vm.expectRevert(bytes("Inactive mission")); vm.prank(executor); escrow.completeMission(id, report);
        vm.prank(owner); escrow.closeMission(id); require(owner.balance == 10 ether, "Expired refund");
    }
    function testDuplicateMission() public { open(); vm.expectRevert(bytes("Mission exists")); open(); }
    function testUnderfunded() public {
        vm.expectRevert(bytes("Invalid budget")); vm.prank(owner);
        escrow.openMission{value: 1}(id, thesis, report, executor, service, 2, uint64(block.timestamp + 1 days));
    }
    function testChangedReportCannotCollect() public { open(); vm.expectRevert(bytes("Report differs from approval")); vm.prank(executor); escrow.completeMission(id, keccak256("changed")); }
    function testMainnetDeploymentBlocked() public { vm.chainId(1); vm.expectRevert(bytes("Test networks only")); new HunterEscrow(); }
    function testBudgetCeilingEnforcedOnchain() public {
        vm.deal(owner,11 ether); vm.expectRevert(bytes("Invalid budget")); vm.prank(owner);
        escrow.openMission{value:11 ether}(id,thesis,report,executor,service,0.1 ether,uint64(block.timestamp+1 days));
    }
    function testRejectedPayeeDoesNotConsumeBudget() public {
        RejectingPayee rejector = new RejectingPayee(); vm.prank(owner);
        escrow.openMission{value: 2 ether}(id, thesis, report, executor, payable(address(rejector)), 0.1 ether, uint64(block.timestamp + 1 days));
        vm.expectRevert(bytes("Payment failed")); vm.prank(executor); escrow.completeMission(id, report);
        require(address(escrow).balance == 2 ether, "Budget consumed on failure");
        vm.prank(owner); escrow.closeMission(id); require(owner.balance == 10 ether, "Cannot recover failed payment");
    }
    function testPayeeCannotReenterSettlement() public {
        ReenteringPayee payee = new ReenteringPayee(escrow,id,report); vm.prank(owner);
        escrow.openMission{value: 2 ether}(id, thesis, report, address(payee), payable(address(payee)), 0.1 ether, uint64(block.timestamp + 1 days));
        vm.prank(address(payee)); escrow.completeMission(id,report);
        require(!payee.reentered() && address(payee).balance == 0.1 ether, "Reentrant payment");
        vm.prank(owner); escrow.closeMission(id);require(owner.balance == 9.9 ether,"Surplus lost");
    }
    function testZeroReport() public { open(); vm.expectRevert(bytes("Empty report")); vm.prank(executor); escrow.completeMission(id, bytes32(0)); }
}
