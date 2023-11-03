import { task } from 'hardhat/config'
import { assertAddresses } from './util'

task('gencode', 'Generate deployment bytecode for ContractFactory')
  .addParam('admins', 'The comma separated list of admin addresses')
  .addParam('creators', 'The comma separated list of creator addresses', undefined, undefined, true)
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre
    const admins: string[] = assertAddresses(taskArgs.admins)
    const creators: string[] = taskArgs.creators ? assertAddresses(taskArgs.creators) : []

    const factory = await ethers.getContractFactory('PermissionedContractFactory')
    const deplyTx = await factory.getDeployTransaction(admins, creators)

    console.log(`
deplyment bytecode:

${deplyTx.data}
`)
  })
