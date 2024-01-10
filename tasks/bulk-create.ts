import { task } from 'hardhat/config'
import * as types from 'hardhat/internal/core/params/argumentTypes'
import { assertAddresses, ZERO_ADDRESS, readCSV, writeJsonToFile, splitArray } from './util'
import * as Contracts from '../typechain-types'

task('bulkcreate', 'Call bulk create function of PermissionedContractFactory')
  .addParam('factory', 'address of PermissionedContractFactory', undefined, types.string, false)
  .addParam('csv', 'the file path of csv file', undefined, types.string, false)
  .addParam('output', 'the file path of output file', undefined, types.string, true)
  .addFlag('simulate', 'the flag whether check the feasibility of deployment')
  .addFlag('execute', 'the flag whether deploy contracts')
  .setAction(async (taskArgs, hre) => {
    const { ethers, getNamedAccounts } = hre
    const { deployer } = await getNamedAccounts()

    const factory = await ethers.getContractAt('PermissionedContractFactory', taskArgs.factory)
    const rows: any = await readCSV(taskArgs.csv)

    // format
    let i = 0
    console.log('print expected addresses:')
    for (const row of rows) {
      // replace expected address
      rows[i].expected = await factory.getDeploymentAddress(row.bytecode, row.salt)
      console.log(`${rows[i].expected}`)

      // format afterCalldatas
      rows[i].afterCalldatas = rows[i].afterCalldatas
        .replace(/\[/g, '')
        .replace(/\]/g, '')
        .replace(/\"/g, '')
        .split('|')
      if (rows[i].afterCalldatas[0] === '') {
        rows[i].afterCalldatas = []
      }

      i++
    }

    if (taskArgs.output) {
      const tuple = convertToTuples(rows)
      writeJsonToFile(tuple, taskArgs.output)
    }

    if (taskArgs.simulate) {
      await simulate(factory, rows)
      console.log("\nwill successful!")
    }

    if (taskArgs.execute) {
      await execute(factory, rows, deployer)
    }
  })

const convertToTuples = (objects:any): any => {
  return objects.map((obj: any) => [
    obj.amount,
    obj.salt,
    obj.bytecode,
    obj.expected,
    obj.tag,
    obj.afterCalldatas
  ]);
}

const simulate = async (factory: Contracts.PermissionedContractFactory, rows: any): Promise<void> => {
  try {
    await factory.bulkCreate.estimateGas(rows)
  } catch (err: any) {
    if (err.message.includes('too many contracts')) {
      if (rows.length === 1) {
        throw new Error('failed even single call')
      }
      const [firstHalf, secondHalf] = splitArray(rows)
      await simulate(factory, firstHalf)
      await simulate(factory, secondHalf)
    } else {
      throw new Error(`failed: ${err.message}`)
    }
  }
}

const execute = async (factory: Contracts.PermissionedContractFactory, rows: any, sender: string): Promise<void> => {
  try {
    const tx = await factory.bulkCreate(rows, {from: sender})
    const receipt = await tx.wait();
    console.log(`succeed to deploy: ${receipt?.hash}`)
  } catch (err: any) {
    if (err.message.includes('too many contracts')) {
      if (rows.length === 1) {
        throw new Error('failed even single call')
      }
      const [firstHalf, secondHalf] = splitArray(rows)
      await execute(factory, firstHalf, sender)
      await execute(factory, secondHalf, sender)
    } else {
      throw new Error(`failed: ${err.message}`)
    }
  }
}
