import { task } from 'hardhat/config'

const initalCount = 132

task('sample-counter', 'Generate deployment bytecode for Counter').setAction(async (_, hre) => {
  const { ethers } = hre

  const factory = await ethers.getContractFactory('Counter')
  const deplyTx = await factory.getDeployTransaction(initalCount)

  console.log(`
deplyment bytecode:

${deplyTx.data}
`)
})
