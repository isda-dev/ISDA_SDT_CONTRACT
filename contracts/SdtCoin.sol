pragma solidity >=0.5.0;

import "@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

/**
 * @title Sdt contract 
 */
contract SdtCoin is ERC20Mintable, ERC20Detailed {
    uint noOfTokens = 1000000000; // 1,000,000,000 (1B)

    // Address of sdtcoin vault
    // The vault will have all the sdtcoin issued and the operation
    // on its token will be protected by multi signing.
    // In addtion, vault can recall(transfer back) the reserved amount
    // from some address.
    address internal vault;

    // Address of sdtcoin owner
    // The owner can change admin and vault address, but the change operation
    // will be protected by multi signing.
    address internal owner;

    // Address of sdtcoin admin
    // The admin can change reserve. The reserve is the amount of token
    // assigned to some address but not permitted to use.
    // Once the signers of the admin agree with removing the reserve,
    // they can change the reserve to zero to permit the user to use all reserved
    // amount. So in effect, reservation will postpone the use of some tokens
    // being used until all stakeholders agree with giving permission to use that
    // token to the token owner.
    // All admin operation will be protected by multi signing.
    address internal admin;

    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event VaultChanged(address indexed previousVault, address indexed newVault);
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event ReserveChanged(address indexed _address, uint amount);
    event Recalled(address indexed from, uint amount);

    // for debugging
    event MsgAndValue(string message, bytes32 value);

    /**
     * @dev reserved number of tokens per each address
     *
     * To limit token transaction for some period by the admin or owner,
     * each address' balance cannot become lower than this amount
     *
     */
    mapping(address => uint) public reserves;

    /**
       * @dev modifier to limit access to the owner only
       */
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    /**
       * @dev limit access to the vault only
       */
    modifier onlyVault() {
        require(msg.sender == vault);
        _;
    }

    /**
       * @dev limit access to the admin only
       */
    modifier onlyAdmin() {
        require(msg.sender == admin);
        _;
    }

    /**
       * @dev limit access to admin or vault
       */
    modifier onlyAdminOrVault() {
        require(msg.sender == vault || msg.sender == admin);
        _;
    }

    /**
       * @dev limit access to owner or vault
       */
    modifier onlyOwnerOrVault() {
        require(msg.sender == owner || msg.sender == vault);
        _;
    }

    /**
       * @dev limit access to owner or admin
       */
    modifier onlyAdminOrOwner() {
        require(msg.sender == owner || msg.sender == admin);
        _;
    }

    /**
       * @dev limit access to owner or admin or vault
       */
    modifier onlyAdminOrOwnerOrVault() {
        require(msg.sender == owner || msg.sender == vault || msg.sender == admin);
        _;
    }

    /**
     * @dev initialize QRC20(ERC20)
     *
     * all token will deposit into the vault
     * later, the vault, owner will be multi sign contract to protect privileged operations
     *
     * @param _symbol token symbol
     * @param _name   token name
     * @param _owner  owner address
     * @param _admin  admin address
     * @param _vault  vault address
     */
    constructor (string memory _symbol, string memory _name, address _owner,
        address _admin, address _vault) ERC20Detailed(_name, _symbol, 18)
    public {
        require(bytes(_symbol).length > 0);
        require(bytes(_name).length > 0);

        owner = _owner;
        admin = _admin;
        vault = _vault;

        // int coins to the vault
        _mint(vault, noOfTokens * (10 ** uint(decimals())));
    }

    /**
     * @dev change the amount of reserved token
     *    reserve should be less than or equal to the current token balance
     *
     *    Refer to the comment on the admin if you want to know more.
     *
     * @param _address the target address whose token will be frozen for future use
     * @param _reserve  the amount of reserved token
     *
     */
    function setReserve(address _address, uint _reserve) public onlyAdmin {
        require(_reserve <= totalSupply());
        require(_address != address(0));

        reserves[_address] = _reserve;
        emit ReserveChanged(_address, _reserve);
    }

    /**
     * @dev transfer token from sender to other
     *         the result balance should be greater than or equal to the reserved token amount
     */
    function transfer(address _to, uint256 _value) public returns (bool) {
        // check the reserve
        require(balanceOf(msg.sender) - _value >= reserveOf(msg.sender));
        return super.transfer(_to, _value);
    }

    /**
     * @dev change vault address
     *    BEWARE! this withdraw all token from old vault and store it to the new vault
     *            and new vault's allowed, reserve will be set to zero
     * @param _newVault new vault address
     */
    function setVault(address _newVault) public onlyOwner {
        require(_newVault != address(0));
        require(_newVault != vault);

        address _oldVault = vault;

        // change vault address
        vault = _newVault;
        emit VaultChanged(_oldVault, _newVault);

        // vault cannot have any allowed or reserved amount!!!
        _approve(_newVault, msg.sender,  0);
        reserves[_newVault] = 0;

        // adjust balance
        uint _value = balanceOf(_oldVault);
        _transfer(_oldVault, _newVault, _value);
    }

    /**
     * @dev change owner address
     * @param _newOwner new owner address
     */
    function setOwner(address _newOwner) public onlyVault {
        require(_newOwner != address(0));
        require(_newOwner != owner);

        owner = _newOwner;
        emit OwnerChanged(owner, _newOwner);
    }

    /**
     * @dev change admin address
     * @param _newAdmin new admin address
     */
    function setAdmin(address _newAdmin) public onlyOwnerOrVault {
        require(_newAdmin != address(0));
        require(_newAdmin != admin);

        admin = _newAdmin;

        emit AdminChanged(admin, _newAdmin);
    }

    /**
     * @dev transfer a part of reserved amount to the vault
     *
     *    Refer to the comment on the vault if you want to know more.
     *
     * @param _from the address from which the reserved token will be taken
     * @param _amount the amount of token to be taken
     */
    function recall(address _from, uint _amount) public onlyAdmin {
        require(_from != address(0));
        require(_amount > 0);

        uint currentReserve = reserveOf(_from);
        uint currentBalance = balanceOf(_from);

        require(currentReserve >= _amount);
        require(currentBalance >= _amount);

        uint newReserve = currentReserve - _amount;
        reserves[_from] = newReserve;
        emit ReserveChanged(_from, newReserve);

        // transfer token _from to vault
        _transfer(_from, vault, _amount);
        emit Recalled(_from, _amount);
    }

    /**
     * @dev Transfer tokens from one address to another
     *
     * The _from's SDT balance should be larger than the reserved amount(reserves[_from]) plus _value.
     *
     */
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        require(_value <= balanceOf(_from).sub(reserves[_from]));
        return super.transferFrom(_from, _to, _value);
    }

    function getOwner() public view onlyAdminOrOwnerOrVault returns (address) {
        return owner;
    }

    function getVault() public view onlyAdminOrOwnerOrVault returns (address) {
        return vault;
    }

    function getAdmin() public view onlyAdminOrOwnerOrVault returns (address) {
        return admin;
    }

    function getOneSdt() public view returns (uint) {
        return (10 ** uint(decimals()));
    }

    /**
     * @dev get the amount of reserved token
     */
    function reserveOf(address _address) public view returns (uint _reserve) {
        return reserves[_address];
    }

    /**
     * @dev get the amount reserved token of the sender
     */
    function reserve() public view returns (uint _reserve) {
        return reserves[msg.sender];
    }
}
