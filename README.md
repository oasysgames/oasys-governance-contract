# oasys-governance-contract
Contracts governing the Oasys ecosystem: A gradual transition from centralized governance by the Oasys Core Team to decentralized governance by Council members.

The Oasys Hub (L1) does not permit the deployment of contracts directly. We have imposed a restriction at the implementation level that prevents deployment from Externally Owned Accounts (EOAs), meaning no EOA is able to deploy contracts. Instead, we facilitate contract deployment through contract accounts using the `CREATE2` opcode. The Oasys Hub is intended to function as a public platform for game developers, and it was not designed to accommodate a vast array of contracts that are unrelated to gaming, such as those used in DeFi. This restriction is in place for that reason.


## v0
This is the first iteration of our governance contract. In this version, only whitelisted callers have the privilege to deploy contracts. The specific details are as follows:
- Administrators are authorized to add or remove whitelisted deployers.
- Only those callers who are on the whitelist can deploy contracts on L1.

### Contract:
- [PermissionedContractFactory](./contracts/PermissionedContractFactory.sol)

## v1
From this version, deploy permissions are granted exclusively to the designated allowed EOA. The allowed EOA has the ability to deploy contracts freely. To mitigate the risk of deploying malicious contracts, a contract call deny list has been introduced. Any interaction with contracts on the deny list will fail. The privilege to grant deploy permissions and manage the deny list is retained by Oasys.

### Contract:
- [EVMAccessControl](./contracts/EVMAccessControl.sol)

## Tasks
### Generate Deployment Bytecodes
Obtain deployment bytecodes by running the `gencode` task. Below is a sample command line to do this:
```sh
npx hardhat gencode --admins 0x00..,0x00.. --creators 0x00..,0x00.. --prev 0x00..
```

## Scripts
### Retrieving the Deployment Address
By executing the [get-address.sh](/scripts/get-address.sh) script, you can retrieve the address where the deployment will occur by providing the deployment calldata.
```sh
CALLDATA=0x60..00 ./scripts/get-address.sh
```

### BulkCreate
```sh
npx hardhat bulkcreate --network oasystestnet --factory 0x123e3ae459a8D049F27Ba62B8a5D48c68A100EBC --csv ./csv/sample.csv --simulate --execute --output ./output/sample.json
```

### Generate Sample Contracts Bytecodes
```sh
# simple counter contract
npx hardhat sample-counter

# ownable bank contract
npx hardhat sample-bank

# upgradable counter contract
npx hardhat sample-counter-upgradable
```
