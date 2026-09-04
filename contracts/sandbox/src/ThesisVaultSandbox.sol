// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ERC4626, ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice LOCAL-ONLY research prototype for asset-backed Hunter shares, not a live investment product.
/// @dev A single immutable same-asset ERC4626 venue. No arbitrary calls, swaps, oracle marks or upgrades.
/// Venue conversion/withdrawal behavior remains a trust dependency. A hash does not validate a strategy.
contract ThesisVaultSandbox is ERC4626, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC4626 public immutable venue;
    address public immutable executor;
    address public immutable guardian;
    bytes32 public immutable thesisHash;
    uint256 public immutable capitalLimit;
    uint256 public immutable perAllocationLimit;
    uint256 public immutable lifetimeAllocationLimit;
    uint64 public immutable allocationDeadline;
    uint256 public lifetimeAllocated;
    bool public allocationsPaused;
    event Allocated(uint256 assets, uint256 venueShares, bytes32 reportHash);
    event Deallocated(uint256 assets, uint256 venueShares, bytes32 reportHash);
    event AllocationsPaused();
    event InKindExit(address indexed owner, address indexed receiver, uint256 shares, uint256 idleAssets, uint256 venueShares);

    constructor(IERC20 asset_, IERC4626 venue_, address executor_, address guardian_, bytes32 thesisHash_, uint256 capitalLimit_, uint256 perAllocationLimit_, uint256 lifetimeAllocationLimit_, uint64 deadline_)
      ERC20("Hunter Thesis Sandbox Shares", "HTSS") ERC4626(asset_) {
        require(block.chainid == 31337, "Local sandbox only");
        require(address(asset_) != address(0) && venue_.asset() == address(asset_), "Same asset required");
        require(executor_ != address(0) && guardian_ != address(0) && thesisHash_ != bytes32(0), "Invalid authority or thesis");
        require(capitalLimit_ > 0 && perAllocationLimit_ > 0 && lifetimeAllocationLimit_ >= perAllocationLimit_, "Invalid limits");
        require(deadline_ > block.timestamp, "Invalid deadline");
        venue = venue_; executor = executor_; guardian = guardian_; thesisHash = thesisHash_;
        capitalLimit = capitalLimit_; perAllocationLimit = perAllocationLimit_; lifetimeAllocationLimit = lifetimeAllocationLimit_; allocationDeadline = deadline_;
    }
    function _decimalsOffset() internal pure override returns (uint8) { return 6; }
    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + venue.previewRedeem(venue.balanceOf(address(this)));
    }
    function maxDeposit(address) public view override returns (uint256) {
        if (allocationsPaused || block.timestamp > allocationDeadline) return 0;
        uint256 assets = totalAssets(); return assets >= capitalLimit ? 0 : capitalLimit - assets;
    }
    function maxMint(address receiver) public view override returns (uint256) { return convertToShares(maxDeposit(receiver)); }
    function maxRedeem(address owner) public view override returns (uint256) {
        uint256 owned = balanceOf(owner);
        uint256 liquid = IERC20(asset()).balanceOf(address(this)) + venue.maxWithdraw(address(this));
        return previewRedeem(owned) <= liquid ? owned : Math.min(owned, convertToShares(liquid));
    }
    function _deposit(address caller,address receiver,uint256 assets,uint256 shares) internal override nonReentrant {
        require(assets > 0 && shares > 0, "Zero deposit");
        super._deposit(caller,receiver,assets,shares);
    }
    function _withdraw(address caller,address receiver,address owner,uint256 assets,uint256 shares) internal override nonReentrant {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (assets > idle) venue.withdraw(assets-idle,address(this),address(this));
        super._withdraw(caller,receiver,owner,assets,shares);
    }
    function depositWithMinimum(uint256 assets,address receiver,uint256 minShares,uint64 expiresAt) external returns(uint256 shares) {
        require(block.timestamp <= expiresAt && minShares > 0, "Expired or unbounded quote");
        shares=deposit(assets,receiver); require(shares>=minShares,"Deposit slippage");
    }
    function redeemWithMinimum(uint256 shares,address receiver,uint256 minAssets,uint64 expiresAt) external returns(uint256 assets) {
        require(block.timestamp <= expiresAt && minAssets > 0, "Expired or unbounded quote");
        assets=redeem(shares,receiver,msg.sender); require(assets>=minAssets,"Redemption slippage");
    }
    function allocate(uint256 assets,uint256 minVenueShares,bytes32 reportHash) external nonReentrant returns(uint256 shares) {
        require(msg.sender==executor,"Executor only");
        require(!allocationsPaused && block.timestamp<=allocationDeadline,"Allocation disabled");
        require(assets>0 && assets<=perAllocationLimit && lifetimeAllocated+assets<=lifetimeAllocationLimit,"Allocation limit");
        require(minVenueShares>0 && reportHash!=bytes32(0),"Unbounded allocation");
        lifetimeAllocated+=assets;
        IERC20 token=IERC20(asset());
        token.forceApprove(address(venue),assets);
        shares=venue.deposit(assets,address(this));
        token.forceApprove(address(venue),0);
        require(shares>=minVenueShares,"Allocation slippage");
        emit Allocated(assets,shares,reportHash);
    }
    function deallocate(uint256 shares,uint256 minAssets,bytes32 reportHash) external nonReentrant returns(uint256 assets) {
        require(msg.sender==executor,"Executor only");
        require(shares>0 && minAssets>0 && reportHash!=bytes32(0),"Unbounded deallocation");
        assets=venue.redeem(shares,address(this),address(this));
        require(assets>=minAssets,"Deallocation slippage");
        emit Deallocated(assets,shares,reportHash);
    }
    function pauseAllocations() external {
        require(msg.sender==guardian,"Guardian only"); allocationsPaused=true; emit AllocationsPaused();
    }
    /// No venue redemption/valuation is required: a holder may take its proportional receipt shares.
    /// These receipt shares may themselves remain illiquid. This is not a guaranteed cash exit.
    function redeemInKind(uint256 shares,address receiver,uint256 minIdleAssets,uint256 minVenueShares) external nonReentrant returns(uint256 idleAssets,uint256 venueShares) {
        require(shares>0 && shares<=balanceOf(msg.sender) && receiver!=address(0) && receiver!=address(this),"Invalid exit");
        uint256 supply=totalSupply();
        idleAssets=Math.mulDiv(IERC20(asset()).balanceOf(address(this)),shares,supply);
        venueShares=Math.mulDiv(venue.balanceOf(address(this)),shares,supply);
        require(idleAssets>=minIdleAssets && venueShares>=minVenueShares,"Exit slippage");
        _burn(msg.sender,shares);
        if(idleAssets>0)IERC20(asset()).safeTransfer(receiver,idleAssets);
        if(venueShares>0)IERC20(address(venue)).safeTransfer(receiver,venueShares);
        emit InKindExit(msg.sender,receiver,shares,idleAssets,venueShares);
    }
}
