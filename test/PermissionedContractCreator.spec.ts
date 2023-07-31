import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { BytesLike, zeroPadBytes, randomBytes, parseEther } from 'ethers'

const generateSalt = (): BytesLike => zeroPadBytes(randomBytes(32), 32)

describe('PermissionedContractCreator', function () {
  async function deployContractsFixture() {
    // admins and creators
    const [owner, creator1, creator2, newAdmin, newCreator] = await ethers.getSigners()
    const admins: HardhatEthersSigner[] = [owner]
    const creators: HardhatEthersSigner[] = [creator1, creator2]
    // deploy
    const Creator = await ethers.getContractFactory('PermissionedContractCreator')
    const creator = await Creator.deploy([owner.address], [creator1.address, creator2.address])
    // roles
    const adminRole = await creator.DEFAULT_ADMIN_ROLE()
    const createRole = await creator.CONTRACT_CREATOR_ROLE()
    return { creator, admins, creators, newAdmin, newCreator, adminRole, createRole }
  }

  describe('Deployment', function () {
    it('Should set the right admins and creators', async function () {
      const { creator, admins, creators, adminRole, createRole } = await loadFixture(deployContractsFixture)

      for (const admin of admins) {
        expect(await creator.hasRole(adminRole, admin)).to.be.true
      }
      for (const _creator of creators) {
        expect(await creator.hasRole(createRole, _creator)).to.be.true
      }
    })
  })

  describe('create', function () {
    it('Should succeed to create new Counter contract', async function () {
      const { creator, creators } = await loadFixture(deployContractsFixture)
      const Counter = await ethers.getContractFactory('Counter')
      const initialCount = 42
      const deplyTx = await Counter.getDeployTransaction(initialCount)
      const salt = generateSalt()

      const expectedAddress = await creator.getDeploymentAddress(salt, deplyTx.data)
      await expect(creator.connect(creators[0]).create(0, salt, deplyTx.data, expectedAddress))
        .to.emit(creator, 'ContractCreated')
        .withArgs(creators[0].address, 0, salt, deplyTx.data, expectedAddress)

      const counter = await ethers.getContractAt('Counter', expectedAddress)
      expect(await counter.get()).to.equal(initialCount)
    })

    it('Should succeed to create new Bank contract', async function () {
      const { creator, creators } = await loadFixture(deployContractsFixture)
      const Bank = await ethers.getContractFactory('Bank')
      const initialDeposit = parseEther('42')
      const deplyTx = await Bank.getDeployTransaction()
      const salt = generateSalt()

      const expectedAddress = await creator.getDeploymentAddress(salt, deplyTx.data)
      await expect(
        creator
          .connect(creators[0])
          .create(initialDeposit, salt, deplyTx.data, expectedAddress, { value: initialDeposit }),
      )
        .to.emit(creator, 'ContractCreated')
        .withArgs(creators[0].address, initialDeposit, salt, deplyTx.data, expectedAddress)

      const bank = await ethers.getContractAt('Bank', expectedAddress)
      expect(await bank.balance()).to.equal(initialDeposit)
    })

    it('Should revert with unexpected address', async function () {
      const { creator, creators } = await loadFixture(deployContractsFixture)
      const Counter = await ethers.getContractFactory('Counter')
      const initialCount = 42
      const deplyTx = await Counter.getDeployTransaction(initialCount)
      const salt = generateSalt()

      await expect(creator.connect(creators[0]).create(0, salt, deplyTx.data, creators[0].address)).to.be.revertedWith(
        'PCC: unexpected address',
      )
    })

    it('Should revert if sent amout does not match', async function () {
      const { creator, creators } = await loadFixture(deployContractsFixture)
      const Bank = await ethers.getContractFactory('Bank')
      const initialDeposit = parseEther('42')
      const deplyTx = await Bank.getDeployTransaction()
      const salt = generateSalt()

      const expectedAddress = await creator.getDeploymentAddress(salt, deplyTx.data)
      await expect(
        creator.connect(creators[0]).create(initialDeposit, salt, deplyTx.data, expectedAddress),
      ).to.be.revertedWith('PCC: incorrect amount sent')
    })
  })

  describe('grantRole', function () {
    it('Should succeed to grant admin role', async function () {
      const { creator, admins, newAdmin, adminRole } = await loadFixture(deployContractsFixture)

      await expect(creator.connect(admins[0]).grantRole(adminRole, newAdmin.address))
        .to.emit(creator, 'RoleGranted')
        .withArgs(adminRole, newAdmin.address, admins[0].address)
      expect(await creator.hasRole(adminRole, newAdmin.address)).to.true
    })

    it('Should succeed to grant create role', async function () {
      const { creator, admins, newCreator, createRole } = await loadFixture(deployContractsFixture)

      await expect(creator.connect(admins[0]).grantRole(createRole, newCreator.address))
        .to.emit(creator, 'RoleGranted')
        .withArgs(createRole, newCreator.address, admins[0].address)
      expect(await creator.hasRole(createRole, newCreator.address)).to.true
    })

    it('Should revert by ungranted caller', async function () {
      const { creator, newCreator, creators, createRole, adminRole } = await loadFixture(deployContractsFixture)

      await expect(creator.connect(creators[1]).grantRole(createRole, newCreator.address)).to.be.revertedWith(
        `AccessControl: account ${creators[1].address.toLowerCase()} is missing role ${adminRole}`,
      )
    })
  })

  describe('revokeRole', function () {
    it('Should succeed to revoke admin role', async function () {
      const { creator, admins, adminRole } = await loadFixture(deployContractsFixture)

      await expect(creator.connect(admins[0]).revokeRole(adminRole, admins[0].address))
        .to.emit(creator, 'RoleRevoked')
        .withArgs(adminRole, admins[0].address, admins[0].address)
      expect(await creator.hasRole(adminRole, admins[0].address)).to.false
    })

    it('Should succeed to revoke creator role', async function () {
      const { creator, creators, admins, createRole } = await loadFixture(deployContractsFixture)

      await expect(creator.connect(admins[0]).revokeRole(createRole, creators[1].address))
        .to.emit(creator, 'RoleRevoked')
        .withArgs(createRole, creators[1].address, admins[0].address)
      expect(await creator.hasRole(createRole, creators[1].address)).to.false
    })

    it('Should revert by ungranted caller', async function () {
      const { creator, creators, createRole, adminRole } = await loadFixture(deployContractsFixture)

      await expect(creator.connect(creators[1]).revokeRole(createRole, creators[0].address)).to.be.revertedWith(
        `AccessControl: account ${creators[1].address.toLowerCase()} is missing role ${adminRole}`,
      )
    })
  })
})
