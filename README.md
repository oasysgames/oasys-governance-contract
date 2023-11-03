# oasys-governance-contract
Contracts governing the Oasys ecosystem: A gradual transition from centralized governance by the Oasys Core Team to decentralized governance by Council members


## The Initial Governance Contract (v0)
This is the first iteration of our governance contract. In this version, only whitelisted callers have the privilege to deploy contracts. The specific details are as follows:
- Administrators are authorized to add or remove whitelisted deployers.
- Only those callers who are on the whitelist can deploy contracts on L1.


## Tasks
### Generate Deployment Bytecodes
You can obtain deployment bytecodes by running the `gencode` task. Below is a sample command line to do this:
```sh
npx hardhat gencode --admins 0x2ED22eA03fEA3e5BD90f6Fdd52C20c26ff6e1300,0x48466Bc93dF6563c2A638A4be20Feca46A1E314e --creators 0x48466Bc93dF6563c2A638A4be20Feca46A1E314e,0xBDDf8Fad2d30Cd4F7140244690b347fA873e082b
```
