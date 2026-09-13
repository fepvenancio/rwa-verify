import { parseAbi } from "viem";

// ERC-3643 IERC3643 — own members only (IERC20 excluded), transcribed from specs/erc-3643.md.
// Interface return types IIdentityRegistry / ICompliance are addresses in the ABI.

export const erc3643Abi = parseAbi([
  "event UpdatedTokenInformation(string _newName, string _newSymbol, uint8 _newDecimals, string _newVersion, address _newOnchainID)",
  "event IdentityRegistryAdded(address indexed _identityRegistry)",
  "event ComplianceAdded(address indexed _compliance)",
  "event RecoverySuccess(address _lostWallet, address _newWallet, address _investorOnchainID)",
  "event AddressFrozen(address indexed _userAddress, bool indexed _isFrozen, address indexed _owner)",
  "event TokensFrozen(address indexed _userAddress, uint256 _amount)",
  "event TokensUnfrozen(address indexed _userAddress, uint256 _amount)",
  "event Paused(address _userAddress)",
  "event Unpaused(address _userAddress)",
  "function onchainID() view returns (address)",
  "function version() view returns (string)",
  "function identityRegistry() view returns (address)",
  "function compliance() view returns (address)",
  "function paused() view returns (bool)",
  "function isFrozen(address _userAddress) view returns (bool)",
  "function getFrozenTokens(address _userAddress) view returns (uint256)",
  "function setName(string _name)",
  "function setSymbol(string _symbol)",
  "function setOnchainID(address _onchainID)",
  "function pause()",
  "function unpause()",
  "function setAddressFrozen(address _userAddress, bool _freeze)",
  "function freezePartialTokens(address _userAddress, uint256 _amount)",
  "function unfreezePartialTokens(address _userAddress, uint256 _amount)",
  "function setIdentityRegistry(address _identityRegistry)",
  "function setCompliance(address _compliance)",
  "function forcedTransfer(address _from, address _to, uint256 _amount) returns (bool)",
  "function mint(address _to, uint256 _amount)",
  "function burn(address _userAddress, uint256 _amount)",
  "function recoveryAddress(address _lostWallet, address _newWallet, address _investorOnchainID) returns (bool)",
  "function batchTransfer(address[] _toList, uint256[] _amounts)",
  "function batchForcedTransfer(address[] _fromList, address[] _toList, uint256[] _amounts)",
  "function batchMint(address[] _toList, uint256[] _amounts)",
  "function batchBurn(address[] _userAddresses, uint256[] _amounts)",
  "function batchSetAddressFrozen(address[] _userAddresses, bool[] _freeze)",
  "function batchFreezePartialTokens(address[] _userAddresses, uint256[] _amounts)",
  "function batchUnfreezePartialTokens(address[] _userAddresses, uint256[] _amounts)",
]);

// IERC20 member read by erc3643.holder (IERC3643 is IERC20; the rest of IERC20 is not needed).
export const erc20BalanceOfAbi = parseAbi(["function balanceOf(address _owner) view returns (uint256)"]);

// IIdentityRegistry, transcribed from specs/erc-3643.md. IIdentity / IIdentityRegistryStorage /
// ITrustedIssuersRegistry / IClaimTopicsRegistry return types are addresses in the ABI.
export const identityRegistryAbi = parseAbi([
  "event ClaimTopicsRegistrySet(address indexed claimTopicsRegistry)",
  "event IdentityStorageSet(address indexed identityStorage)",
  "event TrustedIssuersRegistrySet(address indexed trustedIssuersRegistry)",
  "event IdentityRegistered(address indexed investorAddress, address indexed identity)",
  "event IdentityRemoved(address indexed investorAddress, address indexed identity)",
  "event IdentityUpdated(address indexed oldIdentity, address indexed newIdentity)",
  "event CountryUpdated(address indexed investorAddress, uint16 indexed country)",
  "function identityStorage() view returns (address)",
  "function issuersRegistry() view returns (address)",
  "function topicsRegistry() view returns (address)",
  "function setIdentityRegistryStorage(address _identityRegistryStorage)",
  "function setClaimTopicsRegistry(address _claimTopicsRegistry)",
  "function setTrustedIssuersRegistry(address _trustedIssuersRegistry)",
  "function registerIdentity(address _userAddress, address _identity, uint16 _country)",
  "function deleteIdentity(address _userAddress)",
  "function updateCountry(address _userAddress, uint16 _country)",
  "function updateIdentity(address _userAddress, address _identity)",
  "function batchRegisterIdentity(address[] _userAddresses, address[] _identities, uint16[] _countries)",
  "function contains(address _userAddress) view returns (bool)",
  "function isVerified(address _userAddress) view returns (bool)",
  "function identity(address _userAddress) view returns (address)",
  "function investorCountry(address _userAddress) view returns (uint16)",
]);

// ICompliance, transcribed from specs/erc-3643.md.
export const complianceAbi = parseAbi([
  "event TokenBound(address _token)",
  "event TokenUnbound(address _token)",
  "function bindToken(address _token)",
  "function unbindToken(address _token)",
  "function isTokenBound(address _token) view returns (bool)",
  "function getTokenBound() view returns (address)",
  "function canTransfer(address _from, address _to, uint256 _amount) view returns (bool)",
  "function transferred(address _from, address _to, uint256 _amount)",
  "function created(address _to, uint256 _amount)",
  "function destroyed(address _from, uint256 _amount)",
]);

// ITrustedIssuersRegistry, transcribed from specs/erc-3643.md. IClaimIssuer is an address; `uint` is uint256.
export const trustedIssuersRegistryAbi = parseAbi([
  "event TrustedIssuerAdded(address indexed trustedIssuer, uint256[] claimTopics)",
  "event TrustedIssuerRemoved(address indexed trustedIssuer)",
  "event ClaimTopicsUpdated(address indexed trustedIssuer, uint256[] claimTopics)",
  "function addTrustedIssuer(address _trustedIssuer, uint256[] _claimTopics)",
  "function removeTrustedIssuer(address _trustedIssuer)",
  "function updateIssuerClaimTopics(address _trustedIssuer, uint256[] _claimTopics)",
  "function getTrustedIssuers() view returns (address[])",
  "function isTrustedIssuer(address _issuer) view returns (bool)",
  "function getTrustedIssuerClaimTopics(address _trustedIssuer) view returns (uint256[])",
  "function getTrustedIssuersForClaimTopic(uint256 claimTopic) view returns (address[])",
  "function hasClaimTopic(address _issuer, uint256 _claimTopic) view returns (bool)",
]);

// IClaimTopicsRegistry, transcribed from specs/erc-3643.md.
export const claimTopicsRegistryAbi = parseAbi([
  "event ClaimTopicAdded(uint256 indexed claimTopic)",
  "event ClaimTopicRemoved(uint256 indexed claimTopic)",
  "function addClaimTopic(uint256 _claimTopic)",
  "function removeClaimTopic(uint256 _claimTopic)",
  "function getClaimTopics() view returns (uint256[])",
]);
