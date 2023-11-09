import { task } from 'hardhat/config'
import * as types from 'hardhat/internal/core/params/argumentTypes'
import { assertAddresses, ZERO_ADDRESS } from './util'

task('gencode', 'Generate deployment bytecode for ContractFactory')
  .addParam('admins', 'The comma separated list of admin addresses', undefined, types.string, false)
  .addParam('creators', 'The comma separated list of creator addresses', undefined, types.string, true)
  .addParam('prev', 'The previous versions of factory contract address', ZERO_ADDRESS, types.string, true)
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre
    const admins: string[] = assertAddresses(taskArgs.admins)
    const creators: string[] = taskArgs.creators ? assertAddresses(taskArgs.creators) : []

    const factory = await ethers.getContractFactory('PermissionedContractFactory')
    const deplyTx = await factory.getDeployTransaction(admins, creators, taskArgs.prev)

    console.log(`
deplyment bytecode:

${deplyTx.data}
`)
  })
