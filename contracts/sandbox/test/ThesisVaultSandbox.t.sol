// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "../src/ThesisVaultSandbox.sol";
interface VaultVm { function prank(address) external; function expectRevert() external; function expectRevert(bytes calldata) external; function warp(uint256) external; function chainId(uint256) external; }
contract SandboxAsset is ERC20 {
    constructor() ERC20("LOCAL ONLY Mock USDC", "mUSDC") {}
    function decimals() public pure override returns(uint8){return 6;}
    function mint(address to,uint256 amount) external {_mint(to,amount);}
    function simulateLoss(address from,uint256 amount) external {_burn(from,amount);}
}
contract SandboxVenue is ERC4626 {
    bool public frozen;
    constructor(IERC20 asset_) ERC20("LOCAL ONLY Venue Receipt","mVR") ERC4626(asset_) {}
    function freeze() external {frozen=true;}
    function maxRedeem(address owner) public view override returns(uint256){return frozen?0:super.maxRedeem(owner);}
}
contract ThesisVaultSandboxTest {
    VaultVm constant vm=VaultVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    SandboxAsset asset; SandboxVenue venue; ThesisVaultSandbox vault;
    address alice=address(0xA11CE);address bob=address(0xB0B);address executor=address(0xE1);address guardian=address(0xF1);
    bytes32 report=keccak256("Local simulated strategy research, not live performance");
    function setUp() public {
        asset=new SandboxAsset();venue=new SandboxVenue(asset);
        vault=new ThesisVaultSandbox(asset,venue,executor,guardian,keccak256("Pinned thesis"),1000e6,100e6,200e6,uint64(block.timestamp+1 days));
        asset.mint(alice,1000e6);asset.mint(bob,1000e6);
        vm.prank(alice);asset.approve(address(vault),1000e6);vm.prank(bob);asset.approve(address(vault),1000e6);
    }
    function deposit(address who,uint256 assets) internal returns(uint256 shares){uint256 quote=vault.previewDeposit(assets);vm.prank(who);return vault.depositWithMinimum(assets,who,quote,uint64(block.timestamp+60));}
    function allocate(uint256 assets) internal {uint256 minShares=venue.previewDeposit(assets);vm.prank(executor);vault.allocate(assets,minShares,report);}
    function testSharesRepresentActualAssetsAndRedeem() public {
        uint256 shares=deposit(alice,100e6);require(shares>0 && vault.totalAssets()==100e6,"Missing asset backing");
        vm.prank(alice);uint256 assets=vault.redeemWithMinimum(shares,alice,100e6,uint64(block.timestamp+60));
        require(assets==100e6 && asset.balanceOf(alice)==1000e6 && vault.totalSupply()==0,"Redemption mismatch");
    }
    function testAllocationCannotRedirectOrKeepAllowance() public {
        deposit(alice,100e6);allocate(60e6);
        require(asset.balanceOf(address(vault))==40e6 && venue.balanceOf(address(vault))>0,"Wrong allocation");
        require(asset.allowance(address(vault),address(venue))==0,"Approval remained open");
        vm.expectRevert(bytes("Executor only"));vault.allocate(1e6,1,report);
    }
    function testWithdrawUnwindsVenueWithoutExecutorApproval() public {
        uint256 shares=deposit(alice,100e6);allocate(80e6);
        vm.prank(alice);uint256 out=vault.redeem(shares,alice,alice);
        require(out==100e6 && asset.balanceOf(alice)==1000e6,"Holder could not exit");
    }
    function testLossChangesRedemptionValueNotInventedYield() public {
        uint256 shares=deposit(alice,100e6);allocate(80e6);asset.simulateLoss(address(venue),20e6);
        uint256 quote=vault.previewRedeem(shares);require(quote<=80e6+1 && quote>=80e6-2,"Loss not marked");
        vm.prank(alice);uint256 out=vault.redeem(shares,alice,alice);require(out==quote,"Loss redemption differs");
    }
    function testDonatedVenueAssetsAreAccountedNotPromisedReturns() public {
        uint256 shares=deposit(alice,100e6);allocate(80e6);asset.mint(address(venue),20e6);
        uint256 quote=vault.previewRedeem(shares);require(quote>119e6 && quote<=120e6,"Backing change not reflected");
    }
    function testPauseStopsNewCapitalNotHolderExit() public {
        uint256 shares=deposit(alice,100e6);allocate(80e6);vm.prank(guardian);vault.pauseAllocations();
        vm.expectRevert(bytes("Allocation disabled"));vm.prank(executor);vault.allocate(1e6,1,report);
        require(vault.maxDeposit(bob)==0,"Deposits not paused");vm.prank(alice);vault.redeem(shares,alice,alice);
    }
    function testFrozenVenueStillAllowsProportionalInKindExit() public {
        uint256 shares=deposit(alice,100e6);allocate(80e6);venue.freeze();
        require(vault.maxWithdraw(alice)<=20e6,"False liquid exit advertised");
        vm.prank(alice);(uint256 idle,uint256 receipts)=vault.redeemInKind(shares,alice,20e6,80e6);
        require(idle==20e6 && receipts==80e6 && vault.totalSupply()==0,"Incorrect in-kind exit");
        require(venue.balanceOf(alice)==80e6,"Receipt claim lost");
    }
    function testPerCallLifetimeAndDeadlinePolicy() public {
        deposit(alice,300e6);vm.expectRevert(bytes("Allocation limit"));vm.prank(executor);vault.allocate(101e6,1,report);
        allocate(100e6);allocate(100e6);vm.expectRevert(bytes("Allocation limit"));vm.prank(executor);vault.allocate(1e6,1,report);
        vm.warp(block.timestamp+2 days);vm.expectRevert(bytes("Allocation disabled"));vm.prank(executor);vault.allocate(1,1,report);
    }
    function testShareTransferMovesTheClaimNotAnotherUsersBalance() public {
        uint256 shares=deposit(alice,100e6);vm.prank(alice);vault.transfer(bob,shares/2);
        vm.prank(bob);uint256 out=vault.redeem(shares/2,bob,bob);require(out==50e6,"Transferred claim invalid");
        vm.expectRevert();vm.prank(bob);vault.redeem(shares/2,bob,alice);
    }
    function testSlippageAndDonationDoNotMintZeroShares() public {
        deposit(alice,1);asset.mint(address(vault),100e6);
        uint256 quote=vault.previewDeposit(100e6);require(quote>0,"Zero share quote");
        vm.expectRevert(bytes("Deposit slippage"));vm.prank(bob);vault.depositWithMinimum(100e6,bob,quote+1,uint64(block.timestamp+60));
        require(asset.balanceOf(bob)==1000e6,"Failed quote took assets");
    }
    function testCannotDeployOnArcOrMainnet() public {
        vm.chainId(5042002);vm.expectRevert(bytes("Local sandbox only"));new ThesisVaultSandbox(asset,venue,executor,guardian,report,1000e6,100e6,200e6,uint64(block.timestamp+1 days));
        vm.chainId(1);vm.expectRevert(bytes("Local sandbox only"));new ThesisVaultSandbox(asset,venue,executor,guardian,report,1000e6,100e6,200e6,uint64(block.timestamp+1 days));
    }
}
