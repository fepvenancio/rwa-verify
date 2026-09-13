# Known ERC-3643 tokens on Ethereum mainnet

Discovered automatically by `packages/sdk/scripts/scan-erc3643.mts` from `IdentityRegistryAdded(address)` events (Blockscout logs), then verified with `@rwa-verify/sdk` against a public RPC on 2026-09-13. Public on-chain data; no endorsement implied.

- 130 distinct emitters scanned, 130 verify as ERC-3643 (`identityRegistry` and `compliance` pass), 100 of those are not paused.
- None implement ERC-165, so the ERC-3643 checks probe `identityRegistry()` / `compliance()` / `paused()` directly rather than gating on `supportsInterface`.

| Token | Name | Symbol | paused | identityRegistry | compliance |
|---|---|---|---|---|---|
| `0xcb32569cac906e4ee13ca413e058a7178fa1fc27` | Enegra | EGX | fail | pass | pass |
| `0xa4cba3f89d30184bf213172fea2c6241bd27911e` | TREXDINO | TREX | pass | pass | pass |
| `0x63c18e21eed171435b42b7e042f4dcf3602dbec5` | FLYT TOKEN | FLYT | pass | pass | pass |
| `0x1bf2b7d4f859cd82b86226b1eae88ef47cfc5678` | MetalStream | MTLSTR | fail | pass | pass |
| `0xdd553c35e1dd65ec04abe9b4107c2630b6f10563` | MetalStream Gold | MSGLD | fail | pass | pass |
| `0x4472ac418051bfbd5f6605477dd6b9f11ddbc121` | CryptoNode | CNODE | fail | pass | pass |
| `0x7152dbc938b7ac7d35c396424b1ac446f0d64b96` | Sonata Capital | SONATA | pass | pass | pass |
| `0x81083074be2a2002ba596280f21ce08c41f31853` | Sonata Asia Growth Fund | SAGF | fail | pass | pass |
| `0x8614e95a8cf4f48aea55d5f8477df976ce7431f9` | TREXDINO | TREX | pass | pass | pass |
| `0x679c36c9c565704cf2b3760d0c32d5fe373ca35e` | DSX Global | DSX | fail | pass | pass |
| `0xdc6276d9e354f0024bc3b39e9790695e91ae0ec3` | Sonata Capital | SONATA | fail | pass | pass |
| `0x44a118d3bf6ce19699c2a4013c668357d9c71ab1` | Blockchain Labs Asia | BLABS | fail | pass | pass |
| `0x87c38aada530467af413dfad444e9d712542e341` | TREXDINO | TREX | pass | pass | pass |
| `0xba226ab8135999e7d5bc147132340925d1fb6305` | Test Token | TT | fail | pass | pass |
| `0xc1f8aa1ba9cef0b7e3e0e7887687e176c66759cc` | Tokeny | TOK | fail | pass | pass |
| `0x287a4ce8e2c4f045dea7bc7c0cd7f1cbc749b28d` | DSX Asia | DSXA | pass | pass | pass |
| `0x6fb975af85262ee9d0f7ce3db83172db8e4295b6` | Blockchain Labs Asia | BLABS | pass | pass | pass |
| `0xe76456fbc4aba7d31e2125152b9f9150962cdd80` | Sonata Asia Growth Fund | SAGF | pass | pass | pass |
| `0x77e141a26b8f7fa42ffebe02cc4b8dd03cc6c05e` | Sonata Capital | SONATA | pass | pass | pass |
| `0x3054c53193f7c8624628a5ce0949c56da94443d6` | MetalStream Gold | MSGLD | fail | pass | pass |
| `0xe44dce4f87c8f245dc688adb1fdec054938a984f` | ForceTransferTest | FTT | fail | pass | pass |
| `0xafeb62b10d92ae0ddf187f8d30f1c0b427c554d0` | TIGRIS S17A | S17A | pass | pass | pass |
| `0x2ec546c9d487ac8cb7bf5b32c521e1af6240d1d0` | ASN Cement | ASNC | pass | pass | pass |
| `0x66b1f37a8afbf7119692166394b96a8601938a33` | SEACS | SEACS | pass | pass | pass |
| `0x9da26b5e4c5aa39ff37d39ad142ddb690ef631e0` | South Pacific Metals & Miner | SPMM | pass | pass | pass |
| `0x6e534da0cbfeed25fad935d213615001fe7a71be` | Correll8 | CRL8 | pass | pass | pass |
| `0x869aae776bd2cd2c4256a8d81a12cc9a4209e8b8` | MetalStream Silver | MSSLV | pass | pass | pass |
| `0xf6c5e53dd4db0caac2b08596e96a98ffa7ca8fac` | MetalStream Palladium | MSPLD | pass | pass | pass |
| `0x4bdbd3f9409f29ea8b81de909a0cc0844d27411e` | MetalStream Platinum | MSPLT | pass | pass | pass |
| `0xd5a4e199cdfb0f69455fed60aab1b204cf126a76` | MetalStream Rhodium | MSRHD | pass | pass | pass |
| `0x43bce7a595ec1fbc1a562cd4c714852bcc2645ac` | MetalStream Precious Metals  | MSPMP | pass | pass | pass |
| `0x4003252ae82768daab83b3d14b13a5fa8f0c0c60` | FLYT | FLYT | fail | pass | pass |
| `0x28ee3d3b2ab257725f260c446d2e728859ded206` | Opportunity 2020.04.1 B | O2041B | fail | pass | pass |
| `0xc3569b73b726b9337289a427f6302ffdd9db7b2b` | DX1S Security Token | DX1S | fail | pass | pass |
| `0x724ba15845719549ea1ea2f0aac9d75d31dbd818` | Ecowatt | ECW | pass | pass | pass |
| `0x56e94d9b319d45317d3031a4dd11a45be96e6123` | PRETIUM Token | PRTM | fail | pass | pass |
| `0x76e01e009a1e0664146c9ec08577ee15a4f9335b` | Test Token | TT | pass | pass | pass |
| `0x6f31caae12ea25f8d5b69b93d4c57e1af7f62272` | CofundUbud | CICD | pass | pass | pass |
| `0xce1b20a1c93e78a9f83112a00c0c9ad5acc3aaf7` | CofundUbud | CICD | fail | pass | pass |
| `0x7a132089313ca1b09f2a9b39ec5fc552c7004df6` | Peach Investment Fund Token | PIFT | pass | pass | pass |
| `0x2f4d2be7e5481b32d721901ee8a411a0cde050b0` | BoulderTech-CSPX | CSPX.bt | pass | pass | pass |
| `0xbab6cb51a23d6d98515e95f4069e9fdc8e3f780a` | BoulderTech-CNDX | CNDX.bt | pass | pass | pass |
| `0x8636391089e5c62cb60e535da9924eb3bd239548` | BoulderTech-IB01 | IB01.bt | pass | pass | pass |
| `0xe0073684b795cae0d8cc3e7b3e887e81ea517e5d` | USD Frictionless United Stat | fsUSD | pass | pass | pass |
| `0xc45889ed4f2c9858c75d512b9733cb39e6a8a26a` | EUR Frictionless Euro | fsEUR | pass | pass | pass |
| `0xa452d743968e3316288712964e13069043568cb4` | GBP Frictionless British Pou | fsGBP | pass | pass | pass |
| `0x2ee7045012e3b077c001b3d1322c6340f833ba90` | HKD Frictionless Hong Kong D | fsHKD | pass | pass | pass |
| `0x87a3213e6dec30b6dbfcf927d3f0bf4743660a7a` | JPY Frictionless Japanese Ye | fsJPY | pass | pass | pass |
| `0x9cf97f10069dbf78d72914521787f5617b2eeeef` | Frictionless Markets Securit | RCSLO46S00 | pass | pass | pass |
| `0xd906ae535218da5214111610aeb63832e639cff0` | Frictionless Bitcoin | fsBTC | pass | pass | pass |
| `0x7b4860db0da91ba39eb29fd64c90b2756539e2de` | Frictionless Markets Securit | RCSLO46S00 | pass | pass | pass |
| `0x548292c29054f2709da3dcbbe33dd4449f3de8a1` | Frictionless Markets Securit | RCSLO46S00 | pass | pass | pass |
| `0x0500048b2ce9a1b4192b208e0237c04f39760c68` | Frictionless Institutional C | fsBRIEGCD | pass | pass | pass |
| `0x3314304a2175bbb34aefcca46d244d27ee52f693` | Frictionless Markets Securit | RCSLO46S00 | pass | pass | pass |
| `0x3fe82bdb53833e6ffa3a04ff98b90b4547a10c9e` | Frictionless Institutional C | fsBICSGCD | pass | pass | pass |
| `0x631a3c9f36eeeb6fa6e51c30048074d6e2c9de91` | TMP | TMP | pass | pass | pass |
| `0x5a2992264632eca06323432f8fa638d053f2e87f` | Vines Test | VINES_T | fail | pass | pass |
| `0x6a04acc938011eb5a0d64b222a0f6561c2d702c0` | Vines Test | VINES_T | fail | pass | pass |
| `0x5a03a9884901e03b3d86c02fe05853037cae990d` | Vines Test | VINES_T | pass | pass | pass |
| `0x793d262803e037515f4ddd951fd285fd03a32821` | FAST SP Ethereum  | FAST | fail | pass | pass |
| `0xeab1227ad4d48ea6cb0ee47382079f40a61a0f82` | TestOffering | Test | pass | pass | pass |
| `0xdcf8e9a4425d72d2a2377fa1e013d48ccc74ec41` | BT FUTURES PROPERTY FUND | BTFPF1 | pass | pass | pass |
| `0xeaeadbf3b3616f7287654789a62b94fe35b2c225` | BT FUTURES PROPERTY FUND | BTFPF1 | pass | pass | pass |
| `0x54a1b2e28858239771ae0906dabe7a48f5e80b1b` | RealTest | RTOX | pass | pass | pass |
| `0x9053bebd25a20ea801c90ff8d295be2fcd8d28ed` | NPTTesting | NPTTU | pass | pass | pass |
| `0x014f3d48aba30cc0ee78df729799173c23117a23` | QLD2032 | QLD2032 | pass | pass | pass |
| `0xf8e81d010e2875a4957d3e3cb88ec63159b9d90c` | NPT | NPT | pass | pass | pass |
| `0xd273019e6871b7ac827fe8aaa8978966e2050c7c` | PTRON | PTR | pass | pass | pass |
| `0x9bc326819a77a2fd99b1f595ac5308094cfe8765` | PTRON | PTRON | pass | pass | pass |
| `0xf8ff95e395934d555dc9ea3c0dfaa19ba2f65f1f` | BT Asset | BTAH | pass | pass | pass |
| `0xe2bdf54128781feac96da4e9ff21913f821a5b7b` | BT FUTURES PROPERTY FUND | BTFPF1 | pass | pass | pass |
| `0x50367eda2d8c1cc05bb57885d4e1bfc5d3f0475f` | QLD2032 | QLD2032 | pass | pass | pass |
| `0x1e9c1a64dea5eaf6dc7c6e528072460656958c5e` | POAA | POAA | pass | pass | pass |
| `0x9cb819a97da1ef21064168ae4ee83cada29b6377` | POAA | POAA | pass | pass | pass |
| `0xfdae9a2d321f6e93f493674b333f622633f084b8` | TRC | RITZ | pass | pass | pass |
| `0xc735f8acd6469cd15673d047f9b9b02a5db305b4` | 14501 Grove Resort - Unit 12 | 14501GR.12 | fail | pass | pass |
| `0x4369818aa30b511dc8ccf2039e19c09b68297171` | Realproton | REALP | pass | pass | pass |
| `0xb68d2e08633f1dc092f25489381caf68da37ef53` | STLG | STLT | pass | pass | pass |
| `0x48aa3f467f0d5b4dd09eac46ce9c633e29919ebc` | OBGroup | OBTPH | pass | pass | pass |
| `0x06ced77613e4be679c8ab66670deb3edbd1b551e` | RareTech | RARE | pass | pass | pass |
| `0x1fdf52ad3929e8dd0f647f5f20d122031e58fc10` | TMMF ETH TEST  | TMMF | pass | pass | pass |
| `0xc0f5cffa035fb80cc58ace552707d33d7abd83fc` | Phillip Capital SGD Money Ma | PCMSGD | pass | pass | pass |
| `0xd48b82928464c6f648042b86f1ea598ce432389b` | Phillip Capital USD Money Ma | PCMUSD  | pass | pass | pass |
| `0x478f37fd214f053850221b90ed7ba3077101bb17` | HIToken | HIT | pass | pass | pass |
| `0x0a257586ff1b6aff777527952308d45afc2082ff` | QuickToken | QTK | fail | pass | pass |
| `0x0f9c38ce0bd8d5ef24d757105ff8154101807508` | Phillip Capital SGD Money Ma | PCMSGD | pass | pass | pass |
| `0xffbe99453acebcede91b4782ae3e80786bae3655` | Phillip Capital USD Money Ma | PCMUSD | pass | pass | pass |
| `0x9fc121b7e9a0ba2df2e89be6bc56705d6baa864d` | ART Fund | ARTFund | pass | pass | pass |
| `0xd9826dee11797d9f4140bceba1712a505f4b0f0f` | KCLFund | KCLFund | pass | pass | pass |
| `0x720fc2fcce1922215357063082f05454b66499d3` | BNP PARIBAS MONE ETAT T CAP | FR0014015S | fail | pass | pass |
| `0xfdec0c702b7418f5b9a1c84a74648e90e585309a` | impl | impl | fail | pass | pass |
| `0xb32bddfe8bc63301bf5da6122a41ede06d36dba6` | Beem Property Token | BPT | fail | pass | pass |
| `0x9dacd1b9f244618b294934fc4870e4fd0de25139` | Beem Property Token v2 | BPT2 | fail | pass | pass |
| `0xbe3887c6d286b644720389e9f7bceea4d32c8bbd` | SReserve | SLVR | pass | pass | pass |
| `0xeef879f869ed13a6818d0a64069d6deccd9bfeb3` | GReserve | GLDR | pass | pass | pass |
| `0xab78999007b82879c47c97955d077abc7b847470` | 005Main Asset tokenization m | 005Main | pass | pass | pass |
| `0x312b4ea5de43a0d76f8c5bd3f122691c9f4f9463` | PAX Gold | PAXG | fail | pass | pass |
| `0x60f7ea65e7629abca45a7036efe158f6b6512f92` | BUIDL USD | BUIDL | pass | pass | pass |
| `0xc525cd949e5004dd498e6aa3a5b894e57d9fce42` | Omnique Fund | OMQ | pass | pass | pass |
| `0xd17bf152d527f1505a46676308f51bbd9c827ccd` | Silver 3643 | SL3643 | pass | pass | pass |
| `0x94a3923d232f05516901195691e66f420dcf33a1` | Gold 3643 | GD3643 | pass | pass | pass |
| `0xcab0b0df823d3428fc4a9c73a9fe39b7718e4557` | NatriumX | NAX | pass | pass | pass |
| `0x3a9ec83e92ae4275311176928bab5b8e3f9b686b` | Gold 3643 | GD3643 | pass | pass | pass |
| `0x63a2e97cc5d91f8c0b537496512e22ddaa65fa75` | Wallet | WT | pass | pass | pass |
| `0x3da93bdd1abdcf228845e44b3e17de69bd840aac` | Manhattan Office REIT | MORE | pass | pass | pass |
| `0x2fc6bc32509272794db383f6d765d4e138364a90` | Sovereign Gold Bond | SGB | pass | pass | pass |
| `0x91f18b52d84bbce7ba0930cc2772399ce4adef72` | SReserve | SLVR | fail | pass | pass |
| `0xaec17f764438fecfae1cdc7c40a8658f71686570` | GReserve | GLDR | fail | pass | pass |
| `0xea0694813ee8a5c7b72af8865b8c423dd17c40c2` | UC | UC | pass | pass | pass |
| `0x53866056fafd52a831e15da4d1567eccb7a3ebc4` | Fine Silver Vietnam | FSV | pass | pass | pass |
| `0x4aa2c9713776060d73e55572809aab4b03dec5dd` | Manhattan Office REIT | MORE | pass | pass | pass |
| `0x92947fd1f94af5489e054fc838cc71973f8cdd76` | Sovereign Gold Bond | SGB | pass | pass | pass |
| `0x6a2af40073bb35b36f0014be7cf3f0d9475e587b` | ABC Token | ABC | pass | pass | pass |
| `0x4b69128f0159067ea0c49ed96c83133a8b8a4e6e` | RATIDDGJG | RD | pass | pass | pass |
| `0x6b5d2b18bf5d72972e5d2ae487b8263323b1e0f0` | Robbet | RB | pass | pass | pass |
| `0x85a48c0a20b85f749ad342eb08dcb605c4cebc23` | Au Gold | AUG | pass | pass | pass |
| `0x855da3999195c34069b0834c02d4c4ec403f6186` | testing-offering-1 | MAU3 | pass | pass | pass |
| `0x8b2465bfae0b5222e145d81e2831a7b1914eafed` | Test ERC3643 Token | T3643 | pass | pass | pass |
| `0x69762ce9a1524451ae81418789403857201c1bcd` | Token for Regulated EXchange | T-REX | pass | pass | pass |
| `0x27b1d92186f1f2b81b6415630a6b507f845becc4` | T-REX | T-REX | pass | pass | pass |
| `0x1109e4e6a17b5515ff62cca1312dd975229d77eb` | T-REX | T-REX | pass | pass | pass |
| `0xdabba333975c84e667838c36fd809e1cd6898612` | test | test | pass | pass | pass |
| `0xcd47286eff1d8e9050fdb2fdcc68d6139bbccebc` | test | test | pass | pass | pass |
| `0x81acd0f654a68b53a0b5ada884f1558942f2ec91` | Fine Silver Vietnam | FSV | pass | pass | pass |
| `0x3082d28e9b0590d8ec7976ad9d72a40305294ca0` | Test | TEST | pass | pass | pass |
| `0x887c7cb4747039d26fff92156f33a26e4b306e6b` | MS PoC Demo Token | MSPOC | fail | pass | pass |
| `0xe2535ab1321403f2371ae8377f483e3135999292` | TESTING | DNB | pass | pass | pass |
| `0xb8b2a39ead962612000d07450ee5e317837d873a` | TESTING | DNB | pass | pass | pass |
| `0x806f526fc319c645dd7714ec69f1c634caa53556` | TESTING II | DNB2 | pass | pass | pass |
| `0x6dec4912f571c9c4af22448214b19a8e61550b0a` | Capitalmind Mutual Fund | CMF | pass | pass | pass |
