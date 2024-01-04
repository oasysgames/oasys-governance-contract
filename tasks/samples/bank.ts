import { task } from 'hardhat/config'

const expectedAddress = '0x9aafF8b1F31F699464F00C1eaC40351c3785ff93'
const owner = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

task('sample-bank', 'Generate deployment bytecode for BankOwnable').setAction(async (_, hre) => {
  const { ethers } = hre

  const factory = await ethers.getContractFactory('BankOwnable')
  const deplyTx = await factory.getDeployTransaction()

  console.log(`
deplyment bytecode:

${deplyTx.data}
`)

  const bank = await ethers.getContractAt('BankOwnable', expectedAddress)
  const call = await bank.getFunction('transferOwnership').populateTransaction(owner)

  console.log(`
transferOwnership calldata:

${call.data}
`)
})
